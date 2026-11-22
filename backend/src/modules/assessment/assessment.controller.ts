// Assessment Controller
// HTTP handlers for question bank and assessment attempts

import type { Request, Response } from 'express';
import { assessmentService } from './assessment.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import type { CreateQuestionInput, UpdateQuestionInput, SubmitAnswerInput } from './assessment.validation';

export const listQuestions = asyncHandler(async (req: Request, res: Response) => {
  const questions = await assessmentService.listQuestions(req.params.domainId as string);
  res.json({ data: questions });
});

export const getQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await assessmentService.getQuestion(req.params.id as string);
  res.json({ data: question });
});

export const createQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await assessmentService.createQuestion(req.params.domainId as string, req.body as CreateQuestionInput);
  // BE-10: question bank changes are audited (actor + entity; answer key is
  // deliberately NOT written to the audit trail)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.QUESTION_CREATED,
    entityType: 'AssessmentQuestion',
    entityId: question.id,
    newValue: { id: question.id, domainId: question.domainId, skillId: question.skillId, isActive: question.isActive },
  });
  res.status(201).json({ data: question, message: 'Question created' });
});

export const updateQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await assessmentService.updateQuestion(req.params.id as string, req.body as UpdateQuestionInput);
  // BE-10: question bank changes are audited (actor + entity; answer key is
  // deliberately NOT written to the audit trail)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.QUESTION_UPDATED,
    entityType: 'AssessmentQuestion',
    entityId: question.id,
    newValue: { id: question.id, skillId: question.skillId, isActive: question.isActive },
  });
  res.json({ data: question, message: 'Question updated' });
});

export const deleteQuestion = asyncHandler(async (req: Request, res: Response) => {
  const question = await assessmentService.deleteQuestion(req.params.id as string);
  // BE-10: question bank changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.QUESTION_DELETED,
    entityType: 'AssessmentQuestion',
    entityId: question.id,
    oldValue: { id: question.id, domainId: question.domainId, skillId: question.skillId },
  });
  res.json({ message: 'Question deleted' });
});

export const startAttempt = asyncHandler(async (req: Request, res: Response) => {
  const result = await assessmentService.startAttempt(req.user!.id, req.params.domainId as string);
  res.json({ data: result });
});

export const getAttempt = asyncHandler(async (req: Request, res: Response) => {
  const attempt = await assessmentService.getAttempt(req.params.id as string, req.user!.id);
  res.json({ data: attempt });
});

export const submitAnswer = asyncHandler(async (req: Request, res: Response) => {
  const answer = await assessmentService.submitAnswer(req.params.attemptId as string, req.user!.id, req.body as SubmitAnswerInput);
  // BE-02: response carries only the neutral receipt — no correctness data
  res.json({ data: answer });
});

export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const result = await assessmentService.submitAttempt(req.params.id as string, req.user!.id);
  res.json({ data: result });
});

export const listAttempts = asyncHandler(async (req: Request, res: Response) => {
  const attempts = await assessmentService.listAttempts(req.user!.id);
  res.json({ data: attempts });
});

export const listLevelRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await assessmentService.listLevelRules(req.params.domainId as string);
  res.json({ data: rules });
});
