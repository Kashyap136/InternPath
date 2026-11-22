// Project Controller (Sprint 3)

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { projectService } from './project.service';
import type { CreateProjectInput, UpdateProjectInput, ListProjectsQuery } from './project.validation';

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.createDraft(req.user!.id, req.user!.role, req.body as CreateProjectInput);
  res.status(201).json({ data: project, message: 'Project draft created' });
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.updateDraft(
    req.params.id as string,
    req.user!.id,
    req.user!.role,
    req.body as UpdateProjectInput
  );
  res.json({ data: project, message: 'Project draft updated' });
});

export const submitProjectForReview = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.submitForReview(req.params.id as string, req.user!.id, req.user!.role);
  res.json({ data: project, message: 'Project submitted for administrator review' });
});

export const listProjects = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string>;
  const result = await projectService.list(req.user!.id, req.user!.role, {
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

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getById(req.params.id as string, req.user!.id, req.user!.role);
  res.json({ data: project });
});

// ---- Milestones & tasks ----

export const createMilestone = asyncHandler(async (req: Request, res: Response) => {
  const milestone = await projectService.createMilestone(
    req.params.projectId as string,
    req.user!.id,
    req.user!.role,
    req.body as { title: string; description?: string; order: number; isRequired: boolean }
  );
  res.status(201).json({ data: milestone, message: 'Milestone added to draft' });
});

export const updateMilestone = asyncHandler(async (req: Request, res: Response) => {
  const milestone = await projectService.updateMilestone(
    req.params.projectId as string,
    req.params.milestoneId as string,
    req.user!.id,
    req.user!.role,
    req.body as { title?: string; description?: string; order?: number; isRequired?: boolean }
  );
  res.json({ data: milestone, message: 'Milestone updated' });
});

export const deleteMilestone = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectService.deleteMilestone(req.params.projectId as string, req.params.milestoneId as string, req.user!.id, req.user!.role);
  res.json({ data: result, message: 'Milestone deleted' });
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectService.createTask(
    req.params.projectId as string,
    req.params.milestoneId as string,
    req.user!.id,
    req.user!.role,
    req.body as { title: string; description?: string; acceptanceCriteria?: string; isMandatory: boolean; evidenceTypes: Array<"CODE" | "DOCUMENT" | "LIVE_DEMO">; dueOffsetDays: number; order: number }
  );
  res.status(201).json({ data: task, message: 'Task added to milestone' });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await projectService.updateTask(
    req.params.projectId as string,
    req.params.taskId as string,
    req.user!.id,
    req.user!.role,
    req.body as { title?: string; description?: string; acceptanceCriteria?: string; isMandatory?: boolean; evidenceTypes?: Array<"CODE" | "DOCUMENT" | "LIVE_DEMO">; dueOffsetDays?: number; order?: number }
  );
  res.json({ data: task, message: 'Task updated' });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectService.deleteTask(req.params.projectId as string, req.params.taskId as string, req.user!.id, req.user!.role);
  res.json({ data: result, message: 'Task deleted' });
});

export const addTaskDependency = asyncHandler(async (req: Request, res: Response) => {
  const dependency = await projectService.addDependency(
    req.params.projectId as string,
    req.params.taskId as string,
    (req.body as { prerequisiteTaskId: string }).prerequisiteTaskId,
    req.user!.id,
    req.user!.role
  );
  res.status(201).json({ data: dependency, message: 'Task dependency added' });
});

export const removeTaskDependency = asyncHandler(async (req: Request, res: Response) => {
  const result = await projectService.removeDependency(
    req.params.projectId as string,
    req.params.taskId as string,
    req.params.prerequisiteTaskId as string,
    req.user!.id,
    req.user!.role
  );
  res.json({ data: result, message: 'Task dependency removed' });
});
