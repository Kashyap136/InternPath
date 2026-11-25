// Admin Platform Module (Sprint 6 — FR-CAND-105/106/107)
//
// - Settings API: view/change configurable platform parameters (validated,
//   audited via setSetting).
// - Dashboard: aggregate counts for the admin overview.
// - Audit view: read-only, filterable audit log (no modify/delete exists by
//   design — FR-105).

import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { prisma } from '../../shared/prisma/client';
import {
  getAllSettingsWithMeta,
  setSetting,
  validateSettingValue,
  DEFAULT_SETTINGS,
  type SettingValue,
} from '../../shared/utils/settings';
import { AppError } from '../../shared/utils/AppError';

// ---- Settings (FR-107) ----

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

const updateSettingsSchema = z.object({
  body: z.object({
    changes: z
      .array(
        z.object({
          key: z.string().refine((k) => SETTING_KEYS.includes(k), 'Unknown setting key'),
          value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
          reason: z.string().min(5, 'A reason is required for every setting change').max(500),
        })
      )
      .min(1, 'Provide at least one setting change')
      .max(20),
  }),
});

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getAllSettingsWithMeta();
  res.json({ data: settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const { changes } = req.body as { changes: Array<{ key: string; value: SettingValue; reason: string }> };

  // P2-01 fix (comprehensive audit 2026-11-15): every value is validated
  // against its key's type and range BEFORE anything is written — an
  // out-of-range value (e.g. sessionInactivityTimeout 0, which would expire
  // every session on the next request) is rejected with a 400 and a clear
  // message instead of being stored. All changes apply in ONE transaction, so
  // a multi-key update can no longer partially apply.
  const errors = changes
    .map((change) => validateSettingValue(change.key, change.value))
    .filter((message): message is string => message !== null);
  if (errors.length > 0) {
    throw new AppError(`Invalid setting value(s): ${errors.join('; ')}`, 400, 'SETTING_VALIDATION_FAILED');
  }

  const updated: Record<string, SettingValue> = {};
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await setSetting(change.key, change.value, req.user!.id, change.reason, tx);
      updated[change.key] = change.value;
    }
  });

  res.json({ data: updated, message: `${changes.length} setting(s) updated` });
});

// ---- Dashboard (FR-106) ----

export const getAdminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();

  const [
    usersByRole,
    activeInternships,
    pendingApplications,
    projectsPendingReview,
    overdueTasks,
    openReports,
    certificatesIssued,
    unreadNotifications,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true }, where: { status: 'ACTIVE' } }),
    prisma.internship.count({ where: { status: 'ACTIVE' } }),
    prisma.application.count({ where: { status: 'SUBMITTED' } }),
    prisma.project.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.internTask.count({
      where: { dueDate: { lt: now }, status: { notIn: ['APPROVED', 'SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] } },
    }),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.certificate.count({ where: { status: 'VALID' } }),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  const recentAudit = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { actor: { select: { fullName: true, role: true } } },
  });

  res.json({
    data: {
      usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count._all])),
      activeInternships,
      pendingApplications,
      projectsPendingReview,
      overdueTasks,
      openReports,
      validCertificates: certificatesIssued,
      unreadNotifications,
      recentAudit,
      generatedAt: now.toISOString(),
    },
  });
});

// ---- Audit view (FR-105 — read-only) ----

const auditQuery = z.object({
  query: z.object({
    action: z.string().max(60).optional(),
    entityType: z.string().max(60).optional(),
    entityId: z.string().max(60).optional(),
    actorId: z.string().max(60).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const listAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as z.infer<typeof auditQuery>['query'];
  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 30, 100);

  const where: Record<string, unknown> = {};
  if (q.action) where.action = { contains: q.action };
  if (q.entityType) where.entityType = { contains: q.entityType };
  if (q.entityId) where.entityId = q.entityId;
  if (q.actorId) where.actorId = q.actorId;
  if (q.from || q.to) {
    where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { fullName: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
});

const router: Router = Router();

router.use(authMiddleware, requireRole('ADMIN'));
router.get('/settings', asyncHandler(getSettings));
router.put('/settings', validate(updateSettingsSchema), asyncHandler(updateSettings));
router.get('/dashboard', asyncHandler(getAdminDashboard));
router.get('/audit', validate(auditQuery), asyncHandler(listAuditLogs));

export default router;
