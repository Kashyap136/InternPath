// Notification Service (Sprint 6 — FR-CAND-098/099)
// In-app notification centre + the shared `notify()` helper that every
// lifecycle module uses to emit events from the SRS notification catalogue.
// Notification delivery is best-effort from the caller's perspective:
// `notify()` never throws into the primary business flow — a failed
// notification insert is logged, not propagated.

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { sendEmail } from '../../shared/email/mailer';

export interface NotifyInput {
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Public-release hardening (2026-11-17): notification types that ALSO go out
 * by transactional email when SMTP is configured (see shared/email/mailer.ts).
 * Everything else stays in-app only: admin/mentor workflow pings
 * (PROJECT_SUBMITTED/PUBLISHED/REVIEWED, REPORT_SUBMITTED, MENTOR_CREATED,
 * TASK_DUE_DATE_CHANGED) would be spam over email, and notifyAdmins()
 * deliberately does not email — administrators monitor the in-app centre.
 */
const EMAIL_TYPES = new Set([
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'INTERNSHIP_ACTIVATED',
  'INTERNSHIP_COMPLETED',
  'INTERNSHIP_TERMINATED',
  'INTERNSHIP_WITHDRAWN',
  'INTERNSHIP_EXTENDED',
  'INTERNSHIP_UNDER_EVALUATION',
  'MENTOR_ASSIGNED',
  'PROJECT_ASSIGNED',
  'SUBMISSION_CREATED',
  'TASK_APPROVED',
  'TASK_CHANGES_REQUESTED',
  'TASK_REOPENED',
  'EVALUATION_SUBMITTED',
  'COMPLETION',
  'APPRECIATION',
  'CERTIFICATE_ISSUED',
  'CERTIFICATE_REVOKED',
  'REPORT_STATUS_CHANGED',
]);

/** Best-effort companion email for a notification; never throws. */
async function sendCompanionEmail(userId: string, input: NotifyInput): Promise<void> {
  if (!EMAIL_TYPES.has(input.type)) return;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, status: true },
    });
    // Suspended users must not receive workflow email; the suspension notice
    // itself is sent directly by auth.service.
    if (!user || user.status !== 'ACTIVE') return;
    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
    await sendEmail({
      to: user.email,
      subject: `InternPath: ${input.title}`,
      text: `${input.message}\n\n${input.link ? `Open in InternPath: ${appUrl}${input.link}\n\n` : '\n'}You are receiving this because you have an InternPath account.`,
    });
  } catch (error) {
    console.error('sendCompanionEmail failed (non-fatal):', error instanceof Error ? error.message : error);
  }
}

/**
 * Fire-and-forget notification. Safe to call inside lifecycle flows:
 * errors are logged and swallowed so a notification failure can never
 * roll back the business transaction that produced the event.
 */
export async function notify(userId: string, input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      },
    });
  } catch (error) {
    console.error('notify() failed (non-fatal):', error);
  }
  // Fire-and-forget companion email (no-op unless SMTP is configured; the
  // await is bounded by the mailer's own timeout handling and never throws).
  await sendCompanionEmail(userId, input);
}

/** Notify every active administrator (used e.g. for new reports, project submissions). */
export async function notifyAdmins(input: NotifyInput): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      })),
    });
  } catch (error) {
    console.error('notifyAdmins() failed (non-fatal):', error);
  }
}

export class NotificationService {
  async listMine(userId: string, query: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = { userId };
    if (query.unreadOnly) where.isRead = false;

    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      unreadCount,
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updated: result.count };
  }
}

export const notificationService = new NotificationService();
