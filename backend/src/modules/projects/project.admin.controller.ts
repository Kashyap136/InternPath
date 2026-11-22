// Project Admin Controller (Sprint 3 â€” FR-CAND-041/042)

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { projectService } from './project.service';
import type { ListProjectsQuery } from './project.validation';

export const adminListProjects = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const result = await projectService.list(req.user!.id, 'ADMIN', {
    domainId: q.domainId,
    sourceType: q.sourceType as ListProjectsQuery['sourceType'],
    difficulty: q.difficulty as ListProjectsQuery['difficulty'],
    minDurationWeeks: q.minDurationWeeks ? Number(q.minDurationWeeks) : undefined,
    maxDurationWeeks: q.maxDurationWeeks ? Number(q.maxDurationWeeks) : undefined,
    status: q.status as ListProjectsQuery['status'],
    search: q.search,
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    mine: q.mine === 'true',
  });
  res.json(result);
});

export const adminReviewProject = asyncHandler(async (req: Request, res: Response) => {
  const { decision, comments } = req.body as { decision: 'APPROVED' | 'REJECTED'; comments?: string };
  const project = await projectService.adminReview(req.params.id as string, req.user!.id, req.user!.role, decision, comments);
  res.json({
    data: project,
    message: decision === 'APPROVED' ? 'Project approved â€” it can now be published' : 'Project returned to draft with comments',
  });
});

export const publishProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.publish(req.params.id as string, req.user!.id);
  res.json({ data: project, message: 'Project published' });
});

export const unpublishProject = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason?: string };
  if (!reason?.trim()) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A reason is required to archive a project' });
    return;
  }
  const project = await projectService.unpublish(req.params.id as string, req.user!.id, reason.trim());
  res.json({ data: project, message: 'Project archived â€” it can no longer be assigned to new internships' });
});
