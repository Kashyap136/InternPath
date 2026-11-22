// Report Service (Sprint 6 — FR-CAND-094-097)
// Students and mentors file reports; content is restricted to the reporter and
// administrators (FR-096); admins move reports through the status flow with a
// mandatory resolution note for RESOLVED/REJECTED (FR-095).

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify, notifyAdmins } from '../notifications/notification.service';

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
  UNDER_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

export class ReportService {
  async create(reporterId: string, data: {
    category: string;
    description: string;
    evidenceLinks: string[];
    targetUserId?: string;
    targetProjectId?: string;
    targetInternshipId?: string;
  }) {
    // Target references must exist if provided (prevents dangling references).
    if (data.targetUserId && !(await prisma.user.findUnique({ where: { id: data.targetUserId } }))) {
      throw new AppError('Reported user not found', 404, 'TARGET_USER_NOT_FOUND');
    }
    if (data.targetProjectId && !(await prisma.project.findUnique({ where: { id: data.targetProjectId } }))) {
      throw new AppError('Reported project not found', 404, 'TARGET_PROJECT_NOT_FOUND');
    }
    if (data.targetInternshipId && !(await prisma.internship.findUnique({ where: { id: data.targetInternshipId } }))) {
      throw new AppError('Reported internship not found', 404, 'TARGET_INTERNSHIP_NOT_FOUND');
    }

    const report = await prisma.report.create({
      data: {
        reporterId,
        category: data.category as never,
        description: data.description,
        evidenceLinks: data.evidenceLinks,
        targetUserId: data.targetUserId ?? null,
        targetProjectId: data.targetProjectId ?? null,
        targetInternshipId: data.targetInternshipId ?? null,
      },
    });

    await createAuditLog({
      actorId: reporterId,
      action: AuditAction.REPORT_SUBMITTED,
      entityType: 'Report',
      entityId: report.id,
      newValue: { category: data.category, hasTargets: Boolean(data.targetUserId || data.targetProjectId || data.targetInternshipId) },
    });

    await notifyAdmins({
      type: 'REPORT_SUBMITTED',
      title: 'New report submitted',
      message: `A ${data.category.replace(/_/g, ' ').toLowerCase()} report was filed and awaits review.`,
      link: '/admin/reports',
    });

    return report;
  }

  /** FR-096: reporters see only their own reports. */
  async listMine(reporterId: string, query: { page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const [rows, total] = await Promise.all([
      prisma.report.findMany({
        where: { reporterId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.report.count({ where: { reporterId } }),
    ]);
    return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async adminList(query: { status?: string; category?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const [rows, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, fullName: true, role: true } },
          handler: { select: { id: true, fullName: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);
    return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  /** FR-095: admin status flow with mandatory resolution notes. */
  async changeStatus(adminId: string, reportId: string, status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED', resolutionNote?: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new AppError('Report not found', 404, 'REPORT_NOT_FOUND');

    if (!TRANSITIONS[report.status]?.includes(status)) {
      throw new AppError(`A report in ${report.status} cannot move to ${status}`, 400, 'INVALID_TRANSITION');
    }
    if (['RESOLVED', 'REJECTED'].includes(status) && !resolutionNote?.trim()) {
      throw new AppError('A resolution note is mandatory when resolving or rejecting a report', 400, 'RESOLUTION_NOTE_REQUIRED');
    }

    const updated = await prisma.report.update({
      where: { id: reportId },
      data: { status: status as never, resolutionNote: resolutionNote ?? null, handledBy: adminId },
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.REPORT_STATUS_CHANGED,
      entityType: 'Report',
      entityId: reportId,
      oldValue: { status: report.status },
      newValue: { status },
      reason: resolutionNote,
    });

    await notify(report.reporterId, {
      type: 'REPORT_STATUS_CHANGED',
      title: 'Your report was updated',
      message: `Your report is now ${status.replace(/_/g, ' ').toLowerCase()}${resolutionNote ? `: ${resolutionNote}` : ''}.`,
      link: '/reports',
    });

    return updated;
  }
}

export const reportService = new ReportService();
