// Skill Routes
// Public skill catalog + admin management endpoints.
//
// BE-04 fix (audit 2026-10-20): the module router was mounted at /api/skills
// while defining /domains/... and /skills/... paths, doubling the effective
// prefix (/api/skills/domains/:domainId/skills, /api/skills/skills/:id).
// Routers are now exported per mount point and mounted in app.ts so the
// effective paths match the documented API.

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import {
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
} from './skill.controller';
import {
  createSkillSchema,
  updateSkillSchema,
  skillIdParamSchema,
  domainIdParamSchema,
} from './skill.validation';

// Mounted at /api/domains (alongside the domains module router)
// GET /api/domains/:domainId/skills - List skills in a domain
const domainsSkillsRouter: Router = Router();
domainsSkillsRouter.get('/:domainId/skills', validate(domainIdParamSchema), asyncHandler(listSkills));

// Mounted at /api/skills
// GET /api/skills/:id - Get skill details
const skillPublicRouter: Router = Router();
skillPublicRouter.get('/:id', validate(skillIdParamSchema), asyncHandler(getSkill));

// Mounted at /api/admin/domains
// POST /api/admin/domains/:domainId/skills - Create skill
const domainsSkillsAdminRouter: Router = Router();
domainsSkillsAdminRouter.post('/:domainId/skills', authMiddleware, requireRole('ADMIN'), validate(createSkillSchema), asyncHandler(createSkill));

// Mounted at /api/admin/skills
// PUT /api/admin/skills/:id - Update skill
// DELETE /api/admin/skills/:id - Delete skill
const skillAdminRouter: Router = Router();
skillAdminRouter.put('/:id', authMiddleware, requireRole('ADMIN'), validate(updateSkillSchema), asyncHandler(updateSkill));
skillAdminRouter.delete('/:id', authMiddleware, requireRole('ADMIN'), validate(skillIdParamSchema), asyncHandler(deleteSkill));

export default skillPublicRouter;
export { domainsSkillsRouter, domainsSkillsAdminRouter, skillAdminRouter };
