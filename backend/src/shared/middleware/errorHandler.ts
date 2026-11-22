// Error Handling Middleware
// Centralized error handling for Express

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
// BE-01 fix (audit 2026-10-20): the business-logic AppError class from
// shared/utils is now the single source; the former local AppError interface
// here made the global handler blind to business errors (they fell through
// as 500 INTERNAL_ERROR). HttpError (Sprint 1) and AppError (Sprint 2)
// continue to be handled separately below.

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized'): HttpError {
    return new HttpError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): HttpError {
    return new HttpError(403, message, 'FORBIDDEN');
  }

  static notFound(message: string = 'Not found'): HttpError {
    return new HttpError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown): HttpError {
    return new HttpError(409, message, 'CONFLICT', details);
  }

  static internal(message: string = 'Internal server error'): HttpError {
    return new HttpError(500, message, 'INTERNAL_ERROR');
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging (in production, use proper logging service)
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Error:', err);
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  // Business-rule errors thrown by Sprint 2 services (BE-01, audit 2026-10-20).
  // Mapped to their intended status/code instead of falling through as 500s.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Custom HTTP errors
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  // Request-body parsing errors from express.json()/urlencoded() (body-parser).
  // These are client errors — previously they fell through as 500s. Fixed
  // messages only: the parser's own message can echo request content.
  const parserType = (err as { type?: unknown }).type;
  if (parserType === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON', message: 'Request body is not valid JSON' });
    return;
  }
  if (parserType === 'entity.too.large') {
    res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
    return;
  }

  // Unknown errors — never echo err.message (it may contain database hosts,
  // credentials from driver errors, or stack fragments). Full details remain
  // on the server log above.
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}

function handlePrismaError(err: Prisma.PrismaClientKnownRequestError, res: Response): void {
  // Unique constraint violation
  if (err.code === 'P2002') {
    const target = err.meta?.target as string[] | undefined;
    res.status(409).json({
      error: 'CONFLICT',
      message: `A record with this ${target?.join(', ') || 'value'} already exists`,
      details: { field: target?.[0] },
    });
    return;
  }

  // Record not found
  if (err.code === 'P2025') {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Record not found',
    });
    return;
  }

  // Foreign key constraint
  if (err.code === 'P2003') {
    res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Referenced record does not exist',
    });
    return;
  }

  // Generic Prisma error — one message in every environment: driver/SQL
  // details must not reach clients (Phase 1: internal-error non-disclosure).
  res.status(500).json({
    error: 'DATABASE_ERROR',
    message: 'A database error occurred',
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => unknown
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Express expects handlers to return void; run the handler and forward any
    // rejection (or synchronous throw) to `next`.
    void Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
}