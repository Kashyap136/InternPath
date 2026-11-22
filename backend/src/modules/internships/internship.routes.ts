// Internship Routes (Sprint 3/4)
//
// Student surface  /api/internships            â€” own internships, task ops, submissions
// Mentor surface   /api/mentor/*               â€” assigned internships, review queue, decisions
// Admin surface    /api/admin/internships      â€” assignment, lifecycle, completion checklist
//
// RBAC: mentors can only touch internships assigned to them (404 otherwise);
// students can only touch their own internships (404 otherwise). Admin
// endpoints require the ADMIN role via requireRole.

import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import {
  listMyInternships,
  getMyInternship,
  listMyInternshipTasks,
  getMyInternshipTask,
  startInternshipTask,
  submitInternshipTask,
  withdrawInternship,
  listAssignedInternships,
  getAssignedInternship,
  getReviewQueue,
  startTaskReview,
  decideSubmissionReview,
  reopenApprovedTask,
  changeTaskDueDate,
  submitEvaluation,
  getMyEvaluation,
  getEvaluationForMentor,
  getActiveRubric,
  adminListInternships,
  adminGetInternship,
  getEligibleMentors,
  adminApproveReEvaluation,
  assignMentor,
  assignProject,
  activateInternship,
  extendInternship,
  terminateInternship,
  completeInternship,
} from './internship.controller';
import {
  listInternshipsQuery,
  adminListInternshipsQuery,
  internshipIdParams,
  withdrawSchema,
  internshipTaskParams,
  submissionSchema,
  reviewSchema,
  reopenTaskSchema,
  changeDueDateSchema,
  assignMentorSchema,
  assignProjectSchema,
  extendSchema,
  terminateSchema,
  completeSchema,
  evaluationSchema,
  reEvaluationSchema,
  internTaskIdParams,
} from './internship.validation';

const studentRouter: Router = Router();

studentRouter.get('/', authMiddleware, requireRole('STUDENT'), validate(listInternshipsQuery), asyncHandler(listMyInternships));
studentRouter.get('/:id', authMiddleware, requireRole('STUDENT'), validate(internshipIdParams), asyncHandler(getMyInternship));
studentRouter.get('/:id/tasks', authMiddleware, requireRole('STUDENT'), validate(internshipIdParams), asyncHandler(listMyInternshipTasks));
studentRouter.get('/:id/tasks/:taskId', authMiddleware, requireRole('STUDENT'), validate(internshipTaskParams), asyncHandler(getMyInternshipTask));
studentRouter.post('/:id/tasks/:taskId/start', authMiddleware, requireRole('STUDENT'), validate(internshipTaskParams), asyncHandler(startInternshipTask));
studentRouter.post('/:id/tasks/:taskId/submissions', authMiddleware, requireRole('STUDENT'), validate(submissionSchema), asyncHandler(submitInternshipTask));
studentRouter.post('/:id/withdraw', authMiddleware, requireRole('STUDENT'), validate(withdrawSchema), asyncHandler(withdrawInternship));
studentRouter.get('/:id/evaluation', authMiddleware, requireRole('STUDENT'), validate(internshipIdParams), asyncHandler(getMyEvaluation));

// Rubric is visible to any authenticated user (FR-CAND-078)
studentRouter.get('/rubric/active', authMiddleware, asyncHandler(getActiveRubric));

// ---------------------------------------------------------------
// Mentor surface
// ---------------------------------------------------------------

const mentorRouter: Router = Router();

mentorRouter.use(authMiddleware, requireRole('MENTOR'));
mentorRouter.get('/internships', validate(listInternshipsQuery), asyncHandler(listAssignedInternships));
mentorRouter.get('/internships/:id', validate(internshipIdParams), asyncHandler(getAssignedInternship));
mentorRouter.get('/review-queue', asyncHandler(getReviewQueue));
mentorRouter.post('/tasks/:internTaskId/start-review', validate(internTaskIdParams), asyncHandler(startTaskReview));
mentorRouter.post('/tasks/:internTaskId/review', validate(reviewSchema), asyncHandler(decideSubmissionReview));
mentorRouter.post('/tasks/:internTaskId/reopen', validate(reopenTaskSchema), asyncHandler(reopenApprovedTask));
mentorRouter.post('/tasks/:internTaskId/due-date', validate(changeDueDateSchema), asyncHandler(changeTaskDueDate));
mentorRouter.post('/internships/:id/evaluation', validate(evaluationSchema), asyncHandler(submitEvaluation));
mentorRouter.get('/internships/:id/evaluation', validate(internshipIdParams), asyncHandler(getEvaluationForMentor));

// ---------------------------------------------------------------
// Admin surface
// ---------------------------------------------------------------

const adminRouter: Router = Router();

adminRouter.use(authMiddleware, requireRole('ADMIN'));
adminRouter.get('/', validate(adminListInternshipsQuery), asyncHandler(adminListInternships));
adminRouter.get('/:id', validate(internshipIdParams), asyncHandler(adminGetInternship));
adminRouter.get('/:id/eligible-mentors', validate(internshipIdParams), asyncHandler(getEligibleMentors));
adminRouter.post('/:id/assign-mentor', validate(assignMentorSchema), asyncHandler(assignMentor));
adminRouter.post('/:id/assign-project', validate(assignProjectSchema), asyncHandler(assignProject));
adminRouter.post('/:id/activate', validate(internshipIdParams), asyncHandler(activateInternship));
adminRouter.post('/:id/extend', validate(extendSchema), asyncHandler(extendInternship));
adminRouter.post('/:id/terminate', validate(terminateSchema), asyncHandler(terminateInternship));
adminRouter.post('/:id/complete', validate(completeSchema), asyncHandler(completeInternship));
adminRouter.post('/:id/re-evaluation', validate(reEvaluationSchema), asyncHandler(adminApproveReEvaluation));

export { studentRouter as internshipRoutes, mentorRouter, adminRouter as internshipAdminRouter };
