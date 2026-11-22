// Program Routes
// Public catalog + admin management endpoints.
//
// BE-04 fix (audit 2026-10-20): admin endpoints were previously nested as
// /api/programs/admin/... on the module-mounted router. They are now exported
// separately and mounted at the documented /api/admin/* namespace in app.ts.

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import {
  listPrograms,
  listAllPrograms,
  getProgram,
  getProgramAdmin,
  createProgram,
  updateProgram,
  changeProgramStatus,
  archiveProgram,
} from './program.controller';
import {
  createProgramSchema,
  updateProgramSchema,
  changeProgramStatusSchema,
  programIdParamSchema,
  listProgramsQuerySchema,
} from './program.validation';

// Mounted at /api/programs
const publicRouter: Router = Router();

// GET /api/programs - List programs (public, filtered by query)
publicRouter.get('/', validate(listProgramsQuerySchema), asyncHandler(listPrograms));

// GET /api/programs/:id - Get program details (DRAFT hidden — BE-11)
publicRouter.get('/:id', validate(programIdParamSchema), asyncHandler(getProgram));

// Mounted at /api/admin/programs
const adminRouter: Router = Router();

// GET /api/admin/programs - List all programs (admin, with all statuses)
adminRouter.get('/', authMiddleware, requireRole('ADMIN'), validate(listProgramsQuerySchema), asyncHandler(listAllPrograms));

// POST /api/admin/programs - Create program
adminRouter.post('/', authMiddleware, requireRole('ADMIN'), validate(createProgramSchema), asyncHandler(createProgram));

// GET /api/admin/programs/:id - Get program (admin view, includes DRAFT)
adminRouter.get('/:id', authMiddleware, requireRole('ADMIN'), validate(programIdParamSchema), asyncHandler(getProgramAdmin));

// PUT /api/admin/programs/:id - Update program (only in DRAFT)
adminRouter.put('/:id', authMiddleware, requireRole('ADMIN'), validate(updateProgramSchema), asyncHandler(updateProgram));

// PUT /api/admin/programs/:id/status - Change program status
adminRouter.put('/:id/status', authMiddleware, requireRole('ADMIN'), validate(changeProgramStatusSchema), asyncHandler(changeProgramStatus));

// PUT /api/admin/programs/:id/archive - Archive program
adminRouter.put('/:id/archive', authMiddleware, requireRole('ADMIN'), validate(programIdParamSchema), asyncHandler(archiveProgram));

export default publicRouter;
export { adminRouter as adminProgramRouter };
