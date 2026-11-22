// Assessment Routes
// Student assessment flows + admin question bank / level rules.
//
// BE-04 fix (audit 2026-10-20): the module router was mounted at
// /api/assessment while defining /assessment/... paths, doubling the prefix
// (/api/assessment/assessment/...). Routers are now exported per mount point.
// BE-06 fix: student attempt endpoints require the STUDENT role on the API
// surface (not only in the frontend), and admin resources live under
// /api/admin/*.

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  startAttempt,
  getAttempt,
  submitAnswer,
  submitAttempt,
  listAttempts,
  listLevelRules,
} from './assessment.controller';
import {
  createQuestionSchema,
  updateQuestionSchema,
  questionIdParamSchema,
  domainIdParamSchema,
  startAttemptSchema,
  submitAnswerSchema,
  submitAttemptSchema,
  attemptIdParamSchema,
} from './assessment.validation';

// ============================================================
// Question Bank (Admin)
// ============================================================

// Mounted at /api/admin/domains
// GET  /api/admin/domains/:domainId/questions - List questions
// POST /api/admin/domains/:domainId/questions - Create question
const domainQuestionsAdminRouter: Router = Router();
domainQuestionsAdminRouter.get('/:domainId/questions', authMiddleware, requireRole('ADMIN'), validate(domainIdParamSchema), asyncHandler(listQuestions));
domainQuestionsAdminRouter.post('/:domainId/questions', authMiddleware, requireRole('ADMIN'), validate(createQuestionSchema), asyncHandler(createQuestion));

// Mounted at /api/admin/questions
// GET    /api/admin/questions/:id - Get question
// PUT    /api/admin/questions/:id - Update question
// DELETE /api/admin/questions/:id - Delete question
const questionsAdminRouter: Router = Router();
questionsAdminRouter.get('/:id', authMiddleware, requireRole('ADMIN'), validate(questionIdParamSchema), asyncHandler(getQuestion));
questionsAdminRouter.put('/:id', authMiddleware, requireRole('ADMIN'), validate(updateQuestionSchema), asyncHandler(updateQuestion));
questionsAdminRouter.delete('/:id', authMiddleware, requireRole('ADMIN'), validate(questionIdParamSchema), asyncHandler(deleteQuestion));

// ============================================================
// Level Rules (Admin)
// ============================================================

// Mounted at /api/admin/domains
// GET /api/admin/domains/:domainId/level-rules - List level rules
const levelRulesAdminRouter: Router = Router();
levelRulesAdminRouter.get('/:domainId/level-rules', authMiddleware, requireRole('ADMIN'), validate(domainIdParamSchema), asyncHandler(listLevelRules));

// ============================================================
// Assessment Attempts (Student)
// ============================================================

// Mounted at /api/assessment
const studentRouter: Router = Router();

// POST /api/assessment/:domainId/start - Start assessment attempt
studentRouter.post('/:domainId/start', authMiddleware, requireRole('STUDENT'), validate(startAttemptSchema), asyncHandler(startAttempt));

// GET /api/assessment/attempt/:id - Get own attempt status
studentRouter.get('/attempt/:id', authMiddleware, requireRole('STUDENT'), validate(attemptIdParamSchema), asyncHandler(getAttempt));

// POST /api/assessment/attempt/:attemptId/answer - Submit/replace answer
studentRouter.post('/attempt/:attemptId/answer', authMiddleware, requireRole('STUDENT'), validate(submitAnswerSchema), asyncHandler(submitAnswer));

// POST /api/assessment/attempt/:id/submit - Finalize attempt
studentRouter.post('/attempt/:id/submit', authMiddleware, requireRole('STUDENT'), validate(submitAttemptSchema), asyncHandler(submitAttempt));

// GET /api/assessment/attempts - List own attempts
studentRouter.get('/attempts', authMiddleware, requireRole('STUDENT'), asyncHandler(listAttempts));

export default studentRouter;
export { domainQuestionsAdminRouter, questionsAdminRouter, levelRulesAdminRouter };
