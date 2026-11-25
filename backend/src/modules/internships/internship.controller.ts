// Internship Controllers â€” student, mentor, admin + evaluation (Sprint 3/4)

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { internshipService } from './internship.service';
import { internshipAdminService } from './internship.admin.service';
import { evaluationService } from './evaluation.service';

// ---- Student ----

export const listMyInternships = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.listMine(req.user!.id, {
    status: req.query.status as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getMyInternship = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.getMine(req.user!.id, req.params.id as string);
  res.json(result);
});

export const listMyInternshipTasks = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.listMyTasks(req.user!.id, req.params.id as string);
  res.json(result);
});

export const getMyInternshipTask = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.getMyTask(req.user!.id, req.params.id as string, req.params.taskId as string);
  res.json(result);
});

export const startInternshipTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await internshipService.startTask(req.user!.id, req.params.id as string, req.params.taskId as string);
  res.json({ data: task, message: 'Task started' });
});

export const submitInternshipTask = asyncHandler(async (req: Request, res: Response) => {
  const submission = await internshipService.submitTask(req.user!.id, req.params.id as string, req.params.taskId as string, req.body as { repositoryUrl?: string; commitRef?: string; documentUrl?: string; liveDemoUrl?: string; notes?: string });
  res.status(201).json({ data: submission, message: 'Submission recorded' });
});

export const withdrawInternship = asyncHandler(async (req: Request, res: Response) => {
  const internship = await internshipService.withdraw(req.user!.id, req.params.id as string, (req.body as { reason: string }).reason);
  res.json({ data: internship, message: 'Internship withdrawn' });
});

// ---- Mentor surface (assigned internships; admins see all) ----

export const listAssignedInternships = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.listAssigned(req.user!, {
    status: req.query.status as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getAssignedInternship = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.getAssigned(req.user!, req.params.id as string);
  res.json(result);
});

export const getReviewQueue = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipService.reviewQueue(req.user!);
  res.json(result);
});

export const startTaskReview = asyncHandler(async (req: Request, res: Response) => {
  const task = await internshipService.startReview(req.user!, req.params.internTaskId as string);
  res.json({ data: task, message: 'Task moved to review' });
});

export const decideSubmissionReview = asyncHandler(async (req: Request, res: Response) => {
  const { decision, comment } = req.body as { decision: 'APPROVED' | 'CHANGES_REQUESTED'; comment: string };
  const result = await internshipService.decideSubmission(req.user!, req.params.internTaskId as string, decision, comment);
  res.json({
    data: result,
    message: decision === 'APPROVED' ? 'Submission approved' : 'Changes requested',
  });
});

export const reopenApprovedTask = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const task = await internshipService.reopenApprovedTask(
    req.user!,
    req.params.internTaskId as string,
    reason
  );
  res.json({ data: task, message: 'Task reopened - the intern has been notified' });
});

export const changeTaskDueDate = asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, reason } = req.body as { dueDate: Date; reason: string };
  const task = await internshipService.changeDueDate(req.user!, req.params.internTaskId as string, new Date(dueDate), reason);
  res.json({ data: task, message: 'Due date changed' });
});

// ---- Evaluation (mentor submits; student reads) ----

export const submitEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { criterionScores, recommendation, remarks } = req.body as {
    criterionScores: { criterionId: string; score: number }[];
    recommendation: 'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE';
    remarks?: string;
  };
  const evaluation = await evaluationService.submit(
    req.user!,
    req.params.id as string,
    criterionScores,
    recommendation,
    remarks
  );
  res.status(201).json({ data: evaluation, message: 'Final evaluation submitted' });
});

export const getMyEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const result = await evaluationService.getForStudent(req.user!.id, req.params.id as string);
  res.json(result);
});

export const getEvaluationForMentor = asyncHandler(async (req: Request, res: Response) => {
  const result = await evaluationService.getForMentor(req.user!, req.params.id as string);
  res.json(result);
});

export const getActiveRubric = asyncHandler(async (_req: Request, res: Response) => {
  const result = await evaluationService.getActiveRubric();
  res.json(result);
});

// ---- Admin ----

export const adminListInternships = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipAdminService.adminList({
    status: req.query.status as string | undefined,
    delayed: req.query.delayed === 'true',
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const adminGetInternship = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipAdminService.adminGet(req.params.id as string);
  res.json(result);
});

export const getEligibleMentors = asyncHandler(async (req: Request, res: Response) => {
  const result = await internshipAdminService.eligibleMentors(req.params.id as string);
  res.json(result);
});

export const assignMentor = asyncHandler(async (req: Request, res: Response) => {
  const { mentorId, reason } = req.body as { mentorId: string; reason?: string };
  const internship = await internshipAdminService.assignMentor(req.user!.id, req.params.id as string, mentorId, reason);
  res.json({ data: internship, message: 'Mentor assigned' });
});

export const assignProject = asyncHandler(async (req: Request, res: Response) => {
  const { projectId } = req.body as { projectId: string };
  const internship = await internshipAdminService.assignProject(req.user!.id, req.params.id as string, projectId);
  res.json({ data: internship, message: 'Project assigned and task instances created' });
});

export const activateInternship = asyncHandler(async (req: Request, res: Response) => {
  const internship = await internshipAdminService.activate(req.params.id as string, req.user!.id);
  res.json({ data: internship, message: 'Internship activated' });
});

export const extendInternship = asyncHandler(async (req: Request, res: Response) => {
  const { days, reason } = req.body as { days: number; reason: string };
  const internship = await internshipAdminService.extend(req.user!.id, req.params.id as string, days, reason);
  res.json({ data: internship, message: `Internship extended by ${days} day(s)` });
});

export const terminateInternship = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const internship = await internshipAdminService.terminate(req.user!.id, req.params.id as string, reason);
  res.json({ data: internship, message: 'Internship terminated' });
});

export const completeInternship = asyncHandler(async (req: Request, res: Response) => {
  const internship = await internshipAdminService.completeChecklist(req.user!.id, req.params.id as string);
  res.json({ data: internship, message: 'Internship completed â€” checklist verified' });
});

export const adminApproveReEvaluation = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const evaluation = await evaluationService.approveReEvaluation(req.user!.id, req.params.id as string, reason);
  res.json({ data: evaluation, message: 'Re-evaluation approved - the mentor can now update the evaluation' });
});
