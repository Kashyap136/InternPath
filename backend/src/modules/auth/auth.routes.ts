// Auth Routes
// Defines authentication API endpoints

import { Router } from 'express';
import { validate } from '../../shared/middleware/validation';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { createAuthRateLimiter, createEmailSendRateLimiter } from '../../shared/middleware/security';
import {
  register,
  login,
  logout,
  changeMyPassword,
  getMe,
  getAuthProviders,
  adminResetPassword,
  adminCreateUser,
  adminSuspendUser,
  adminChangeRole,
  adminListUsers,
  adminGetUser,
  googleCallback,
  googleOAuthStart,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from './auth.controller';
import {
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  registerSchema,
  loginSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
  adminCreateUserSchema,
  adminSuspendUserSchema,
  adminChangeRoleSchema,
} from './auth.validation';

const router: Router = Router();

// ============================================================
// Public Authentication Endpoints
// ============================================================

// P1-02 (comprehensive audit 2026-11-15): the dedicated authentication
// limiter is mounted on the credential-bearing public endpoints. Login keys
// on source + target account and skips successful sign-ins.
const authLimiter = createAuthRateLimiter();
const emailSendLimiter = createEmailSendRateLimiter();

// POST /api/auth/register - Public student registration
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(register));

// POST /api/auth/login - User login
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(login));

// POST /api/auth/logout - User logout
router.post('/logout', asyncHandler(logout));

// POST /api/auth/change-password - Change password (authenticated)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), asyncHandler(changeMyPassword));

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware, asyncHandler(getMe));

// POST /api/auth/verify-email - Confirm the emailed verification code
router.post('/verify-email', authMiddleware, authLimiter, validate(verifyEmailSchema), asyncHandler(verifyEmail));

// POST /api/auth/verify-email/resend - Send a new verification code
router.post('/verify-email/resend', authMiddleware, emailSendLimiter, asyncHandler(resendVerificationEmail));

// POST /api/auth/forgot-password - Email a reset code (generic response)
router.post('/forgot-password', emailSendLimiter, validate(forgotPasswordSchema), asyncHandler(forgotPassword));

// POST /api/auth/reset-password - Set a new password with the emailed code
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), asyncHandler(resetPassword));

// GET /api/auth/providers - Public provider capability discovery (no secrets)
router.get('/providers', asyncHandler(getAuthProviders));

// ============================================================
// Google OAuth Endpoints
// ============================================================

// GET /api/auth/google - Initiate Google OAuth flow
router.get('/google', asyncHandler(googleOAuthStart));

// GET /api/auth/google/callback - Google OAuth callback
// NOTE: no zod validation here. This endpoint is a browser redirect target:
// on the failure path Google sends `?error=...` (no `code`), and a strict
// schema would answer a top-level navigation with a JSON 400 instead of the
// friendly login redirect. Every malformed combination is handled inside the
// controller by `redirectToLogin` (302, non-sensitive reason, no cookie).
router.get('/google/callback', asyncHandler(googleCallback));

// ============================================================
// Admin Authentication Endpoints
// ============================================================

// POST /api/auth/admin/reset-password - Admin temporary password reset
router.post(
  '/admin/reset-password',
  authMiddleware,
  requireRole('ADMIN'),
  authLimiter,
  validate(adminResetPasswordSchema),
  asyncHandler(adminResetPassword)
);

// POST /api/admin/users - Admin creates MENTOR/ADMIN account
router.post(
  '/admin/users',
  authMiddleware,
  requireRole('ADMIN'),
  validate(adminCreateUserSchema),
  asyncHandler(adminCreateUser)
);

// GET /api/admin/users - Admin lists users
router.get(
  '/admin/users',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(adminListUsers)
);

// GET /api/admin/users/:id - Admin gets user details
router.get(
  '/admin/users/:id',
  authMiddleware,
  requireRole('ADMIN'),
  asyncHandler(adminGetUser)
);

// PUT /api/admin/users/:id/suspend - Admin suspends/reactivates user
router.put(
  '/admin/users/:id/suspend',
  authMiddleware,
  requireRole('ADMIN'),
  validate(adminSuspendUserSchema),
  asyncHandler(adminSuspendUser)
);

// PUT /api/admin/users/:id/role - Admin changes user role
router.put(
  '/admin/users/:id/role',
  authMiddleware,
  requireRole('ADMIN'),
  validate(adminChangeRoleSchema),
  asyncHandler(adminChangeRole)
);

export default router;