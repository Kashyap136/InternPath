// Profiles Controller
// Handles student and mentor profile HTTP endpoints

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { HttpError } from '../../shared/middleware/errorHandler';
import {
  getStudentProfile,
  createStudentProfile,
  updateStudentProfile,
  isStudentProfileComplete,
  getMentorProfile,
  createMentorProfile,
  updateMentorProfile,
  getUserProfile,
} from './profiles.service';

// ============================================================
// Student Profile Endpoints
// ============================================================

// GET /api/profiles/student/me - Get current user's student profile
export const getMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  if (user.role !== 'STUDENT') {
    throw HttpError.forbidden('Only students can access student profile');
  }
  
  const profile = await getStudentProfile(user.id);
  const complete = await isStudentProfileComplete(user.id);
  
  res.json({
    profile,
    complete,
  });
});

// POST /api/profiles/student/me - Create current user's student profile
export const createMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const actorId = user.id;
  
  if (user.role !== 'STUDENT') {
    throw HttpError.forbidden('Only students can create student profile');
  }
  
  const existing = await getStudentProfile(user.id);
  if (existing) {
    throw HttpError.conflict('Student profile already exists');
  }
  
  const profile = await createStudentProfile(
    user.id,
    req.body as Parameters<typeof createStudentProfile>[1],
    actorId
  );
  
  res.status(201).json({ profile, message: 'Student profile created' });
});

// PUT /api/profiles/student/me - Update current user's student profile
export const updateMyStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const actorId = user.id;
  
  if (user.role !== 'STUDENT') {
    throw HttpError.forbidden('Only students can update student profile');
  }
  
  const profile = await updateStudentProfile(
    user.id,
    req.body as Parameters<typeof updateStudentProfile>[1],
    actorId
  );
  
  res.json({ profile, message: 'Student profile updated' });
});

// GET /api/profiles/student/me/complete - Check if student profile is complete
export const checkMyStudentProfileComplete = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  if (user.role !== 'STUDENT') {
    throw HttpError.forbidden('Only students can check profile completeness');
  }
  
  const complete = await isStudentProfileComplete(user.id);
  
  res.json({ complete });
});

// ============================================================
// Mentor Profile Endpoints
// ============================================================

// GET /api/profiles/mentor/me - Get current user's mentor profile
export const getMyMentorProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  if (user.role !== 'MENTOR') {
    throw HttpError.forbidden('Only mentors can access mentor profile');
  }
  
  const profile = await getMentorProfile(user.id);
  
  res.json({ profile });
});

// POST /api/profiles/mentor/me - Create current user's mentor profile
export const createMyMentorProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const actorId = user.id;
  
  if (user.role !== 'MENTOR') {
    throw HttpError.forbidden('Only mentors can create mentor profile');
  }
  
  const existing = await getMentorProfile(user.id);
  if (existing) {
    throw HttpError.conflict('Mentor profile already exists');
  }
  
  const profile = await createMentorProfile(
    user.id,
    req.body as Parameters<typeof createMentorProfile>[1],
    actorId
  );
  
  res.status(201).json({ profile, message: 'Mentor profile created' });
});

// PUT /api/profiles/mentor/me - Update current user's mentor profile
export const updateMyMentorProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const actorId = user.id;
  
  if (user.role !== 'MENTOR') {
    throw HttpError.forbidden('Only mentors can update mentor profile');
  }
  
  const profile = await updateMentorProfile(
    user.id,
    req.body as Parameters<typeof updateMentorProfile>[1],
    actorId
  );
  
  res.json({ profile, message: 'Mentor profile updated' });
});

// ============================================================
// Admin Profile Endpoints
// ============================================================

// GET /api/profiles/admin/:userId - Admin gets any user's profiles
export const adminGetUserProfiles = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  
  const profiles = await getUserProfile(userId, 'ADMIN');
  
  res.json({ profiles });
});