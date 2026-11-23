// Authentication & Authorization Middleware
// Validates sessions, enforces RBAC

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { validateSession, mustChangePassword as checkMustChangePassword } from '../../modules/auth/auth.service';
import { isUserEmailVerified } from '../../modules/auth/email-code.service';
import { HttpError } from './errorHandler';
import type { User, UserRole } from '@prisma/client';

/** Full paths an authenticated-but-unverified account may still call. */
const EMAIL_UNVERIFIED_ALLOWED = new Set([
  '/api/auth/me',
  '/api/auth/verify-email',
  '/api/auth/verify-email/resend',
  '/api/auth/change-password',
]);

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      sessionId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Validates session cookie and attaches user to request
 */
const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.session as string | undefined;

    if (!token) {
      throw HttpError.unauthorized('Authentication required');
    }

    const sessionData = await validateSession(token);

    if (!sessionData) {
      throw HttpError.unauthorized('Invalid or expired session');
    }

    // Check if user must change password (but allow password change endpoint).
    // NOTE: req.path is mount-stripped inside a router, so build the full path
    // from baseUrl + path. Otherwise the change-password route itself would be
    // blocked, permanently locking out users holding a temporary password.
    const fullRequestPath = `${req.baseUrl}${req.path}`;
    if (checkMustChangePassword(sessionData.user) && fullRequestPath !== '/api/auth/change-password') {
      throw new HttpError(403, 'Password change required', 'PASSWORD_CHANGE_REQUIRED');
    }

    // Unverified email addresses may only reach the endpoints needed to
    // verify (and to read their own session / change their password).
    if (!isUserEmailVerified(sessionData.user) && !EMAIL_UNVERIFIED_ALLOWED.has(fullRequestPath)) {
      throw new HttpError(403, 'Verify your email address to continue', 'EMAIL_VERIFICATION_REQUIRED');
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.session.id;
    next();
  } catch (error) {
    next(error);
  }
};

// Express middleware must return void; the async work is delegated and errors
// are forwarded to `next` inside `authenticate`.
export const authMiddleware: RequestHandler = (req, res, next): void => {
  void authenticate(req, res, next);
};

/**
 * Optional authentication middleware
 * Attaches user if session is valid, but doesn't require authentication
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies?.session as string | undefined;

    if (token) {
      const sessionData = await validateSession(token);
      if (sessionData) {
        req.user = sessionData.user;
        req.sessionId = sessionData.session.id;
      }
    }
    next();
  } catch {
    // Ignore auth errors for optional auth
    next();
  }
};

/**
 * Role-based authorization middleware
 * Requires user to have one of the specified roles
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw HttpError.unauthorized('Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw HttpError.forbidden('Insufficient permissions');
    }

    next();
  };
};

/**
 * Ownership check middleware
 * Ensures user can only access their own resources (unless admin/mentor with assignment)
 */
export const requireOwnership = (
  getResourceUserId: (req: Request) => Promise<string | null> | string | null
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw HttpError.unauthorized('Authentication required');
    }

    // Admins can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const resourceUserId = await getResourceUserId(req);

    if (!resourceUserId) {
      throw HttpError.notFound('Resource not found');
    }

    if (resourceUserId !== req.user.id) {
      throw HttpError.forbidden('Access denied: not your resource');
    }

    next();
  };
};

/**
 * Mentor assignment check middleware
 * Ensures mentor can only access internships assigned to them
 */
export const requireMentorAssignment = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw HttpError.unauthorized('Authentication required');
  }

  // Admins can access everything
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Only mentors need assignment check
  if (req.user.role === 'MENTOR') {
    // This would check if the mentor is assigned to the internship
    // Implementation depends on the specific endpoint
    // For now, we'll allow and let individual endpoints check
    return next();
  }

  // Students shouldn't use this middleware
  throw HttpError.forbidden('Mentor access required');
};

/**
 * Password change enforcement check
 * Returns 403 with PASSWORD_CHANGE_REQUIRED code if user must change password
 */
export const enforcePasswordChange = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw HttpError.unauthorized('Authentication required');
  }

  // NOTE: req.path is mount-stripped inside a router, so build the full path
  // from baseUrl + path (see authMiddleware for details).
  const fullRequestPath = `${req.baseUrl}${req.path}`;
  if (checkMustChangePassword(req.user) && fullRequestPath !== '/api/auth/change-password') {
    throw new HttpError(403, 'Password change required', 'PASSWORD_CHANGE_REQUIRED');
  }

  next();
};