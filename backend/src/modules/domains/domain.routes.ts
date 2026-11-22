// Domain Routes
// Public catalog + admin management endpoints.
//
// BE-04 fix (audit 2026-10-20): admin endpoints were previously nested as
// /api/domains/admin/... because they lived on the module-mounted router.
// They are now exported separately and mounted at the documented
// /api/admin/* namespace in app.ts.

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import {
  listDomains,
  listAllDomains,
  getDomain,
  createDomain,
  updateDomain,
  deactivateDomain,
} from './domain.controller';
import {
  createDomainSchema,
  updateDomainSchema,
  domainIdParamSchema,
} from './domain.validation';

// Mounted at /api/domains
const publicRouter: Router = Router();

// GET /api/domains - List active domains with skills
publicRouter.get('/', asyncHandler(listDomains));

// GET /api/domains/:id - Get domain with skills
publicRouter.get('/:id', validate(domainIdParamSchema), asyncHandler(getDomain));

// Mounted at /api/admin/domains
const adminRouter: Router = Router();

// GET /api/admin/domains - List all domains (including inactive)
adminRouter.get('/', authMiddleware, requireRole('ADMIN'), asyncHandler(listAllDomains));

// POST /api/admin/domains - Create domain
adminRouter.post('/', authMiddleware, requireRole('ADMIN'), validate(createDomainSchema), asyncHandler(createDomain));

// PUT /api/admin/domains/:id - Update domain
adminRouter.put('/:id', authMiddleware, requireRole('ADMIN'), validate(updateDomainSchema), asyncHandler(updateDomain));

// PUT /api/admin/domains/:id/deactivate - Deactivate domain
adminRouter.put('/:id/deactivate', authMiddleware, requireRole('ADMIN'), validate(domainIdParamSchema), asyncHandler(deactivateDomain));

export default publicRouter;
export { adminRouter as adminDomainRouter };
