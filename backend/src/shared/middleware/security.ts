// Security Middleware
// Helmet, CORS, Rate Limiting configuration

import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

// Helmet configuration
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CORS configuration
export const corsMiddleware = cors({
  origin: config.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count'],
});

// Rate limiting - will be configured with dynamic settings in Sprint 1
// For Sprint 0, use static config from environment
export const createRateLimiter = () => {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
    // Skip successful health checks
    skip: (req: Request) => req.path === '/health',
  });
};

// P1-02 fix (comprehensive audit 2026-11-15): this limiter was previously
// defined but never mounted, so password guessing was bounded only by the
// shared global bucket. It is now mounted on login, registration, admin
// password reset and public certificate verification (NFR-CAND-005).
//
// The ceiling is configurable via AUTH_RATE_LIMIT_MAX so the isolated test
// process can raise it without weakening the production default (10 failed
// attempts per 15 minutes). Successful sign-ins do not consume the budget.
export const createAuthRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    // Key on source address AND the (normalised) target account: a spoofed
    // forwarding header cannot bypass the per-account budget because the
    // email component still bounds attempts against one account.
    keyGenerator: (req: Request) => {
      const email =
        typeof (req.body as { email?: unknown } | undefined)?.email === 'string'
          ? ((req.body as { email: string }).email.trim().toLowerCase())
          : '';
      return `${req.ip ?? 'unknown'}|${email}`;
    },
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  });
};

// Endpoints that SEND email (verification resend, forgot-password). Counted
// per source address including successful requests, so the platform cannot
// be used to flood inboxes. Each account additionally has a 60s cooldown.
export const createEmailSendRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.EMAIL_SEND_RATE_LIMIT_MAX ?? 8),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many email requests, please try again later',
    },
  });
};

// Public certificate verification (NFR-CAND-005). A read endpoint used by
// legitimate employers — a separate, more generous budget than login.
export const createVerificationRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.VERIFICATION_RATE_LIMIT_MAX ?? 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many verification attempts, please try again later',
    },
  });
};

// Request logging (using morgan in app.ts)
// This middleware adds security headers not covered by helmet
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // XSS protection (legacy but harmless)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy (feature policy)
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  next();
}

// Generic error message for auth failures (NFR-CAND-007)
export function genericAuthError(_req: Request, res: Response, next: NextFunction): void {
  // This middleware can be used to ensure auth errors don't leak information
  // The actual error handling is in errorHandler.ts
  next();
}