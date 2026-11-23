// Application Controller
// HTTP handlers for application lifecycle

import type { Request, Response } from 'express';
import { applicationService } from './application.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import type { CreateApplicationInput, AdminDecisionInput } from './application.validation';

export const listMyApplications = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const result = await applicationService.listMyApplications(req.user!.id, {
    status: query.status as 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | undefined,
    programId: query.programId,
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });
  res.json(result);
});

export const getMyApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.getMyApplication(req.user!.id, req.params.id as string);
  res.json({ data: application });
});

export const createDraft = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.createDraft(req.user!.id, req.body as CreateApplicationInput);
  res.status(201).json({ data: application, message: 'Application draft created' });
});

export const updateDraft = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.updateDraft(
    req.user!.id,
    req.params.id as string,
    req.body as { statementOfInterest?: string }
  );
  res.json({ data: application, message: 'Draft updated' });
});

export const submitApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.submit(req.user!.id, req.params.id as string);
  res.json({ data: application, message: 'Application submitted' });
});

export const withdrawApplication = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const application = await applicationService.withdraw(req.user!.id, req.params.id as string, reason);
  res.json({ data: application, message: 'Application withdrawn' });
});

export const acceptApplication = asyncHandler(async (req: Request, res: Response) => {
  const result = await applicationService.accept(req.user!.id, req.params.id as string);
  res.json({ data: result, message: 'Application accepted, internship created' });
});

export const declineApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.decline(req.user!.id, req.params.id as string);
  res.json({ data: application, message: 'Application declined' });
});

export const listAllApplications = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const result = await applicationService.listAll({
    status: query.status as 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'WITHDRAWN' | undefined,
    programId: query.programId,
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  }, req.user!);
  res.json(result);
});

// Reviewer handlers below serve both /api/admin/applications (ADMIN) and
// /api/mentor/applications (MENTOR); the service limits mentors to their
// expertise domains.
export const getApplication = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationService.getById(req.params.id as string, req.user!);
  res.json({ data: application });
});

export const adminDecision = asyncHandler(async (req: Request, res: Response) => {
  const decision = req.body as AdminDecisionInput;
  await applicationService.assertCanReview(req.user!, req.params.id as string);
  const application = await applicationService.adminDecision(req.params.id as string, req.user!.id, decision);
  // BE-10: admin decisions are audited with actor, action, and reason
  await createAuditLog({
    actorId: req.user!.id,
    action: decision.status === 'APPROVED' ? AuditAction.APPLICATION_APPROVED : AuditAction.APPLICATION_REJECTED,
    entityType: 'Application',
    entityId: application.id,
    newValue: {
      id: application.id,
      status: decision.status,
      programId: application.programId,
      decidedByRole: req.user!.role,
    },
    reason: decision.reason ?? undefined,
  });
  res.json({ data: application, message: `Application ${decision.status.toLowerCase()}` });
});

// BE-14: review-start transition (SUBMITTED → UNDER_REVIEW)
export const underReviewApplication = asyncHandler(async (req: Request, res: Response) => {
  await applicationService.assertCanReview(req.user!, req.params.id as string);
  const application = await applicationService.startUnderReview(req.params.id as string, req.user!.id);
  // BE-10: admin workflow transitions are audited
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.APPLICATION_REVIEW_STARTED,
    entityType: 'Application',
    entityId: application.id,
    newValue: { id: application.id, status: 'UNDER_REVIEW' },
    reason: 'Review started',
  });
  res.json({ data: application, message: 'Application moved to review' });
});