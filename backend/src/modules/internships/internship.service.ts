// Internship Service (Sprint 3/4 — FR-CAND-045-049, 056-060, 065-066, 073, 080-085)
//
// Lifecycle (SRS §lifecycle):
//   PENDING_START → ACTIVE          start date reached AND mentor AND project assigned (FR-080)
//   ACTIVE → UNDER_EVALUATION       every mandatory task instance APPROVED (FR-073)
//   UNDER_EVALUATION → COMPLETED    admin confirms BR-CAND-029 checklist (a)-(f); (g) deferred UND-03
//   PENDING_START/ACTIVE/UNDER_EVALUATION → WITHDRAWN   student, reason (FR-083)
//   ACTIVE/UNDER_EVALUATION → TERMINATED                admin, reason (FR-084; not from PENDING_START per UND-16)
//
// Instance independence (FR-046): milestone/task instances are COPIES created at
// project assignment (FR-049); later project-definition edits never alter them.

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify } from '../notifications/notification.service';
import { calculateInternshipProgress } from './internship-progress';
import type { Prisma } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

const internshipInclude = {
  program: { include: { domain: { select: { id: true, name: true } } } },
  mentor: { select: { id: true, fullName: true, email: true } },
  project: { select: { id: true, title: true, sourceType: true, difficulty: true, durationWeeks: true, domainId: true } },
  evaluation: {
    select: { id: true, finalScore: true, recommendation: true, remarks: true, submittedAt: true, rubricVersion: true, locked: true },
  },
  certificates: { select: { id: true, certificateNumber: true, type: true, status: true, issuedAt: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.InternshipInclude;

export class InternshipService {
  // ============================================================
  // Shared helpers
  // ============================================================

  private async getInternshipOr404(id: string) {
    const internship = await prisma.internship.findUnique({
      where: { id },
      include: {
        program: { include: { domain: { select: { id: true, name: true } } } },
        mentor: { select: { id: true, fullName: true, email: true } },
        project: { select: { id: true, title: true, sourceType: true, difficulty: true, durationWeeks: true, domainId: true } },
        // Student (FR-077) and mentor detail views read `internship.evaluation`
        // to render the submitted final evaluation — without this include the
        // student panel claimed no evaluation existed after submission and the
        // mentor page re-offered "Submit evaluation" forever (same payload
        // contract class as the P0-01 submission fix).
        evaluation: true,
      },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    return internship;
  }

  /**
   * FR-056 lock state: an instance is locked while any prerequisite SOURCE task
   * (via TaskDependency on the project definition) has a sibling instance in
   * this internship that is not APPROVED. Instances without a source task
   * (manually added) are never locked by dependencies.
   */
  private computeLockMap(
    tasks: Array<{ id: string; sourceTaskId: string | null; status: string }>,
    dependencies: Array<{ taskId: string; prerequisiteTaskId: string }>
  ): Map<string, boolean> {
    const statusBySource = new Map<string, string>();
    for (const t of tasks) {
      if (t.sourceTaskId) statusBySource.set(t.sourceTaskId, t.status);
    }
    const lockMap = new Map<string, boolean>();
    for (const t of tasks) {
      if (!t.sourceTaskId) {
        lockMap.set(t.id, false);
        continue;
      }
      const prereqSourceIds = dependencies.filter((d) => d.taskId === t.sourceTaskId).map((d) => d.prerequisiteTaskId);
      lockMap.set(t.id, prereqSourceIds.some((pid) => statusBySource.get(pid) !== 'APPROVED'));
    }
    return lockMap;
  }

  private isOverdue(task: { dueDate: Date; status: string }, now = new Date()): boolean {
    // FR-060: due date passed without an approved or pending submission.
    const pending = ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW', 'APPROVED'];
    return task.dueDate.getTime() < now.getTime() && !pending.includes(task.status);
  }

  private progressSummary(
    tasks: Array<{ id: string; title: string; status: string; isMandatory: boolean; dueDate: Date; internMilestoneId: string | null }>,
    milestones: Array<{ id: string; title: string; order: number; isRequired: boolean }>
  ) {
    // Phase 12 §3.6: weighted completion computed by trusted backend logic.
    // Tasks carry no explicit weight until the owner-approved weight column
    // lands; the engine then applies the implicit weight 1, which is the
    // mathematically equivalent count-based result.
    return calculateInternshipProgress(tasks, milestones);
  }

  private async loadTasksWithLocks(internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { projectId: true },
    });
    // P0-01 fix (comprehensive audit 2026-11-15): the student and mentor detail
    // payloads are built from this query, so it must include each task's
    // submission versions (with their review) — previously only the per-task
    // endpoint returned submissions, leaving the mentor "Review submission"
    // button permanently hidden and the student version history empty.
    const [tasks, milestones, resubmissionLimit] = await Promise.all([
      prisma.internTask.findMany({
        where: { internshipId },
        orderBy: [{ internMilestone: { order: 'asc' } }, { createdAt: 'asc' }],
        include: {
          submissions: {
            orderBy: { versionNumber: 'desc' },
            include: { review: { include: { reviewer: { select: { fullName: true, role: true } } } } },
          },
        },
      }),
      prisma.internMilestone.findMany({
        where: { internshipId },
        orderBy: { order: 'asc' },
      }),
      getSetting<number>('resubmissionLimit'),
    ]);

    const dependencies =
      internship?.projectId
        ? await prisma.taskDependency.findMany({
            where: { task: { milestone: { projectId: internship.projectId } } },
            select: { taskId: true, prerequisiteTaskId: true },
          })
        : [];

    const lockMap = this.computeLockMap(tasks, dependencies);
    return { tasks, milestones, lockMap, resubmissionLimit };
  }

  /**
   * Response shaping for a task instance: lock/overdue annotations plus the
   * resubmission budget (P0-01 — the detail pages and the student resubmit
   * dialog both consume this; `null` means unlimited).
   */
  private decorateTask<
    T extends { id: string; status: string; dueDate: Date; resubmissionCount: number },
  >(task: T, lockMap: Map<string, boolean>, resubmissionLimit: number) {
    return {
      ...task,
      locked: lockMap.get(task.id) ?? false,
      overdue: this.isOverdue(task),
      resubmissionsRemaining:
        resubmissionLimit === -1 ? null : Math.max(0, resubmissionLimit - task.resubmissionCount),
    };
  }

  // ============================================================
  // Student operations
  // ============================================================

  async listMine(userId: string, query: { status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = { userId };
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      prisma.internship.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ...internshipInclude,
          tasks: { select: { id: true, title: true, status: true, isMandatory: true, dueDate: true, internMilestoneId: true } },
          milestones: { select: { id: true, title: true, order: true, isRequired: true } },
        },
      }),
      prisma.internship.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const { tasks, milestones, ...internship } = row;
        return { ...internship, progress: this.progressSummary(tasks, milestones) };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getMine(userId: string, id: string) {
    const internship = await this.getInternshipOr404(id);
    if (internship.userId !== userId) {
      // 404 so internship existence is not disclosed to non-owners
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }

    const { tasks, milestones, lockMap, resubmissionLimit } = await this.loadTasksWithLocks(id);
    const progress = this.progressSummary(tasks, milestones);

    // FR-078: rubric + threshold visible from the start.
    const rubric = await prisma.rubric.findUnique({
      where: { version: internship.rubricVersion },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });

    const certificate = await prisma.certificate.findUnique({ where: { internshipId: id } });

    // §3.7 recent activity — real events only (submissions, reviews, status
    // transitions), newest first, capped at 10. Never fabricated.
    const [recentSubmissions, statusEvents] = await Promise.all([
      prisma.submission.findMany({
        where: { internTask: { internshipId: id } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        include: {
          review: { select: { decision: true, comment: true, reviewedAt: true } },
          internTask: { select: { title: true } },
        },
      }),
      prisma.internshipStatusHistory.findMany({
        where: { internshipId: id },
        orderBy: { changedAt: 'desc' },
        take: 5,
      }),
    ]);
    const activity = [
      ...recentSubmissions.map((s) => ({
        kind: s.review ? ('review' as const) : ('submission' as const),
        at: (s.review?.reviewedAt ?? s.submittedAt).toISOString(),
        taskTitle: s.internTask.title,
        versionNumber: s.versionNumber,
        decision: s.review?.decision ?? null,
        comment: s.review?.comment ?? null,
      })),
      ...statusEvents.map((h) => ({
        kind: 'status' as const,
        at: h.changedAt.toISOString(),
        taskTitle: '',
        versionNumber: null,
        decision: h.toStatus,
        comment: h.reason,
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10);

    return {
      data: {
        ...internship,
        progress,
        milestones: milestones.map((m) => ({
          ...m,
          tasks: tasks
            .filter((t) => t.internMilestoneId === m.id)
            .map((t) => this.decorateTask(t, lockMap, resubmissionLimit)),
        })),
        unassignedTasks: tasks
          .filter((t) => t.internMilestoneId === null)
          .map((t) => this.decorateTask(t, lockMap, resubmissionLimit)),
        rubric,
        activity,
        certificate: certificate
          ? { id: certificate.id, certificateNumber: certificate.certificateNumber, type: certificate.type, status: certificate.status, issuedAt: certificate.issuedAt }
          : null,
        // P2-09 fix: after a revocation a replacement CANNOT be issued (frozen
        // schema, one row per internship — owner decision OD-2 pending), so
        // advertising availability would mislead the student. Only a COMPLETED
        // internship with no certificate row at all is truly available.
        certificateAvailable: internship.status === 'COMPLETED' && !certificate,
      },
    };
  }

  async listMyTasks(userId: string, internshipId: string) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.userId !== userId) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    const { tasks, lockMap, resubmissionLimit } = await this.loadTasksWithLocks(internshipId);
    return {
      data: tasks.map((t) => this.decorateTask(t, lockMap, resubmissionLimit)),
    };
  }

  async getMyTask(userId: string, internshipId: string, taskId: string) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.userId !== userId) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');

    const task = await prisma.internTask.findFirst({
      where: { id: taskId, internshipId },
      include: {
        submissions: {
          orderBy: { versionNumber: 'desc' },
          include: { review: { include: { reviewer: { select: { fullName: true, role: true } } } } },
        },
      },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

    const { tasks, lockMap } = await this.loadTasksWithLocks(internshipId);
    const current = tasks.find((t) => t.id === taskId);

    // FR-058/FR-102: resources linked to this task's source definition.
    const resources = task.sourceTaskId
      ? await prisma.resource.findMany({ where: { taskId: task.sourceTaskId }, orderBy: { createdAt: 'desc' } })
      : [];

    const resubmissionLimit = await getSetting<number>('resubmissionLimit');

    return {
      data: {
        ...task,
        locked: current ? (lockMap.get(current.id) ?? false) : false,
        overdue: current ? this.isOverdue(current) : this.isOverdue(task),
        resources,
        resubmissionsRemaining:
          resubmissionLimit === -1 ? null : Math.max(0, resubmissionLimit - task.resubmissionCount),
      },
    };
  }

  /** FR-057: start an unlocked task instance of an ACTIVE internship. */
  async startTask(userId: string, internshipId: string, taskId: string) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.userId !== userId) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (internship.status !== 'ACTIVE') {
      throw new AppError('Tasks can only be started while the internship is ACTIVE', 400, 'INTERNSHIP_NOT_ACTIVE');
    }

    const { tasks, lockMap } = await this.loadTasksWithLocks(internshipId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (lockMap.get(task.id)) {
      throw new AppError('This task is locked until its prerequisite tasks are approved', 400, 'TASK_LOCKED');
    }
    if (task.status !== 'NOT_STARTED') {
      throw new AppError('Task has already been started', 400, 'TASK_ALREADY_STARTED');
    }

    return prisma.internTask.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  /**
   * FR-061-066: submit work. Each submission is an immutable version (FR-064).
   * Guards: ACTIVE internship, task unlocked, not APPROVED/UNDER_REVIEW
   * (FR-065); resubmission only in CHANGES_REQUESTED and within the configured
   * limit (FR-066); URLs well-formed and on permitted hosts for CODE (FR-062);
   * originality declaration mandatory (FR-061).
   */
  async submitTask(
    userId: string,
    internshipId: string,
    taskId: string,
    data: {
      repositoryUrl?: string;
      commitRef?: string;
      documentUrl?: string;
      liveDemoUrl?: string;
      notes?: string;
    }
  ) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.userId !== userId) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (internship.status !== 'ACTIVE') {
      throw new AppError('Submissions are only accepted while the internship is ACTIVE', 400, 'INTERNSHIP_NOT_ACTIVE');
    }

    const task = await prisma.internTask.findFirst({ where: { id: taskId, internshipId } });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

    if (task.status === 'APPROVED' || task.status === 'UNDER_REVIEW') {
      throw new AppError(
        `Submissions are not accepted while the task is ${task.status}`,
        400,
        'TASK_NOT_ACCEPTING_SUBMISSIONS'
      );
    }

    const isResubmission = task.status === 'CHANGES_REQUESTED';
    if (task.status !== 'IN_PROGRESS' && !isResubmission) {
      throw new AppError('Start the task before submitting work', 400, 'TASK_NOT_STARTED');
    }

    const resubmissionLimit = await getSetting<number>('resubmissionLimit');
    if (isResubmission && resubmissionLimit !== -1 && task.resubmissionCount >= resubmissionLimit) {
      throw new AppError(
        `Resubmission limit reached (${resubmissionLimit}) for this task`,
        400,
        'RESUBMISSION_LIMIT_REACHED'
      );
    }

    // FR-062: URL well-formedness + permitted code hosts.
    if (task.evidenceTypes.includes('CODE')) {
      if (!data.repositoryUrl) {
        throw new AppError('A repository URL is required for this task', 400, 'REPOSITORY_URL_REQUIRED');
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(data.repositoryUrl);
      } catch {
        throw new AppError('Repository URL is not a well-formed URL', 400, 'INVALID_URL');
      }
      // P2-04: only web schemes — a `javascript:` repository URL must never
      // be stored and rendered as a link.
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new AppError('Only http(s) URLs are allowed', 400, 'INVALID_URL');
      }
      const host = parsedUrl.hostname.toLowerCase();
      const permittedHosts = await getSetting<string[]>('permittedCodeHosts');
      if (!permittedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        throw new AppError(
          `Repository URLs must be hosted on one of: ${permittedHosts.join(', ')}`,
          400,
          'DISALLOWED_CODE_HOST'
        );
      }
    }
    if (task.evidenceTypes.includes('DOCUMENT') && !data.documentUrl) {
      throw new AppError('A document URL is required for this task', 400, 'DOCUMENT_URL_REQUIRED');
    }
    if (task.evidenceTypes.includes('LIVE_DEMO') && !data.liveDemoUrl) {
      throw new AppError('A live demo URL is required for this task', 400, 'LIVE_DEMO_URL_REQUIRED');
    }
    // P2-04: document/demo URLs are rendered as links — restrict them to
    // http(s) as well (a malformed or javascript: URL must be refused).
    for (const [field, value] of [
      ['documentUrl', data.documentUrl],
      ['liveDemoUrl', data.liveDemoUrl],
    ] as const) {
      if (value) {
        try {
          const parsed = new URL(value);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            throw new Error('scheme');
          }
        } catch {
          throw new AppError(
            `${field === 'documentUrl' ? 'Document' : 'Live demo'} URL must be a well-formed http(s) URL`,
            400,
            'INVALID_URL'
          );
        }
      }
    }

    const versionNumber = (await prisma.submission.count({ where: { internTaskId: taskId } })) + 1;

    const [submission] = await prisma.$transaction([
      prisma.submission.create({
        data: {
          internTaskId: taskId,
          versionNumber,
          repositoryUrl: data.repositoryUrl ?? null,
          commitRef: data.commitRef ?? null,
          documentUrl: data.documentUrl ?? null,
          liveDemoUrl: data.liveDemoUrl ?? null,
          notes: data.notes ?? null,
          originalityDeclared: true,
        },
      }),
      prisma.internTask.update({
        where: { id: taskId },
        data: {
          status: isResubmission ? 'RESUBMITTED' : 'SUBMITTED',
          resubmissionCount: isResubmission ? { increment: 1 } : undefined,
        },
      }),
    ]);

    if (internship.mentorId) {
      await notify(internship.mentorId, {
        type: 'SUBMISSION_CREATED',
        title: 'New submission to review',
        message: `"${task.title}" was submitted and is waiting in your review queue.`,
        link: '/mentor/review-queue',
      });
    }

    return submission;
  }

  /** FR-083: student withdraws from a non-completed internship with a reason. */
  async withdraw(userId: string, internshipId: string, reason: string) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.userId !== userId) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (['COMPLETED', 'WITHDRAWN', 'TERMINATED'].includes(internship.status)) {
      throw new AppError(`An internship that is ${internship.status} cannot be withdrawn`, 400, 'INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.internship.updateMany({
        where: { id: internshipId, status: { in: ['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION'] } },
        data: { status: 'WITHDRAWN', withdrawalReason: reason },
      });
      if (moved.count !== 1) throw new AppError('Internship state changed concurrently', 409, 'CONCURRENT_UPDATE');

      await tx.internshipStatusHistory.create({
        data: {
          internshipId,
          fromStatus: internship.status,
          toStatus: 'WITHDRAWN',
          changedBy: userId,
          reason,
        },
      });

      return tx.internship.findUniqueOrThrow({ where: { id: internshipId } });
    });

    await createAuditLog({
      actorId: userId,
      action: AuditAction.INTERNSHIP_WITHDRAWN,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { status: internship.status },
      newValue: { status: 'WITHDRAWN' },
      reason,
    });

    if (internship.mentorId) {
      await notify(internship.mentorId, {
        type: 'INTERNSHIP_WITHDRAWN',
        title: 'Internship withdrawn',
        message: `An intern withdrew from "${internship.program.title}".`,
        link: '/mentor/internships',
      });
    }

    return updated;
  }

  // ============================================================
  // Mentor operations — assigned internships only (SRS §18)
  // ============================================================

  private async getAssignedInternshipOr404(mentorId: string, internshipId: string) {
    const internship = await this.getInternshipOr404(internshipId);
    if (internship.mentorId !== mentorId) {
      // 404: existence of other mentors' internships is not disclosed
      throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    }
    return internship;
  }

  async listAssigned(mentorId: string, query: { status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = { mentorId };
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      prisma.internship.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          program: { include: { domain: { select: { id: true, name: true } } } },
          project: { select: { id: true, title: true, sourceType: true } },
          user: { select: { id: true, fullName: true } },
          evaluation: { select: { finalScore: true, recommendation: true, submittedAt: true } },
          tasks: { select: { id: true, title: true, status: true, isMandatory: true, dueDate: true, internMilestoneId: true } },
          milestones: { select: { id: true, title: true, order: true, isRequired: true } },
        },
      }),
      prisma.internship.count({ where }),
    ]);

    return {
      data: rows.map((row) => {
        const { tasks, milestones, ...internship } = row;
        return { ...internship, progress: this.progressSummary(tasks, milestones) };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getAssigned(mentorId: string, internshipId: string) {
    const internship = await this.getAssignedInternshipOr404(mentorId, internshipId);
    const { tasks, milestones, lockMap, resubmissionLimit } = await this.loadTasksWithLocks(internshipId);
    const progress = this.progressSummary(tasks, milestones);

    const intern = await prisma.user.findUnique({
      where: { id: internship.userId },
      select: { id: true, fullName: true, email: true },
    });

    // Phase 12 fix (Phase 11 F-05): the mentor evaluation dialog must score
    // the internship's FROZEN rubric version (FR-DRV-006), not the platform's
    // currently active one.
    const rubric = await prisma.rubric.findUnique({
      where: { version: internship.rubricVersion },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });

    return {
      data: {
        ...internship,
        intern,
        rubric,
        progress,
        milestones: milestones.map((m) => ({
          ...m,
          tasks: tasks
            .filter((t) => t.internMilestoneId === m.id)
            .map((t) => this.decorateTask(t, lockMap, resubmissionLimit)),
        })),
        unassignedTasks: tasks
          .filter((t) => t.internMilestoneId === null)
          .map((t) => this.decorateTask(t, lockMap, resubmissionLimit)),
      },
    };
  }

  /** FR-067: pending submissions for this mentor's interns, oldest first, with waiting time. */
  async reviewQueue(mentorId: string) {
    const reviewPeriodDays = await getSetting<number>('reviewPeriodDays');

    // Only submissions still awaiting a decision: a version that already has
    // a review (e.g. v1 after "changes requested") must not reappear beside
    // its resubmission — previously the queue listed every historical version
    // of a task that was back in review, duplicating it and inflating counts.
    const pending = await prisma.submission.findMany({
      where: {
        review: { is: null },
        internTask: {
          internship: { mentorId },
          status: { in: ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'] },
        },
      },
      orderBy: { submittedAt: 'asc' },
      include: {
        internTask: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            internship: {
              select: {
                id: true,
                user: { select: { id: true, fullName: true } },
                program: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    // One entry per task: keep its latest unreviewed version.
    const latestByTask = new Map<string, (typeof pending)[number]>();
    for (const s of pending) {
      const seen = latestByTask.get(s.internTaskId);
      if (!seen || s.versionNumber > seen.versionNumber) latestByTask.set(s.internTaskId, s);
    }
    const submissions = pending.filter((s) => latestByTask.get(s.internTaskId) === s);

    const now = Date.now();
    return {
      data: submissions.map((s) => ({
        submissionId: s.id,
        versionNumber: s.versionNumber,
        task: {
          id: s.internTask.id,
          title: s.internTask.title,
          status: s.internTask.status,
        },
        intern: s.internTask.internship.user,
        program: s.internTask.internship.program,
        internshipId: s.internTask.internship.id,
        submittedAt: s.submittedAt,
        waitingHours: Math.floor((now - s.submittedAt.getTime()) / (60 * 60 * 1000)),
        reviewPeriodBreached:
          now - s.submittedAt.getTime() > reviewPeriodDays * DAY_MS, // FR-071 flag
      })),
    };
  }

  /** Move a submitted/resubmitted task to UNDER_REVIEW (mentor-only). */
  async startReview(mentorId: string, internTaskId: string) {
    const task = await prisma.internTask.findUnique({
      where: { id: internTaskId },
      include: { internship: { select: { mentorId: true, status: true } } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.mentorId !== mentorId) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.status !== 'ACTIVE') {
      throw new AppError('Reviews are only possible while the internship is ACTIVE', 400, 'INTERNSHIP_NOT_ACTIVE');
    }
    if (!['SUBMITTED', 'RESUBMITTED'].includes(task.status)) {
      throw new AppError(`Task in status ${task.status} cannot move to review`, 400, 'INVALID_TRANSITION');
    }

    return prisma.internTask.update({ where: { id: internTaskId }, data: { status: 'UNDER_REVIEW' } });
  }

  /**
   * FR-068/069: approve a submission version or request changes (comment
   * mandatory for changes). Decision applies to the LATEST version.
   */
  async decideSubmission(mentorId: string, internTaskId: string, decision: 'APPROVED' | 'CHANGES_REQUESTED', comment: string) {
    if (decision === 'CHANGES_REQUESTED' && !comment.trim()) {
      throw new AppError('A feedback comment is mandatory when requesting changes', 400, 'COMMENTS_REQUIRED');
    }

    const task = await prisma.internTask.findUnique({
      where: { id: internTaskId },
      include: {
        internship: { select: { mentorId: true, status: true, userId: true, program: { select: { title: true } } } },
        submissions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { review: true } },
      },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.mentorId !== mentorId) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.status !== 'ACTIVE') {
      throw new AppError('Reviews are only possible while the internship is ACTIVE', 400, 'INTERNSHIP_NOT_ACTIVE');
    }
    if (!['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(task.status)) {
      throw new AppError(`Task in status ${task.status} has no submission to review`, 400, 'INVALID_TRANSITION');
    }

    const latest = task.submissions[0];
    if (!latest) throw new AppError('No submission found for this task', 404, 'SUBMISSION_NOT_FOUND');
    if (latest.review) {
      throw new AppError('This submission version has already been reviewed', 409, 'ALREADY_REVIEWED');
    }

    const [, updatedTask] = await prisma.$transaction([
      prisma.review.create({
        data: {
          submissionId: latest.id,
          decision,
          comment,
          reviewedBy: mentorId,
        },
      }),
      prisma.internTask.update({
        where: { id: internTaskId },
        data: {
          status: decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED',
          completedAt: decision === 'APPROVED' ? new Date() : null,
        },
      }),
    ]);

    await notify(task.internship.userId, {
      type: decision === 'APPROVED' ? 'TASK_APPROVED' : 'TASK_CHANGES_REQUESTED',
      title: decision === 'APPROVED' ? 'Task approved' : 'Changes requested on a task',
      message: decision === 'APPROVED'
        ? `"${task.title}" was approved. Keep going!`
        : `"${task.title}" needs changes: ${comment}`,
      link: `/internships/${task.internshipId}`,
    });

    // FR-073: AUTO-TRANSITION to UNDER_EVALUATION when the last mandatory task is approved.
    if (decision === 'APPROVED' && task.internship.status === 'ACTIVE') {
      await this.transitionToUnderEvaluation(task.internshipId, updatedTask.id);
    }

    return { task: updatedTask, decision };
  }

  /** FR-073: ACTIVE → UNDER_EVALUATION when every mandatory instance is APPROVED. */
  private async transitionToUnderEvaluation(internshipId: string, approvedTaskId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { status: true, userId: true, program: { select: { title: true } } },
    });
    if (!internship || internship.status !== 'ACTIVE') return;

    const pendingMandatory = await prisma.internTask.count({
      where: { internshipId, isMandatory: true, status: { not: 'APPROVED' } },
    });
    if (pendingMandatory > 0) return;

    // P2-06 fix (comprehensive audit 2026-11-15): the guarded transition and
    // its history row are written in ONE transaction — previously a crash
    // between the two statements could leave the internship transitioned with
    // no history row (or vice versa), weakening the audit trail.
    const moved = await prisma.$transaction(async (tx) => {
      const movedCount = await tx.internship.updateMany({
        where: { id: internshipId, status: 'ACTIVE' },
        data: { status: 'UNDER_EVALUATION' },
      });
      if (movedCount.count !== 1) return 0;

      await tx.internshipStatusHistory.create({
        data: {
          internshipId,
          fromStatus: 'ACTIVE',
          toStatus: 'UNDER_EVALUATION',
          changedBy: null,
          reason: `All mandatory task instances approved (last: ${approvedTaskId})`,
        },
      });
      return 1;
    });
    if (moved !== 1) return;

    await createAuditLog({
      action: AuditAction.INTERNSHIP_UNDER_EVALUATION,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'UNDER_EVALUATION' },
      reason: 'All mandatory task instances approved (FR-CAND-073)',
    });

    await notify(internship.userId, {
      type: 'INTERNSHIP_UNDER_EVALUATION',
      title: 'Internship moved to evaluation',
      message: `All mandatory tasks in "${internship.program.title}" are approved. Your final evaluation is next.`,
      link: `/internships/${internshipId}`,
    });
  }

  /**
   * Phase 12 §3.3: reopen a previously APPROVED task when justified.
   * Assigned mentor only; mandatory justification; audited. If the internship
   * had already transitioned to UNDER_EVALUATION because its last mandatory
   * task was approved, it is returned to ACTIVE (SRS allows the demotion with
   * a recorded reason) so the resubmission cycle can run.
   */
  async reopenApprovedTask(mentorId: string, internTaskId: string, reason: string) {
    const task = await prisma.internTask.findUnique({
      where: { id: internTaskId },
      include: {
        internship: { select: { mentorId: true, status: true, userId: true, program: { select: { title: true } } } },
      },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.mentorId !== mentorId) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.status !== 'APPROVED') {
      throw new AppError('Only an APPROVED task can be reopened', 400, 'TASK_NOT_APPROVED');
    }
    if (!['ACTIVE', 'UNDER_EVALUATION'].includes(task.internship.status)) {
      throw new AppError('Tasks cannot be reopened on a finished internship', 400, 'INTERNSHIP_FINISHED');
    }
    if (!reason.trim()) {
      throw new AppError('A justification is mandatory to reopen an approved task', 400, 'REASON_REQUIRED');
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const reopened = await tx.internTask.update({
        where: { id: internTaskId, status: 'APPROVED' },
        data: { status: 'CHANGES_REQUESTED', completedAt: null },
      });

      if (task.internship.status === 'UNDER_EVALUATION') {
        // P1-05 fix (comprehensive audit 2026-11-15): the demotion is
        // conditional on the internship still being UNDER_EVALUATION, so a
        // reopen racing an admin completion can never overwrite COMPLETED
        // with ACTIVE — if the state changed concurrently the whole reopen
        // rolls back. When the demotion does apply, the existing evaluation
        // is unlocked (invalidated): the mentor must submit a fresh
        // evaluation after the reworked work is re-approved, and the
        // completion checklist refuses any unlocked evaluation.
        const demoted = await tx.internship.updateMany({
          where: { id: task.internshipId, status: 'UNDER_EVALUATION' },
          data: { status: 'ACTIVE' },
        });
        if (demoted.count !== 1) {
          throw new AppError('Internship state changed concurrently', 409, 'CONCURRENT_UPDATE');
        }
        await tx.evaluation.updateMany({
          where: { internshipId: task.internshipId, locked: true },
          data: { locked: false },
        });
        await tx.internshipStatusHistory.create({
          data: {
            internshipId: task.internshipId,
            fromStatus: 'UNDER_EVALUATION',
            toStatus: 'ACTIVE',
            changedBy: mentorId,
            reason: `Task "${task.title}" reopened by the mentor: ${reason}. The prior evaluation was invalidated and must be re-submitted.`,
          },
        });
      }

      return reopened;
    });

    await createAuditLog({
      actorId: mentorId,
      action: AuditAction.TASK_REOPENED,
      entityType: 'InternTask',
      entityId: internTaskId,
      oldValue: { status: 'APPROVED' },
      newValue: { status: 'CHANGES_REQUESTED', internshipDemoted: task.internship.status === 'UNDER_EVALUATION' },
      reason,
    });

    await notify(task.internship.userId, {
      type: 'TASK_REOPENED',
      title: 'Task reopened by your mentor',
      message: `"${task.title}" was reopened: ${reason}`,
      link: `/internships/${task.internshipId}`,
    });

    return updatedTask;
  }

  /** FR-059: assigned mentor changes a task due date, reason mandatory. */
  async changeDueDate(mentorId: string, internTaskId: string, dueDate: Date, reason: string) {
    const task = await prisma.internTask.findUnique({
      where: { id: internTaskId },
      include: { internship: { select: { mentorId: true, status: true, userId: true } } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (task.internship.mentorId !== mentorId) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    if (['COMPLETED', 'WITHDRAWN', 'TERMINATED'].includes(task.internship.status)) {
      throw new AppError('Due dates cannot change on a finished internship', 400, 'INTERNSHIP_FINISHED');
    }
    if (task.status === 'APPROVED') {
      throw new AppError('Due dates cannot change on an approved task', 400, 'TASK_APPROVED');
    }

    const updated = await prisma.internTask.update({
      where: { id: internTaskId },
      data: { dueDate },
    });

    await createAuditLog({
      actorId: mentorId,
      action: AuditAction.TASK_DUE_DATE_CHANGED,
      entityType: 'InternTask',
      entityId: internTaskId,
      oldValue: { dueDate: task.dueDate },
      newValue: { dueDate },
      reason,
    });

    await notify(task.internship.userId, {
      type: 'TASK_DUE_DATE_CHANGED',
      title: 'Task due date changed',
      message: `"${task.title}" is now due ${dueDate.toISOString().slice(0, 10)}: ${reason}`,
      link: `/internships/${task.internshipId}`,
    });

    return updated;
  }
}

export const internshipService = new InternshipService();
