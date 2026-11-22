// Internship progress engine (Phase 12 §3.6 — weighted completion).
//
// PURE functions only: no database access, fully unit-testable. The service
// layer feeds task/milestone snapshots in and renders the results out.
//
// Approved formula (Phase 12 §3.6):
//   Progress = (Σ weights of APPROVED required tasks / Σ weights of all
//               required tasks) × 100
//
// Rules implemented here:
//   - only APPROVED required (mandatory) tasks count toward the numerator;
//   - SUBMITTED / UNDER_REVIEW / CHANGES_REQUESTED / RESUBMITTED do not count;
//   - optional tasks never affect the mandatory completion percentage;
//   - zero-weight and empty configurations are handled safely (no division by
//     zero, no NaN) — a task without an explicit weight carries the implicit
//     weight 1, so today's data produces the mathematically equivalent
//     count-based result until the owner-approved weight column lands;
//   - the calculation is integer-safe: weights are validated integers ≥ 0 and
//     the percentage is rounded to two decimals (no float accumulation).

export interface ProgressTaskInput {
  id?: string;
  title?: string;
  status: string;
  isMandatory: boolean;
  dueDate: Date;
  internMilestoneId: string | null;
  /** Explicit task weight when present (schema proposal pending); otherwise 1. */
  weight?: number | null;
}

export interface ProgressMilestoneInput {
  id: string;
  title: string;
  order: number;
  isRequired: boolean;
}

export interface MilestoneProgress {
  id: string;
  title: string;
  order: number;
  isRequired: boolean;
  mandatoryTasks: number;
  approvedMandatoryTasks: number;
  weightTotal: number;
  weightApproved: number;
  /** Weighted completion 0–100, two decimals. */
  percentage: number;
  /** True when every mandatory task in the milestone is APPROVED (or it has none). */
  complete: boolean;
  /** Derived target date: the latest due date among the milestone's tasks. */
  targetDate: string | null;
}

export interface InternshipProgressResult {
  totalTasks: number;
  mandatoryTasks: number;
  approvedMandatoryTasks: number;
  /** Weighted completion 0–100, two decimals (FR §3.6 formula). */
  approvedPercentage: number;
  /** Σ weights of all mandatory tasks (integer). */
  weightTotal: number;
  /** Σ weights of APPROVED mandatory tasks (integer). */
  weightApproved: number;
  pendingReviewCount: number;
  changesRequestedCount: number;
  remainingMandatoryTasks: number;
  overdueCount: number;
  currentMilestone: { id: string; title: string } | null;
  nextTask: { id: string; title: string; dueDate: string } | null;
  perMilestone: MilestoneProgress[];
}

const PENDING_REVIEW_STATUSES = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'];
const OVERDONE_EXEMPT = [...PENDING_REVIEW_STATUSES, 'APPROVED'];

/** Resolve a task's effective weight: explicit ≥ 0 integer, else implicit 1. */
export function effectiveWeight(task: Pick<ProgressTaskInput, 'weight'>): number {
  if (task.weight === null || task.weight === undefined) return 1;
  if (!Number.isFinite(task.weight) || task.weight < 0) return 1;
  // Decimal-safe: weights are integers; non-integers are floored defensively.
  return Math.floor(task.weight);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Weighted completion for a set of tasks (§3.6). Only APPROVED mandatory
 * tasks contribute. Safe with empty sets and zero-weight configurations.
 */
export function weightedCompletion(tasks: ProgressTaskInput[]): {
  percentage: number;
  weightApproved: number;
  weightTotal: number;
} {
  let weightApproved = 0;
  let weightTotal = 0;
  for (const task of tasks) {
    if (!task.isMandatory) continue;
    const w = effectiveWeight(task);
    weightTotal += w;
    if (task.status === 'APPROVED') weightApproved += w;
  }
  if (weightTotal === 0) return { percentage: 0, weightApproved, weightTotal };
  return {
    percentage: round2((weightApproved / weightTotal) * 100),
    weightApproved,
    weightTotal,
  };
}

function isOverdue(task: ProgressTaskInput, now: Date): boolean {
  return (
    task.dueDate.getTime() < now.getTime() && !OVERDONE_EXEMPT.includes(task.status)
  );
}

/**
 * Full internship progress summary (§3.6/§3.7): overall weighted progress,
 * per-milestone progress, current milestone, next task, pending-review and
 * changes-requested counts, remaining mandatory tasks and overdue count.
 */
export function calculateInternshipProgress(
  tasks: ProgressTaskInput[],
  milestones: ProgressMilestoneInput[],
  now: Date = new Date()
): InternshipProgressResult {
  const mandatory = tasks.filter((t) => t.isMandatory);
  const approvedMandatory = mandatory.filter((t) => t.status === 'APPROVED');
  const overall = weightedCompletion(tasks);

  const pendingReviewCount = tasks.filter((t) => PENDING_REVIEW_STATUSES.includes(t.status)).length;
  const changesRequestedCount = tasks.filter((t) => t.status === 'CHANGES_REQUESTED').length;
  const remainingMandatoryTasks = mandatory.filter((t) => t.status !== 'APPROVED').length;
  const overdueCount = tasks.filter((t) => isOverdue(t, now)).length;

  // Per-milestone progress; a milestone's target date is the latest task due date.
  const perMilestone: MilestoneProgress[] = [...milestones]
    .sort((a, b) => a.order - b.order)
    .map((milestone) => {
      const inMilestone = tasks.filter((t) => t.internMilestoneId === milestone.id);
      const weighted = weightedCompletion(inMilestone);
      const mandatoryInMilestone = inMilestone.filter((t) => t.isMandatory);
      const dueDates = inMilestone.map((t) => t.dueDate.getTime());
      return {
        id: milestone.id,
        title: milestone.title,
        order: milestone.order,
        isRequired: milestone.isRequired,
        mandatoryTasks: mandatoryInMilestone.length,
        approvedMandatoryTasks: mandatoryInMilestone.filter((t) => t.status === 'APPROVED').length,
        weightTotal: weighted.weightTotal,
        weightApproved: weighted.weightApproved,
        percentage: weighted.percentage,
        complete:
          inMilestone.length > 0 &&
          mandatoryInMilestone.every((t) => t.status === 'APPROVED') &&
          mandatoryInMilestone.length > 0,
        targetDate: dueDates.length > 0 ? new Date(Math.max(...dueDates)).toISOString() : null,
      };
    });

  // Current milestone: first required milestone (by order) that is not complete.
  const currentMilestone =
    perMilestone.find((m) => m.isRequired && !m.complete) ?? null;

  // Next task: earliest-due mandatory task that is not APPROVED.
  const nextTaskCandidate = mandatory
    .filter((t) => t.status !== 'APPROVED')
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  return {
    totalTasks: tasks.length,
    mandatoryTasks: mandatory.length,
    approvedMandatoryTasks: approvedMandatory.length,
    approvedPercentage: overall.percentage,
    weightTotal: overall.weightTotal,
    weightApproved: overall.weightApproved,
    pendingReviewCount,
    changesRequestedCount,
    remainingMandatoryTasks,
    overdueCount,
    currentMilestone: currentMilestone
      ? { id: currentMilestone.id, title: currentMilestone.title }
      : null,
    nextTask: nextTaskCandidate
      ? {
          id: nextTaskCandidate.id ?? '',
          title: nextTaskCandidate.title ?? '',
          dueDate: nextTaskCandidate.dueDate.toISOString(),
        }
      : null,
    perMilestone,
  };
}
