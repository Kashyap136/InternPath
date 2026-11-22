// Internship Admin & Evaluation Service (Sprint 3/4)
// FR-CAND-047-049 (assignment), 080-084 (lifecycle), 074-077 (evaluation),
// 081 + BR-CAND-029 (completion checklist).

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { getSetting } from '../../shared/utils/settings';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notify } from '../notifications/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_ASSIGNMENT_STATUSES: ('PENDING_START' | 'ACTIVE' | 'UNDER_EVALUATION')[] = [
  'PENDING_START',
  'ACTIVE',
  'UNDER_EVALUATION',
];

export class InternshipAdminService {
  // ============================================================
  // Reads
  // ============================================================

  async adminList(query: { status?: string; page?: number; limit?: number; delayed?: boolean }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    // Phase 12 3.9: delayed = past expected completion date and still running.
    if (query.delayed) {
      where.endDate = { lt: new Date() };
      where.status = { in: ['ACTIVE', 'UNDER_EVALUATION'] };
    }

    const [rows, total] = await Promise.all([
      prisma.internship.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          program: { include: { domain: { select: { id: true, name: true } } } },
          mentor: { select: { id: true, fullName: true } },
          project: { select: { id: true, title: true, sourceType: true } },
          user: { select: { id: true, fullName: true, email: true } },
          // P1-05 companion fix: the admin list UI gates "Approve re-evaluation"
          // and the "(locked)/(unlocked)" line on internship.evaluation, but this
          // payload omitted it — the controls were unreachable through the
          // browser (same UI/API contract class as P0-01).
          evaluation: true,
        },
      }),
      prisma.internship.count({ where }),
    ]);

    return {
      data: rows,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async adminGet(id: string) {
    const internship = await prisma.internship.findUnique({
      where: { id },
      include: {
        program: { include: { domain: true } },
        mentor: { select: { id: true, fullName: true, email: true } },
        project: true,
        user: { select: { id: true, fullName: true, email: true } },
        milestones: { orderBy: { order: 'asc' }, include: { tasks: { orderBy: { createdAt: 'asc' } } } },
        evaluation: true,
        certificates: true,
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');

    const tasks = internship.milestones.flatMap((m) => m.tasks);
    const mandatory = tasks.filter((t) => t.isMandatory);
    const approved = mandatory.filter((t) => t.status === 'APPROVED');

    return {
      data: {
        ...internship,
        progress: {
          mandatoryTasks: mandatory.length,
          approvedMandatoryTasks: approved.length,
          approvedPercentage: mandatory.length === 0 ? 0 : Math.round((approved.length / mandatory.length) * 100),
        },
      },
    };
  }

  // ============================================================
  // Mentor assignment (FR-CAND-047, FR-CAND-050)
  // ============================================================

  /**
   * FR-047: eligible mentors = role MENTOR + ACTIVE, expertise includes the
   * internship's domain, and current active assignment count below capacity.
   */
  async eligibleMentors(internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { program: { select: { domainId: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');

    const mentors = await prisma.user.findMany({
      where: { role: 'MENTOR', status: 'ACTIVE', mentorProfile: { is: { domains: { some: { id: internship.program.domainId } } } } },
      select: {
        id: true,
        fullName: true,
        email: true,
        mentorProfile: { select: { maxActiveInterns: true, summary: true } },
        _count: {
          select: { mentorInternships: { where: { status: { in: ACTIVE_ASSIGNMENT_STATUSES } } } },
        },
      },
    });

    return {
      data: mentors
        .map((m) => ({
          id: m.id,
          fullName: m.fullName,
          email: m.email,
          summary: m.mentorProfile?.summary ?? null,
          maxActiveInterns: m.mentorProfile?.maxActiveInterns ?? 0,
          currentAssignments: m._count.mentorInternships,
          hasCapacity: m._count.mentorInternships < (m.mentorProfile?.maxActiveInterns ?? 0),
        }))
        .sort((a, b) => Number(b.hasCapacity) - Number(a.hasCapacity) || a.fullName.localeCompare(b.fullName)),
    };
  }

  /** FR-047/050: assign or reassign (reassignment requires a mandatory reason). */
  async assignMentor(adminId: string, internshipId: string, mentorId: string, reason?: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { program: { select: { domainId: true, title: true } }, mentor: { select: { id: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (['COMPLETED', 'WITHDRAWN', 'TERMINATED'].includes(internship.status)) {
      throw new AppError('Mentors cannot be assigned to a finished internship', 400, 'INTERNSHIP_FINISHED');
    }

    const previousMentorId = internship.mentor?.id ?? null;
    const isReassignment = previousMentorId !== null && previousMentorId !== mentorId;
    if (isReassignment && !reason?.trim()) {
      throw new AppError('A reason is mandatory when reassigning a mentor', 400, 'REASON_REQUIRED');
    }

    const mentor = await prisma.user.findFirst({
      where: {
        id: mentorId,
        role: 'MENTOR',
        status: 'ACTIVE',
        mentorProfile: { is: { domains: { some: { id: internship.program.domainId } } } },
      },
      include: { mentorProfile: { select: { maxActiveInterns: true } } },
    });
    if (!mentor) {
      throw new AppError(
        'Mentor not found, inactive, or their expertise does not cover the internship domain',
        400,
        'MENTOR_INELIGIBLE'
      );
    }

    if (isReassignment || mentorId !== previousMentorId) {
      const activeCount = await prisma.internship.count({
        where: { mentorId, status: { in: ACTIVE_ASSIGNMENT_STATUSES }, id: { not: internshipId } },
      });
      if (activeCount >= (mentor.mentorProfile?.maxActiveInterns ?? 0)) {
        throw new AppError('Mentor has reached their active-internship capacity', 400, 'MENTOR_AT_CAPACITY');
      }
    }

    const updated = await prisma.internship.update({
      where: { id: internshipId },
      data: { mentorId },
      include: { mentor: { select: { id: true, fullName: true, email: true } } },
    });

    await createAuditLog({
      actorId: adminId,
      action: isReassignment ? AuditAction.INTERNSHIP_MENTOR_REASSIGNED : AuditAction.INTERNSHIP_MENTOR_ASSIGNED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { mentorId: previousMentorId },
      newValue: { mentorId },
      reason,
    });

    await notify(mentorId, {
      type: 'MENTOR_ASSIGNED',
      title: isReassignment ? 'New intern assigned' : 'You have been assigned an intern',
      message: `You are the mentor for "${internship.program.title}".`,
      link: `/mentor/internships/${internshipId}`,
    });
    await notify(internship.userId, {
      type: 'MENTOR_ASSIGNED',
      title: 'Mentor assigned',
      message: `${mentor.fullName} is now your mentor for "${internship.program.title}".`,
      link: `/internships/${internshipId}`,
    });

    // FR-080: activation is possible the moment mentor + project exist and the start date arrived.
    await this.tryAutoActivate(internshipId, adminId);

    return updated;
  }

  /**
   * FR-048/049: assign a PUBLISHED project with a matching domain (DEC-011:
   * domain match only) and instantiate milestones/tasks with due dates derived
   * from the internship start date. Assignment is once-only while PENDING_START.
   */
  async assignProject(adminId: string, internshipId: string, projectId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { program: { select: { domainId: true, title: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (internship.status !== 'PENDING_START') {
      throw new AppError('Projects can only be assigned before the internship starts', 400, 'INTERNSHIP_ALREADY_STARTED');
    }
    if (internship.projectId) {
      throw new AppError('A project is already assigned to this internship', 409, 'PROJECT_ALREADY_ASSIGNED');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { order: 'asc' }, include: { tasks: { orderBy: { order: 'asc' }, include: { dependencies: true } } } },
      },
    });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.status !== 'PUBLISHED') {
      throw new AppError('Only published projects can be assigned', 400, 'PROJECT_NOT_PUBLISHED');
    }
    if (project.domainId !== internship.program.domainId) {
      // DEC-011: domain match is the only eligibility rule for assignment.
      throw new AppError('Project domain must match the internship domain', 400, 'DOMAIN_MISMATCH');
    }
    if (project.milestones.length === 0 || project.milestones.every((m) => m.tasks.length === 0)) {
      throw new AppError('Project has no milestones/tasks to instantiate', 400, 'PROJECT_EMPTY');
    }

    const internshipStartDate = internship.startDate;

    const result = await prisma.$transaction(async (tx) => {
      const linked = await tx.internship.update({
        where: { id: internshipId, status: 'PENDING_START', projectId: null },
        data: { projectId },
      });

      // FR-046/FR-049: independent copies of the definition.
      for (const milestone of project.milestones) {
        const internMilestone = await tx.internMilestone.create({
          data: {
            internshipId,
            title: milestone.title,
            description: milestone.description,
            order: milestone.order,
            isRequired: milestone.isRequired,
          },
        });

        for (const task of milestone.tasks) {
          await tx.internTask.create({
            data: {
              internshipId,
              internMilestoneId: internMilestone.id,
              sourceTaskId: task.id,
              title: task.title,
              description: task.description,
              acceptanceCriteria: task.acceptanceCriteria,
              isMandatory: task.isMandatory,
              evidenceTypes: task.evidenceTypes,
              dueDate: new Date(internshipStartDate.getTime() + task.dueOffsetDays * DAY_MS),
            },
          });
        }
      }

      return linked;
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.INTERNSHIP_PROJECT_ASSIGNED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { projectId: null },
      newValue: { projectId, instancesCreated: true },
    });

    await notify(internship.userId, {
      type: 'PROJECT_ASSIGNED',
      title: 'Project assigned',
      message: `"${project.title}" was assigned to your internship "${internship.program.title}".`,
      link: `/internships/${internshipId}`,
    });

    // FR-080: mentor + project may now both be present — auto-activate if due.
    await this.tryAutoActivate(internshipId, adminId);

    return result;
  }

  /** FR-080: PENDING_START → ACTIVE when start date reached AND mentor AND project assigned. */
  private async tryAutoActivate(internshipId: string, actorId: string | null) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { status: true, startDate: true, mentorId: true, projectId: true, userId: true, program: { select: { title: true } } },
    });
    if (!internship) return;
    if (internship.status !== 'PENDING_START') return;
    if (!internship.mentorId || !internship.projectId) return;
    if (internship.startDate.getTime() > Date.now()) return; // scheduler activates on the start date

    await this.activate(internshipId, actorId);
  }

  /** Explicit activation (admin or scheduler); enforces the FR-080 guard. */
  async activate(internshipId: string, actorId: string | null) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      select: { status: true, startDate: true, mentorId: true, projectId: true, userId: true, program: { select: { title: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (internship.status !== 'PENDING_START') {
      throw new AppError(`Internship in status ${internship.status} cannot be activated`, 400, 'INVALID_TRANSITION');
    }
    if (!internship.mentorId || !internship.projectId) {
      throw new AppError(
        'An internship can only start once a mentor and a project have been assigned',
        400,
        'ACTIVATION_REQUIREMENTS_MISSING'
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.internship.updateMany({
        where: { id: internshipId, status: 'PENDING_START' },
        data: { status: 'ACTIVE' },
      });
      if (moved.count !== 1) throw new AppError('Internship state changed concurrently', 409, 'CONCURRENT_UPDATE');

      await tx.internshipStatusHistory.create({
        data: {
          internshipId,
          fromStatus: 'PENDING_START',
          toStatus: 'ACTIVE',
          changedBy: actorId,
          reason: 'Start date reached with mentor and project assigned (FR-CAND-080)',
        },
      });

      return tx.internship.findUniqueOrThrow({ where: { id: internshipId } });
    });

    await createAuditLog({
      actorId: actorId ?? undefined,
      action: AuditAction.INTERNSHIP_ACTIVATED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { status: 'PENDING_START' },
      newValue: { status: 'ACTIVE' },
    });

    await notify(internship.userId, {
      type: 'INTERNSHIP_ACTIVATED',
      title: 'Your internship has started',
      message: `"${internship.program.title}" is now active. Your first tasks are waiting.`,
      link: `/internships/${internshipId}`,
    });

    return updated;
  }

  /** FR-082: one extension, capped by the configured maximum, reason mandatory. */
  async extend(adminId: string, internshipId: string, days: number, reason: string) {
    const internship = await prisma.internship.findUnique({ where: { id: internshipId } });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (!['ACTIVE', 'UNDER_EVALUATION'].includes(internship.status)) {
      throw new AppError('Only an active internship can be extended', 400, 'INVALID_TRANSITION');
    }
    if (internship.extensionDate) {
      throw new AppError('An internship can only be extended once', 409, 'ALREADY_EXTENDED');
    }

    const maxDays = await getSetting<number>('extensionMaxDays');
    if (days > maxDays) {
      throw new AppError(`Extension exceeds the configured maximum of ${maxDays} days`, 400, 'EXTENSION_TOO_LONG');
    }

    const newEndDate = new Date(internship.endDate.getTime() + days * DAY_MS);
    // P2-06 fix (comprehensive audit 2026-11-15): the update is conditional on
    // `extensionDate` still being null, so two concurrent extends cannot both
    // pass the check above and double-extend.
    const updatedRows = await prisma.internship.updateMany({
      where: { id: internshipId, extensionDate: null },
      data: { endDate: newEndDate, extensionDate: newEndDate, extensionReason: reason },
    });
    if (updatedRows.count !== 1) {
      throw new AppError('An internship can only be extended once', 409, 'ALREADY_EXTENDED');
    }
    const updated = await prisma.internship.findUniqueOrThrow({ where: { id: internshipId } });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.INTERNSHIP_EXTENDED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { endDate: internship.endDate },
      newValue: { endDate: newEndDate, days },
      reason,
    });

    await notify(internship.userId, {
      type: 'INTERNSHIP_EXTENDED',
      title: 'Internship extended',
      message: `Your internship end date moved to ${newEndDate.toISOString().slice(0, 10)}: ${reason}`,
      link: `/internships/${internshipId}`,
    });

    return updated;
  }

  /** FR-084: admin terminates from ACTIVE/UNDER_EVALUATION only (UND-16). */
  async terminate(adminId: string, internshipId: string, reason: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { program: { select: { title: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (!['ACTIVE', 'UNDER_EVALUATION'].includes(internship.status)) {
      throw new AppError('Only an ACTIVE or UNDER_EVALUATION internship can be terminated', 400, 'INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.internship.updateMany({
        where: { id: internshipId, status: { in: ['ACTIVE', 'UNDER_EVALUATION'] } },
        data: { status: 'TERMINATED', terminationReason: reason },
      });
      if (moved.count !== 1) throw new AppError('Internship state changed concurrently', 409, 'CONCURRENT_UPDATE');

      await tx.internshipStatusHistory.create({
        data: {
          internshipId,
          fromStatus: internship.status,
          toStatus: 'TERMINATED',
          changedBy: adminId,
          reason,
        },
      });

      return tx.internship.findUniqueOrThrow({ where: { id: internshipId } });
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.INTERNSHIP_TERMINATED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { status: internship.status },
      newValue: { status: 'TERMINATED' },
      reason,
    });

    await notify(internship.userId, {
      type: 'INTERNSHIP_TERMINATED',
      title: 'Internship terminated',
      message: `Your internship "${internship.program.title}" was terminated: ${reason}`,
      link: `/internships/${internshipId}`,
    });

    return updated;
  }

  /**
   * FR-081 / BR-CAND-029: mark COMPLETED. Conditions verified SERVER-SIDE:
   *   (a) all mandatory task instances APPROVED
   *   (b) all required milestones complete (no mandatory pending tasks)
   *   (c) final evaluation submitted
   *   (d) final score ≥ the internship's FROZEN completion threshold (before rounding, DEC-003)
   *   (e) mentor recommendation is COMPLETE or COMPLETE_WITH_APPRECIATION
   *   (f) this admin action IS the checklist confirmation
   *   (g) open blocking reports — UND-03/TEMP-18, deferred
   */
  async completeChecklist(adminId: string, internshipId: string) {
    const internship = await prisma.internship.findUnique({
      where: { id: internshipId },
      include: { evaluation: true, program: { select: { title: true } } },
    });
    if (!internship) throw new AppError('Internship not found', 404, 'INTERNSHIP_NOT_FOUND');
    if (internship.status !== 'UNDER_EVALUATION') {
      throw new AppError(
        'Only an internship UNDER_EVALUATION can be completed — transition it first (FR-CAND-073)',
        400,
        'INVALID_TRANSITION'
      );
    }

    const failures: string[] = [];

    // (a)
    const pendingMandatory = await prisma.internTask.count({
      where: { internshipId, isMandatory: true, status: { not: 'APPROVED' } },
    });
    if (pendingMandatory > 0) failures.push(`(a) ${pendingMandatory} mandatory task instance(s) are not APPROVED`);

    // (b): required milestones with at least one mandatory task not APPROVED
    const requiredMilestones = await prisma.internMilestone.findMany({
      where: { internshipId, isRequired: true },
      include: { tasks: { where: { isMandatory: true, status: { not: 'APPROVED' } }, select: { id: true } } },
    });
    const incompleteMilestones = requiredMilestones.filter((m) => m.tasks.length > 0);
    if (incompleteMilestones.length > 0) {
      failures.push(`(b) ${incompleteMilestones.length} required milestone(s) still have pending mandatory tasks`);
    }

    // (c)(d)(e)
    const evaluation = internship.evaluation;
    if (!evaluation) {
      failures.push('(c) the final evaluation has not been submitted');
    } else {
      // (c) P1-05 fix (comprehensive audit 2026-11-15): the authoritative
      // evaluation state is a LOCKED evaluation that postdates the most recent
      // task approval. An unlocked row means a re-evaluation was approved but
      // not yet re-submitted; an evaluation older than the latest task
      // approval predates reworked work. Either way the scores are stale and
      // must not authorise completion.
      const latestApproval = await prisma.internTask.findFirst({
        where: { internshipId, completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      if (!evaluation.locked) {
        failures.push('(c) the evaluation is unlocked pending re-submission (a re-evaluation was approved) — it cannot authorise completion');
      } else if (
        latestApproval?.completedAt &&
        evaluation.submittedAt &&
        evaluation.submittedAt.getTime() < latestApproval.completedAt.getTime()
      ) {
        failures.push('(c) the evaluation predates the most recent approved task work — it is stale and cannot authorise completion');
      }
      // (d) — threshold before rounding (DEC-003): raw float comparison
      if (evaluation.finalScore < internship.completionThreshold) {
        failures.push(
          `(d) final score ${evaluation.finalScore} is below the internship's frozen completion threshold ${internship.completionThreshold}`
        );
      }
      // (e)
      if (!['COMPLETE', 'COMPLETE_WITH_APPRECIATION'].includes(evaluation.recommendation)) {
        failures.push(`(e) mentor recommendation is ${evaluation.recommendation}, not a completion recommendation`);
      }
    }

    if (failures.length > 0) {
      throw new AppError(
        `Completion checklist failed: ${failures.join('; ')}`,
        400,
        'COMPLETION_CHECKLIST_FAILED',
        { failures }
      );
    }

    // (f) — the admin's explicit action here IS the checklist verification.
    const updated = await prisma.$transaction(async (tx) => {
      const moved = await tx.internship.updateMany({
        where: { id: internshipId, status: 'UNDER_EVALUATION' },
        data: { status: 'COMPLETED', completedAt: new Date(), completedBy: adminId },
      });
      if (moved.count !== 1) throw new AppError('Internship state changed concurrently', 409, 'CONCURRENT_UPDATE');

      await tx.internshipStatusHistory.create({
        data: {
          internshipId,
          fromStatus: 'UNDER_EVALUATION',
          toStatus: 'COMPLETED',
          changedBy: adminId,
          reason: 'BR-CAND-029 checklist (a)-(f) verified; (g) deferred (UND-03/TEMP-18)',
        },
      });

      return tx.internship.findUniqueOrThrow({ where: { id: internshipId } });
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.INTERNSHIP_COMPLETED,
      entityType: 'Internship',
      entityId: internshipId,
      oldValue: { status: 'UNDER_EVALUATION' },
      newValue: { status: 'COMPLETED', completionThreshold: internship.completionThreshold, finalScore: evaluation!.finalScore },
      reason: 'Completion checklist (a)-(f) verified',
    });

    await notify(internship.userId, {
      type: 'INTERNSHIP_COMPLETED',
      title: 'Congratulations — internship completed',
      message: `"${internship.program.title}" was marked COMPLETED. Your certificate can now be prepared.`,
      link: `/internships/${internshipId}`,
    });

    return updated;
  }
}

export const internshipAdminService = new InternshipAdminService();
