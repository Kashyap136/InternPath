// Project Routes (Sprint 3)
//
// Public/student surface: GET /api/projects, GET /api/projects/:id
//   (students see PUBLISHED projects only — enforced in the service).
// Mentor/admin authoring surface: draft CRUD + milestones/tasks/dependencies
//   (draft-only edits enforced in the service; mentors and admins both allowed).
// Admin lifecycle surface (mounted under /api/admin/projects in app.ts):
//   review, publish, archive.

import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import {
  createProject,
  updateProject,
  submitProjectForReview,
  listProjects,
  getProject,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  createTask,
  updateTask,
  deleteTask,
  addTaskDependency,
  removeTaskDependency,
} from './project.controller';
import { adminReviewProject, adminListProjects, publishProject, unpublishProject } from './project.admin.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParams,
  listProjectsQuery,
  createMilestoneSchema,
  updateMilestoneSchema,
  milestoneParams,
  createTaskSchema,
  updateTaskSchema,
  taskParams,
  createDependencySchema,
  projectReviewSchema,
} from './project.validation';

const router: Router = Router();

// Reads — authenticated (students see published only; mentors/admins wider)
router.get('/', authMiddleware, validate(listProjectsQuery), asyncHandler(listProjects));
router.get('/:id', authMiddleware, validate(projectIdParams), asyncHandler(getProject));

// Draft authoring — mentors and administrators
router.post('/', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(createProjectSchema), asyncHandler(createProject));
router.put('/:id', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(updateProjectSchema), asyncHandler(updateProject));
router.post('/:id/submit', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(projectIdParams), asyncHandler(submitProjectForReview));

// Milestones & tasks — draft-only edits
router.post('/:projectId/milestones', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(createMilestoneSchema), asyncHandler(createMilestone));
router.put('/:projectId/milestones/:milestoneId', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(updateMilestoneSchema), asyncHandler(updateMilestone));
router.delete('/:projectId/milestones/:milestoneId', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(milestoneParams), asyncHandler(deleteMilestone));

router.post('/:projectId/milestones/:milestoneId/tasks', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(createTaskSchema), asyncHandler(createTask));
router.put('/:projectId/milestones/:milestoneId/tasks/:taskId', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(updateTaskSchema), asyncHandler(updateTask));
router.delete('/:projectId/milestones/:milestoneId/tasks/:taskId', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(taskParams), asyncHandler(deleteTask));

// Dependencies — cycle-rejecting (FR-055)
router.post(
  '/:projectId/milestones/:milestoneId/tasks/:taskId/dependencies',
  authMiddleware,
  requireRole('MENTOR', 'ADMIN'),
  validate(createDependencySchema),
  asyncHandler(addTaskDependency)
);
router.delete(
  '/:projectId/milestones/:milestoneId/tasks/:taskId/dependencies/:prerequisiteTaskId',
  authMiddleware,
  requireRole('MENTOR', 'ADMIN'),
  validate(taskParams),
  asyncHandler(removeTaskDependency)
);

// ---------------------------------------------------------------
// Admin lifecycle router (separate export — mounted under /api/admin/projects)
// ---------------------------------------------------------------

const adminRouter: Router = Router();

adminRouter.get('/', authMiddleware, requireRole('ADMIN'), validate(listProjectsQuery), asyncHandler(adminListProjects));
adminRouter.post('/:id/review', authMiddleware, requireRole('ADMIN'), validate(projectReviewSchema), asyncHandler(adminReviewProject));
adminRouter.post('/:id/publish', authMiddleware, requireRole('ADMIN'), validate(projectIdParams), asyncHandler(publishProject));
adminRouter.post('/:id/archive', authMiddleware, requireRole('ADMIN'), validate(projectIdParams), asyncHandler(unpublishProject));

export default router;
export { adminRouter };
