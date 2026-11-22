// Auth Validation Schemas
// Zod schemas for authentication endpoints

import { z } from 'zod';

// Password schema - minimum length (TEMP default 8, actual from PlatformSetting)
const PASSWORD_MIN_LENGTH = 8; // TEMP: actual value from PlatformSetting.passwordMinLength

const getPasswordSchema = () => z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(128, 'Password must not exceed 128 characters');

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must not exceed 100 characters').trim(),
    email: z.string().email('Invalid email format').toLowerCase().trim(),
    password: getPasswordSchema(),
    privacyAccepted: z.literal(true, {
      error: 'Privacy notice must be accepted',
    }),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').toLowerCase().trim(),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: getPasswordSchema(),
  }),
});

// Admin reset is performed by email on POST /api/auth/admin/reset-password.
// (The route has no :id parameter, so no params schema may be required here.)
export const adminResetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format').toLowerCase().trim(),
  }),
});

export const adminCreateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must not exceed 100 characters').trim(),
    email: z.string().email('Invalid email format').toLowerCase().trim(),
    role: z.enum(['MENTOR', 'ADMIN']),
    // Password is auto-generated for admin-created accounts
  }),
});

export const adminSuspendUserSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
    // P2-05: required to proceed when the target mentor still has active
    // internship assignments (fail-closed default pending owner decision OD-8).
    force: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const adminChangeRoleSchema = z.object({
  body: z.object({
    role: z.enum(['STUDENT', 'MENTOR', 'ADMIN']),
    // P2-05: required to proceed when demoting a mentor who still has active
    // internship assignments (fail-closed default pending owner decision OD-8).
    force: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().cuid(),
  }),
});

// Google OAuth callback query parameters are NOT validated with zod:
// it is a browser redirect endpoint whose failure path carries `error`
// instead of `code` (see auth.routes.ts for the full rationale). The
// controller handles every combination by redirecting to the login page.

export const studentProfileSchema = z.object({
  body: z.object({
    institution: z.string().min(1, 'Institution is required').max(100),
    degree: z.string().min(1, 'Degree is required').max(100),
    yearOfStudy: z.number().int().positive('Year of study must be a positive integer'),
    graduationYear: z.number().int().min(new Date().getFullYear(), 'Graduation year cannot be in the past'),
    declaredSkills: z.array(z.string()).default([]),
    githubProfileUrl: z.string().url('Invalid GitHub URL').optional().nullable(),
    portfolioUrl: z.string().url('Invalid portfolio URL').optional().nullable(),
    bio: z.string().max(1000, 'Bio must not exceed 1000 characters').optional().nullable(),
  }),
});

export const mentorProfileSchema = z.object({
  body: z.object({
    summary: z.string().max(1000, 'Summary must not exceed 1000 characters').optional().nullable(),
    maxActiveInterns: z.number().int().positive('Max active interns must be a positive integer').optional(),
  }),
});