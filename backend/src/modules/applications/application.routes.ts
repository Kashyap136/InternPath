// Application Routes
// Student application lifecycle + admin review/decision endpoints.
//
// BE-04 fix (audit 2026-10-20): admin endpoints were previously nested as
// /api/applications/admin/... on the module-mounted router; they are now
// mounted at the documented /api/admin/applications namespace.
// BE-06 fix: the whole student surface requires the STUDENT role on the API
// (previously any authenticated role could call these endpoints).

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import {
  listMyApplications,
  getMyApplication,
  createDraft,
  updateDraft,
  submitApplication,
  withdrawApplication,
  acceptApplication,
  declineApplication,
  listAllApplications,
  getApplication,
  underReviewApplication,
  adminDecision,
} from './application.controller';
import {
  createApplicationSchema,
  submitApplicationSchema,
  updateApplicationSchema,
  withdrawApplicationSchema,
  acceptApplicationSchema,
  declineApplicationSchema,
  adminDecisionSchema,
  applicationIdParamSchema,
  listApplicationsQuerySchema,
} from './application.validation';

// Mounted at /api/applications (student-only)
const studentRouter: Router = Router();

// GET /api/applications - List own applications
studentRouter.get('/', authMiddleware, requireRole('STUDENT'), validate(listApplicationsQuerySchema), asyncHandler(listMyApplications));

// GET /api/applications/:id - Get own application
studentRouter.get('/:id', authMiddleware, requireRole('STUDENT'), validate(applicationIdParamSchema), asyncHandler(getMyApplication));

// POST /api/applications - Create draft
studentRouter.post('/', authMiddleware, requireRole('STUDENT'), validate(createApplicationSchema), asyncHandler(createDraft));

// PUT /api/applications/:id - Update draft
studentRouter.put('/:id', authMiddleware, requireRole('STUDENT'), validate(updateApplicationSchema), asyncHandler(updateDraft));

// POST /api/applications/:id/submit - Submit application
studentRouter.post('/:id/submit', authMiddleware, requireRole('STUDENT'), validate(submitApplicationSchema), asyncHandler(submitApplication));

// POST /api/applications/:id/withdraw - Withdraw application
studentRouter.post('/:id/withdraw', authMiddleware, requireRole('STUDENT'), validate(withdrawApplicationSchema), asyncHandler(withdrawApplication));

// POST /api/applications/:id/accept - Accept approved application
studentRouter.post('/:id/accept', authMiddleware, requireRole('STUDENT'), validate(acceptApplicationSchema), asyncHandler(acceptApplication));

// POST /api/applications/:id/decline - Decline approved application
studentRouter.post('/:id/decline', authMiddleware, requireRole('STUDENT'), validate(declineApplicationSchema), asyncHandler(declineApplication));

// Mounted at /api/admin/applications
const adminRouter: Router = Router();

// GET /api/admin/applications - List all applications
adminRouter.get('/', authMiddleware, requireRole('ADMIN'), validate(listApplicationsQuerySchema), asyncHandler(listAllApplications));

// GET /api/admin/applications/:id - Get application details
adminRouter.get('/:id', authMiddleware, requireRole('ADMIN'), validate(applicationIdParamSchema), asyncHandler(getApplication));

// PUT /api/admin/applications/:id/under-review - Move SUBMITTED to review (BE-14)
adminRouter.put('/:id/under-review', authMiddleware, requireRole('ADMIN'), validate(applicationIdParamSchema), asyncHandler(underReviewApplication));

// PUT /api/admin/applications/:id/decision - Approve/reject
adminRouter.put('/:id/decision', authMiddleware, requireRole('ADMIN'), validate(adminDecisionSchema), asyncHandler(adminDecision));

// Mounted at /api/mentor/applications — mentors review and decide on
// applications to programs in their expertise domains (scope enforced in the
// service; out-of-scope ids answer 404). Same decision rules as admins:
// seat limits, mentor capacity and a mandatory rejection reason.
const mentorRouter: Router = Router();
mentorRouter.use(authMiddleware, requireRole('MENTOR'));
mentorRouter.get('/', validate(listApplicationsQuerySchema), asyncHandler(listAllApplications));
mentorRouter.get('/:id', validate(applicationIdParamSchema), asyncHandler(getApplication));
mentorRouter.put('/:id/under-review', validate(applicationIdParamSchema), asyncHandler(underReviewApplication));
mentorRouter.put('/:id/decision', validate(adminDecisionSchema), asyncHandler(adminDecision));

export default studentRouter;
export { adminRouter as adminApplicationRouter, mentorRouter as mentorApplicationRouter };
