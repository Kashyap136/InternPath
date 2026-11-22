// Profiles Routes
// Defines profile API endpoints

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { authMiddleware } from '../../shared/middleware/auth';
import { requireRole } from '../../shared/middleware/auth';
import {
  getMyStudentProfile,
  createMyStudentProfile,
  updateMyStudentProfile,
  checkMyStudentProfileComplete,
  getMyMentorProfile,
  createMyMentorProfile,
  updateMyMentorProfile,
  adminGetUserProfiles,
} from './profiles.controller';
import { studentProfileUpdateSchema, mentorProfileUpdateSchema } from './profiles.validation';

const router: Router = Router();

// All profile routes require authentication
router.use(authMiddleware);

// ============================================================
// Student Profile Routes
// ============================================================

// GET /api/profiles/student/me - Get current student profile
router.get('/student/me', asyncHandler(getMyStudentProfile));

// POST /api/profiles/student/me - Create student profile
router.post('/student/me', validate(studentProfileUpdateSchema), asyncHandler(createMyStudentProfile));

// PUT /api/profiles/student/me - Update student profile
router.put('/student/me', validate(studentProfileUpdateSchema), asyncHandler(updateMyStudentProfile));

// GET /api/profiles/student/me/complete - Check profile completeness
router.get('/student/me/complete', asyncHandler(checkMyStudentProfileComplete));

// ============================================================
// Mentor Profile Routes
// ============================================================

// GET /api/profiles/mentor/me - Get current mentor profile
router.get('/mentor/me', asyncHandler(getMyMentorProfile));

// POST /api/profiles/mentor/me - Create mentor profile
router.post('/mentor/me', validate(mentorProfileUpdateSchema), asyncHandler(createMyMentorProfile));

// PUT /api/profiles/mentor/me - Update mentor profile
router.put('/mentor/me', validate(mentorProfileUpdateSchema), asyncHandler(updateMyMentorProfile));

// ============================================================
// Admin Profile Routes
// ============================================================

// GET /api/profiles/admin/:userId - Admin gets any user's profiles
router.get('/admin/:userId', authMiddleware, requireRole('ADMIN'), asyncHandler(adminGetUserProfiles));

export default router;