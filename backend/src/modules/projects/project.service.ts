// Project Service (Sprint 3 — FR-CAND-037-046, 052-055)
//
// Lifecycle: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED → ARCHIVED.
// - Drafts are editable only by their author while in DRAFT (FR-052/053).
// - FR-041: administrators approve/reject (rejection requires comments) and publish.
//   TEMP (SRS §18): a mentor who is also the reviewing administrator may approve
//   their own project; this exception is audited (TEMP-XX convention).
// - FR-042: unpublish/archive removes a project from assignment eligibility
//   without touching internships already using it.
// - FR-046: definition edits after assignment cannot alter existing internship
//   instances — instance data is copied at assignment time (internships module).

import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import { notifyAdmins, notify } from '../notifications/notification.service';
import { validateSourceDetails } from './project.validation';
import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './project.validation';

const PROJECT_INCLUDE = {
  domain: { select: { id: true, name: true } },
  author: { select: { id: true, fullName: true, role: true } },
  milestones: {
    orderBy: { order: 'asc' as const },
    include: {
      tasks: {
        orderBy: { order: 'asc' as const },
        include: {
          dependencies: { select: { prerequisiteTaskId: true } },
        },
      },
    },
  },
  _count: { select: { internships: true } },
};

export class ProjectService {
  // ============================================================
  // Draft authoring (mentor or admin)
  // ============================================================

  async createDraft(authorId: string, role: string, data: CreateProjectInput) {
    const domain = await prisma.domain.findUnique({ where: { id: data.domainId } });
    if (!domain || !domain.isActive) {
      throw new AppError('Domain not found or inactive', 404, 'DOMAIN_NOT_FOUND');
    }

    const project = await prisma.project.create({
      data: {
        ...data,
        status: 'DRAFT',
        authorId,
      },
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: authorId,
      action: AuditAction.PROJECT_CREATED,
      entityType: 'Project',
      entityId: project.id,
      newValue: { title: project.title, sourceType: project.sourceType, status: 'DRAFT' },
    });

    return project;
  }

  /** FR-052/053: only the author, only while DRAFT. */
  private async getEditableDraft(projectId: string, userId: string, role: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.authorId !== userId && role !== 'ADMIN') {
      throw new AppError('Only the project author can modify this draft', 403, 'FORBIDDEN');
    }
    if (project.status !== 'DRAFT') {
      throw new AppError('Only draft projects can be modified', 400, 'PROJECT_NOT_DRAFT');
    }
    return project;
  }

  async updateDraft(projectId: string, userId: string, role: string, data: UpdateProjectInput) {
    const project = await this.getEditableDraft(projectId, userId, role);

    if (data.domainId) {
      const domain = await prisma.domain.findUnique({ where: { id: data.domainId } });
      if (!domain || !domain.isActive) {
        throw new AppError('Domain not found or inactive', 404, 'DOMAIN_NOT_FOUND');
      }
    }

    const merged = {
      sourceType: project.sourceType,
      organizationName: project.organizationName ?? undefined,
      consentEvidenceRef: project.consentEvidenceRef ?? undefined,
      upstreamRepoUrl: project.upstreamRepoUrl ?? undefined,
      licence: project.licence ?? undefined,
      contributionGuidelineRef: project.contributionGuidelineRef ?? undefined,
      ...data,
    };
    const sourceError = validateSourceDetails(merged);
    if (sourceError) throw new AppError(sourceError, 400, 'SOURCE_DETAILS_INCOMPLETE');

    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: userId,
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'Project',
      entityId: projectId,
      oldValue: { status: project.status, title: project.title },
      newValue: { status: updated.status, title: updated.title },
    });

    return updated;
  }

  /** FR-040: author submits for review; FR-039 source details must be complete. */
  async submitForReview(projectId: string, userId: string, role: string) {
    const project = await this.getEditableDraft(projectId, userId, role);

    const sourceError = validateSourceDetails({
      sourceType: project.sourceType,
      organizationName: project.organizationName ?? undefined,
      consentEvidenceRef: project.consentEvidenceRef ?? undefined,
      upstreamRepoUrl: project.upstreamRepoUrl ?? undefined,
      licence: project.licence ?? undefined,
      contributionGuidelineRef: project.contributionGuidelineRef ?? undefined,
    });
    if (sourceError) throw new AppError(sourceError, 400, 'SOURCE_DETAILS_INCOMPLETE');

    // A reviewable project needs at least one milestone with at least one task.
    const milestoneCount = await prisma.milestone.count({ where: { projectId } });
    const taskCount = await prisma.task.count({
      where: { milestone: { projectId } },
    });
    if (milestoneCount === 0 || taskCount === 0) {
      throw new AppError(
        'Add at least one milestone with one task before submitting for review',
        400,
        'PROJECT_STRUCTURE_INCOMPLETE'
      );
    }

    const updated = await prisma.project.update({
      where: { id: projectId, status: 'DRAFT' },
      data: { status: 'PENDING_REVIEW' },
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: userId,
      action: AuditAction.PROJECT_SUBMITTED_FOR_REVIEW,
      entityType: 'Project',
      entityId: projectId,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'PENDING_REVIEW' },
    });

    await notifyAdmins({
      type: 'PROJECT_SUBMITTED',
      title: 'Project submitted for review',
      message: `"${project.title}" was submitted for review and is awaiting an administrator decision.`,
      link: '/admin/projects',
    });

    return updated;
  }

  /** FR-041: administrator approves or rejects (rejection requires comments). */
  async adminReview(projectId: string, adminId: string, adminRole: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.status !== 'PENDING_REVIEW') {
      throw new AppError('Only projects pending review can be decided', 400, 'PROJECT_NOT_PENDING_REVIEW');
    }

    if (decision === 'REJECTED' && !comments?.trim()) {
      throw new AppError('Comments are required when rejecting a project', 400, 'COMMENTS_REQUIRED');
    }

    // TEMP (SRS §18): an administrator reviewing their own project is allowed
    // and explicitly audited. Regular mentors can never reach this surface.
    const selfReview = project.authorId === adminId;

    const updated = await prisma.project.update({
      where: { id: projectId, status: 'PENDING_REVIEW' },
      data: {
        status: decision === 'APPROVED' ? 'APPROVED' : 'DRAFT',
        reviewComments: comments ?? null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: adminId,
      action: decision === 'APPROVED' ? AuditAction.PROJECT_APPROVED : AuditAction.PROJECT_REJECTED,
      entityType: 'Project',
      entityId: projectId,
      oldValue: { status: 'PENDING_REVIEW' },
      newValue: { status: updated.status, comments: comments ?? null },
      reason: selfReview ? 'TEMP: self-review by author-administrator (audited exception)' : undefined,
    });

    if (selfReview) {
      await createAuditLog({
        actorId: adminId,
        action: 'PROJECT_SELF_REVIEW',
        entityType: 'Project',
        entityId: projectId,
        newValue: { selfReview: true, decision },
        reason: 'TEMP: author-administrator reviewed their own project',
      });
    }

    await notify(project.authorId, {
      type: 'PROJECT_REVIEWED',
      title: decision === 'APPROVED' ? 'Project approved' : 'Project changes requested',
      message:
        decision === 'APPROVED'
          ? `"${project.title}" was approved by an administrator and can now be published.`
          : `"${project.title}" was not approved: ${comments}`,
      link: '/mentor/projects',
    });

    return updated;
  }

  /** FR-041: publish an approved project (admin). */
  async publish(projectId: string, adminId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.status !== 'APPROVED') {
      throw new AppError('Only approved projects can be published', 400, 'PROJECT_NOT_APPROVED');
    }

    const updated = await prisma.project.update({
      where: { id: projectId, status: 'APPROVED' },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.PROJECT_PUBLISHED,
      entityType: 'Project',
      entityId: projectId,
      oldValue: { status: 'APPROVED' },
      newValue: { status: 'PUBLISHED' },
    });

    await notify(project.authorId, {
      type: 'PROJECT_PUBLISHED',
      title: 'Project published',
      message: `"${project.title}" is now visible in the project repository and can be assigned to internships.`,
      link: '/mentor/projects',
    });

    return updated;
  }

  /** FR-042: unpublish/archive — leaves existing internships untouched. */
  async unpublish(projectId: string, adminId: string, reason: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (project.status !== 'PUBLISHED' && project.status !== 'APPROVED') {
      throw new AppError('Only published (or approved) projects can be archived', 400, 'PROJECT_NOT_PUBLISHED');
    }

    const updated = await prisma.project.update({
      where: { id: projectId, status: { in: ['PUBLISHED', 'APPROVED'] } },
      data: { status: 'ARCHIVED' },
      include: PROJECT_INCLUDE,
    });

    await createAuditLog({
      actorId: adminId,
      action: AuditAction.PROJECT_UNPUBLISHED,
      entityType: 'Project',
      entityId: projectId,
      oldValue: { status: project.status },
      newValue: { status: 'ARCHIVED' },
      reason,
    });

    return updated;
  }

  // ============================================================
  // Reads
  // ============================================================

  /**
   * FR-044: search/filter. Visibility:
   * - students → PUBLISHED only
   * - mentors → PUBLISHED + their own projects; `mine` restricts to own
   * - admins → everything
   */
  async list(viewerId: string, role: string, query: ListProjectsQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const where: Record<string, unknown> = {};
    if (query.mine && role !== 'STUDENT') {
      where.authorId = viewerId;
      if (query.status) where.status = query.status;
    } else if (role === 'STUDENT') {
      where.status = 'PUBLISHED';
    } else if (role === 'MENTOR') {
      // Mentors see published projects plus their own work in any state.
      // Fresh-audit fix (2026-11-21, AUTHZ-01): a `status` filter previously
      // REPLACED this visibility rule, so `?status=DRAFT` (or PENDING_REVIEW /
      // APPROVED / ARCHIVED) listed every other author's unpublished briefs
      // even though getById() 404s them. The filter now narrows within the
      // mentor's visibility instead of widening it.
      where.OR = [{ status: 'PUBLISHED' }, { authorId: viewerId }];
      if (query.status) where.status = query.status;
    } else if (query.status) {
      where.status = query.status; // ADMIN: unrestricted filter
    }
    if (query.domainId) where.domainId = query.domainId;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.minDurationWeeks || query.maxDurationWeeks) {
      where.durationWeeks = {
        ...(query.minDurationWeeks ? { gte: query.minDurationWeeks } : {}),
        ...(query.maxDurationWeeks ? { lte: query.maxDurationWeeks } : {}),
      };
    }
    if (query.search) {
      // Combine with any visibility OR via AND so search never widens visibility.
      const searchOr = [
        { title: { contains: query.search, mode: 'insensitive' as const } },
        { problemStatement: { contains: query.search, mode: 'insensitive' as const } },
      ];
      where.AND = [...((where.AND as unknown[] | undefined) ?? []), { OR: searchOr }];
    }

    // P0-01-pattern fix (public-release hardening 2026-11-20): the mentor
    // authoring page renders milestones and tasks from this list response,
    // but the list previously returned only `_count` — a milestone added in
    // the UI therefore vanished from view ("No milestones yet" after a
    // successful add), blocking draft structuring. The authoring view
    // (mine=true, non-student) now returns the full milestone/task tree; the
    // public catalogue keeps the compact counts payload.
    const isAuthoringView = Boolean(query.mine) && role !== 'STUDENT';
    const [data, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          domain: { select: { id: true, name: true } },
          author: { select: { id: true, fullName: true, role: true } },
          ...(isAuthoringView ? { milestones: PROJECT_INCLUDE.milestones } : {}),
          _count: { select: { milestones: true, internships: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Single project with visibility rules (FR-043 source label included via sourceType). */
  async getById(projectId: string, viewerId: string, role: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: PROJECT_INCLUDE });
    if (!project) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');

    const isOwner = project.authorId === viewerId;
    if (role === 'STUDENT' && project.status !== 'PUBLISHED') {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }
    if (role === 'MENTOR' && project.status !== 'PUBLISHED' && !isOwner) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }
    return project;
  }

  // ============================================================
  // Milestones & tasks (draft-only, author-only) — FR-CAND-052-055
  // ============================================================

  async createMilestone(projectId: string, userId: string, role: string, data: { title: string; description?: string; order: number; isRequired: boolean }) {
    await this.getEditableDraft(projectId, userId, role);
    return prisma.milestone.create({ data: { ...data, projectId } });
  }

  async updateMilestone(projectId: string, milestoneId: string, userId: string, role: string, data: { title?: string; description?: string; order?: number; isRequired?: boolean }) {
    await this.getEditableDraft(projectId, userId, role);
    const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!milestone) throw new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    return prisma.milestone.update({ where: { id: milestoneId }, data });
  }

  async deleteMilestone(projectId: string, milestoneId: string, userId: string, role: string) {
    await this.getEditableDraft(projectId, userId, role);
    const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!milestone) throw new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    await prisma.milestone.delete({ where: { id: milestoneId } }); // cascades tasks + dependencies
    return { deleted: true };
  }

  async createTask(projectId: string, milestoneId: string, userId: string, role: string, data: { title: string; description?: string; acceptanceCriteria?: string; isMandatory: boolean; evidenceTypes: ('CODE' | 'DOCUMENT' | 'LIVE_DEMO')[]; dueOffsetDays: number; order: number }) {
    await this.getEditableDraft(projectId, userId, role);
    const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
    if (!milestone) throw new AppError('Milestone not found', 404, 'MILESTONE_NOT_FOUND');
    return prisma.task.create({ data: { ...data, milestoneId } });
  }

  async updateTask(projectId: string, taskId: string, userId: string, role: string, data: { title?: string; description?: string; acceptanceCriteria?: string; isMandatory?: boolean; evidenceTypes?: ('CODE' | 'DOCUMENT' | 'LIVE_DEMO')[]; dueOffsetDays?: number; order?: number }) {
    await this.getEditableDraft(projectId, userId, role);
    const task = await prisma.task.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    return prisma.task.update({ where: { id: taskId }, data });
  }

  async deleteTask(projectId: string, taskId: string, userId: string, role: string) {
    await this.getEditableDraft(projectId, userId, role);
    const task = await prisma.task.findFirst({
      where: { id: taskId, milestone: { projectId } },
    });
    if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
    await prisma.task.delete({ where: { id: taskId } });
    return { deleted: true };
  }

  /**
   * FR-054/055: add a prerequisite edge, rejecting cycles.
   * Cycle check: walk downstream from the would-be prerequisite; if we reach
   * the task itself, adding the edge would close a loop.
   */
  async addDependency(projectId: string, taskId: string, prerequisiteTaskId: string, userId: string, role: string) {
    await this.getEditableDraft(projectId, userId, role);

    const [task, prerequisite] = await Promise.all([
      prisma.task.findFirst({ where: { id: taskId, milestone: { projectId } } }),
      prisma.task.findFirst({ where: { id: prerequisiteTaskId, milestone: { projectId } } }),
    ]);
    if (!task) throw new AppError('Task not found in this project', 404, 'TASK_NOT_FOUND');
    if (!prerequisite) throw new AppError('Prerequisite task not found in this project', 404, 'TASK_NOT_FOUND');
    if (task.id === prerequisite.id) {
      throw new AppError('A task cannot depend on itself', 400, 'DEPENDENCY_CYCLE');
    }

    const edges = await prisma.taskDependency.findMany({
      where: { task: { milestone: { projectId } } },
      select: { taskId: true, prerequisiteTaskId: true },
    });

    // adjacency: prerequisite → dependents (downstream walk from prerequisite)
    const downstream = new Map<string, string[]>();
    for (const edge of edges) {
      const list = downstream.get(edge.prerequisiteTaskId) ?? [];
      list.push(edge.taskId);
      downstream.set(edge.prerequisiteTaskId, list);
    }

    const stack = [prerequisite.id];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === task.id) {
        throw new AppError(
          'This dependency would create a cycle: the prerequisite already (transitively) depends on this task',
          400,
          'DEPENDENCY_CYCLE'
        );
      }
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of downstream.get(current) ?? []) stack.push(next);
    }

    const existing = await prisma.taskDependency.findUnique({
      where: { taskId_prerequisiteTaskId: { taskId: task.id, prerequisiteTaskId: prerequisite.id } },
    });
    if (existing) {
      throw new AppError('This dependency already exists', 409, 'DEPENDENCY_EXISTS');
    }

    return prisma.taskDependency.create({
      data: { taskId: task.id, prerequisiteTaskId: prerequisite.id },
    });
  }

  async removeDependency(projectId: string, taskId: string, prerequisiteTaskId: string, userId: string, role: string) {
    await this.getEditableDraft(projectId, userId, role);
    const edge = await prisma.taskDependency.findUnique({
      where: { taskId_prerequisiteTaskId: { taskId, prerequisiteTaskId } },
    });
    if (!edge) throw new AppError('Dependency not found', 404, 'DEPENDENCY_NOT_FOUND');
    await prisma.taskDependency.delete({ where: { id: edge.id } });
    return { deleted: true };
  }
}

export const projectService = new ProjectService();
