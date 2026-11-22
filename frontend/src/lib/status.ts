// Pure, presentation-side helpers for the application / program lifecycles.
//
// These helpers never decide authorization – they only translate the approved
// state model (SRS FR-CAND-028..035, DEC-007, DEC-019) into UI affordances.
// The backend re-validates every transition; the client only hides controls
// that cannot succeed and displays the reason why.

import type {
  Application,
  ApplicationStatus,
  Program,
  ProgramStatus,
  ProjectStatus,
  CertificateStatus,
  InternshipStatus,
  ProjectSourceType,
  ReportCategory,
  ReportStatus,
  TaskStatus,
} from '@/types';

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
};

/**
 * Which lifecycle actions the backend will accept for an application in this
 * status. Mirrors the server transitions (application.service.ts):
 *  - updateDraft/submit: DRAFT only (updateDraft does; submit additionally
 *    checks deadline, profile completeness, eligibility rule)
 *  - withdraw: any status before acceptance (FR-CAND-034)
 *  - accept/decline: APPROVED within the acceptance window (FR-CAND-033)
 */
export interface ApplicationActions {
  canEditDraft: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canAccept: boolean;
  canDecline: boolean;
}

export function applicationActionsFor(status: ApplicationStatus): ApplicationActions {
  const beforeAcceptance = !['ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN'].includes(status);
  return {
    canEditDraft: status === 'DRAFT',
    canSubmit: status === 'DRAFT',
    canWithdraw: beforeAcceptance,
    canAccept: status === 'APPROVED',
    canDecline: status === 'APPROVED',
  };
}

export interface ProgramWindow {
  /** The program accepts new applications right now. */
  open: boolean;
  /** Short reason when closed; null when open. */
  reason: 'NOT_OPEN' | 'DEADLINE_PASSED' | null;
}

/**
 * Whether a program currently accepts new applications (FR-CAND-020: the
 * deadline independently stops applications; FR-CAND-021: only OPEN programs
 * are displayed as applicable).
 */
export function programApplicationWindow(program: Program, now: Date): ProgramWindow {
  if (program.status !== 'OPEN') {
    return { open: false, reason: 'NOT_OPEN' };
  }
  if (new Date(program.applicationDeadline).getTime() <= now.getTime()) {
    return { open: false, reason: 'DEADLINE_PASSED' };
  }
  return { open: true, reason: null };
}

/**
 * Seconds remaining until an assessment deadline, floored at 0. Pure and
 * clock-injected so the countdown logic is testable without faking timers.
 */
export function assessmentSecondsRemaining(deadlineIso: string, now: Date): number {
  const remainingMs = new Date(deadlineIso).getTime() - now.getTime();
  return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * "m:ss" display for the assessment countdown (baseline UI convention).
 */
export function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** True when the application was rejected so the reason can be shown (BE-18). */
export function visibleRejectionReason(application: Application): string | null {
  return application.status === 'REJECTED' ? application.rejectionReason : null;
}

/* ------------------------------------------------------------------ */
/* Sprint 3-6 status presentation maps                                 */
/* ------------------------------------------------------------------ */


/** Human-readable status vocabulary shared by every surface. */
export const INTERNSHIP_STATUS_LABEL: Record<InternshipStatus, string> = {
  PENDING_START: 'Pending start',
  ACTIVE: 'Active',
  UNDER_EVALUATION: 'Under evaluation',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
  TERMINATED: 'Terminated',
};

/**
 * Badge tones matching StatusBadge's StatusTone vocabulary
 * ('success' | 'warning' | 'danger' | 'neutral'). Pages must consume these
 * instead of re-declaring per-file tone maps, so the same status always
 * renders with the same tone everywhere.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export const INTERNSHIP_STATUS_TONE: Record<InternshipStatus, StatusTone> = {
  PENDING_START: 'warning',
  ACTIVE: 'success',
  UNDER_EVALUATION: 'warning',
  COMPLETED: 'success',
  WITHDRAWN: 'neutral',
  TERMINATED: 'danger',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes requested',
  RESUBMITTED: 'Resubmitted',
};

export const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  CHANGES_REQUESTED: 'danger',
  RESUBMITTED: 'warning',
};

export const CERTIFICATE_STATUS_LABEL: Record<CertificateStatus, string> = {
  VALID: 'Valid',
  REVOKED: 'Revoked',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
};

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  PAYMENT_REQUEST: 'Payment request',
  FAKE_PROJECT: 'Fake project',
  MISLEADING_INTERNSHIP: 'Misleading internship',
  MENTOR_MISCONDUCT: 'Mentor misconduct',
  UNREASONABLE_WORKLOAD: 'Unreasonable workload',
  SUSPICIOUS_BEHAVIOUR: 'Suspicious behaviour',
  EVALUATION_DISPUTE: 'Evaluation dispute',
  OTHER: 'Other',
};

export const PROJECT_SOURCE_LABEL: Record<ProjectSourceType, string> = {
  MENTOR_CREATED: 'Mentor-created project',
  SIMULATED: 'Simulated industry project',
  OPEN_SOURCE: 'Open-source contribution',
  COMMUNITY: 'Community project',
  CLIENT: 'Client project',
};

/** Program lifecycle labels (admin + public catalogue surfaces). */
export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

/** Project review lifecycle labels (mentor authoring + admin review). */
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
};

/** Program lifecycle badge tones. */
export const PROGRAM_STATUS_TONE: Record<ProgramStatus, StatusTone> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  CLOSED: 'warning',
  ARCHIVED: 'neutral',
};

/** Final-evaluation recommendation labels (mentor + student surfaces). */
export const RECOMMENDATION_LABEL: Record<
  'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE',
  string
> = {
  COMPLETE: 'Complete',
  COMPLETE_WITH_APPRECIATION: 'Complete with appreciation',
  NOT_COMPLETE: 'Not complete',
};

/** Project difficulty labels (catalogue + authoring surfaces). */
export const DIFFICULTY_LABEL: Record<'BEGINNER' | 'INTERMEDIATE', string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
};

/** Presentation-only: which task actions the backend will accept. */
export function taskActionsFor(
  status: TaskStatus,
  locked?: boolean
): { canStart: boolean; canSubmit: boolean } {
  return {
    canStart: status === 'NOT_STARTED' && !locked,
    canSubmit: (status === 'IN_PROGRESS' || status === 'CHANGES_REQUESTED') && !locked,
  };
}
