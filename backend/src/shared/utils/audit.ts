// Audit Log Utilities
// Provides helper functions for creating audit log entries

import { prisma } from '../prisma/client';
import type { Prisma, UserRole } from '@prisma/client';

export interface AuditLogInput {
  actorId?: string; // nullable for system actions
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  /** Optional transaction client so the audit write joins the caller's
   * transaction (P2-06/P2-01: guarded update + audit row become atomic). */
  client?: Prisma.TransactionClient | typeof prisma;
}

/**
 * Creates an audit log entry.
 * Never stores secrets (password hashes, temporary passwords, etc.).
 * Old/new values should be sanitized before passing.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  // Sanitize values to ensure no secrets are stored
  const sanitize = (value?: Record<string, unknown> | null): string | null => {
    if (!value) return null;
    const sanitized = { ...value };
    // Remove sensitive fields
    delete sanitized.passwordHash;
    delete sanitized.tempPasswordExpiresAt;
    delete sanitized.mustChangePassword;
    return JSON.stringify(sanitized);
  };

  await (input.client ?? prisma).auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: sanitize(input.oldValue),
      newValue: sanitize(input.newValue),
      reason: input.reason,
    },
  });
}

/**
 * Audit action constants for consistency
 */
export const AuditAction = {
  // User actions
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET', // admin-assisted
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  USER_PASSWORD_RESET_SELF: 'USER_PASSWORD_RESET_SELF', // emailed-code reset
  USER_EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
  USER_LOGIN_GOOGLE: 'USER_LOGIN_GOOGLE', // existing account, Google-verified email

  // Settings actions
  SETTING_CREATED: 'SETTING_CREATED',
  SETTING_UPDATED: 'SETTING_UPDATED',
  SETTING_DELETED: 'SETTING_DELETED',

  // Sprint 2 — Domains / Skills / Programs (BE-10: admin actions are audited)
  DOMAIN_CREATED: 'DOMAIN_CREATED',
  DOMAIN_UPDATED: 'DOMAIN_UPDATED',
  DOMAIN_DEACTIVATED: 'DOMAIN_DEACTIVATED',
  SKILL_CREATED: 'SKILL_CREATED',
  SKILL_UPDATED: 'SKILL_UPDATED',
  SKILL_DELETED: 'SKILL_DELETED',
  PROGRAM_CREATED: 'PROGRAM_CREATED',
  PROGRAM_UPDATED: 'PROGRAM_UPDATED',
  PROGRAM_STATUS_CHANGED: 'PROGRAM_STATUS_CHANGED',

  // Sprint 2 — Assessment question bank
  QUESTION_CREATED: 'QUESTION_CREATED',
  QUESTION_UPDATED: 'QUESTION_UPDATED',
  QUESTION_DELETED: 'QUESTION_DELETED',

  // Sprint 2 — Application decisions (sensitive, reason recorded)
  APPLICATION_REVIEW_STARTED: 'APPLICATION_REVIEW_STARTED',
  APPLICATION_APPROVED: 'APPLICATION_APPROVED',
  APPLICATION_REJECTED: 'APPLICATION_REJECTED',

  // Sprint 3 — Projects (FR-CAND-037-046)
  PROJECT_CREATED: 'PROJECT_CREATED',
  PROJECT_UPDATED: 'PROJECT_UPDATED',
  PROJECT_SUBMITTED_FOR_REVIEW: 'PROJECT_SUBMITTED_FOR_REVIEW',
  PROJECT_APPROVED: 'PROJECT_APPROVED',
  PROJECT_REJECTED: 'PROJECT_REJECTED',
  PROJECT_PUBLISHED: 'PROJECT_PUBLISHED',
  PROJECT_UNPUBLISHED: 'PROJECT_UNPUBLISHED',

  // Sprint 3/4 — Internship management (FR-CAND-047-051, 080-086)
  INTERNSHIP_MENTOR_ASSIGNED: 'INTERNSHIP_MENTOR_ASSIGNED',
  INTERNSHIP_MENTOR_REASSIGNED: 'INTERNSHIP_MENTOR_REASSIGNED',
  INTERNSHIP_PROJECT_ASSIGNED: 'INTERNSHIP_PROJECT_ASSIGNED',
  INTERNSHIP_ACTIVATED: 'INTERNSHIP_ACTIVATED',
  INTERNSHIP_EXTENDED: 'INTERNSHIP_EXTENDED',
  INTERNSHIP_WITHDRAWN: 'INTERNSHIP_WITHDRAWN',
  INTERNSHIP_TERMINATED: 'INTERNSHIP_TERMINATED',
  INTERNSHIP_COMPLETED: 'INTERNSHIP_COMPLETED',
  INTERNSHIP_UNDER_EVALUATION: 'INTERNSHIP_UNDER_EVALUATION',
  TASK_DUE_DATE_CHANGED: 'TASK_DUE_DATE_CHANGED',
  TASK_REOPENED: 'TASK_REOPENED',

  // Sprint 4 — Evaluations (FR-CAND-073-078)
  EVALUATION_SUBMITTED: 'EVALUATION_SUBMITTED',
  EVALUATION_RE_EVALUATION_APPROVED: 'EVALUATION_RE_EVALUATION_APPROVED',

  // Sprint 5 — Certificates (FR-CAND-087-092, FR-DRV-008)
  CERTIFICATE_ISSUED: 'CERTIFICATE_ISSUED',
  CERTIFICATE_REVOKED: 'CERTIFICATE_REVOKED',

  // Sprint 6 — Reports, Resources (FR-CAND-094-097, 101-102)
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  REPORT_STATUS_CHANGED: 'REPORT_STATUS_CHANGED',
  RESOURCE_CREATED: 'RESOURCE_CREATED',
  RESOURCE_UPDATED: 'RESOURCE_UPDATED',
  RESOURCE_DELETED: 'RESOURCE_DELETED',

  // System actions
  SYSTEM_SEED: 'SYSTEM_SEED',
  SCHEDULER_JOB_RUN: 'SCHEDULER_JOB_RUN',
} as const;

/**
 * Helper to get actor ID from request context
 * Returns null for system/scheduler actions
 */
export function getActorIdFromContext(
  userId: string | undefined,
  _userRole: UserRole | undefined
): string | null {
  // In Sprint 0, we don't have auth context yet
  // This is a placeholder for Sprint 1+
  return userId ?? null;
}