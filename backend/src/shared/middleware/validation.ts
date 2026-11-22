// Validation Middleware
// Zod-based request validation

import type { Request, Response, NextFunction, RequestHandler } from 'express';
// Zod 4: AnyZodObject was removed from the public exports; the generic base
// ZodType is the supported schema-agnostic type (parseAsync surface identical).
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { HttpError } from './errorHandler';

/** The validated request envelope (the parse output of `{ body, query, params }` schemas). */
interface ValidatedEnvelope {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

export function validate(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Return void to Express; parse asynchronously and forward errors to `next`.
    void schema
      .parseAsync({
        body: req.body as unknown,
        query: req.query,
        params: req.params,
      })
      .then((rawParsed) => {
        const parsed = rawParsed as ValidatedEnvelope;
        // P1-01 fix (comprehensive audit 2026-11-15): the parse result IS the
        // validated request — write it back so transforms (email
        // normalisation, trim) and defaults actually reach the controllers.
        // Previously the result was discarded, so e.g. `Alice@Example.com`
        // was stored verbatim while every login lookup lowercased the
        // address, making such accounts unable to authenticate.
        // `req.body` and `req.params` are plain objects; Express 5 exposes
        // `req.query` as a getter, so the parsed query is additionally
        // exposed on `res.locals.validatedQuery` for controllers that need
        // coerced values (assignment is still attempted defensively).
        if (parsed.body !== undefined) {
          replaceOwnProperties(req.body as Record<string, unknown>, parsed.body as Record<string, unknown>);
        }
        if (parsed.params !== undefined) {
          try {
            req.params = parsed.params as typeof req.params;
          } catch {
            replaceOwnProperties(req.params, parsed.params as Record<string, unknown>);
          }
        }
        if (parsed.query !== undefined) {
          // Express 5 exposes `req.query` as a getter, so coerced query values
          // are published on res.locals for controllers that need them.
          res.locals.validatedQuery = parsed.query;
        }
        next();
      })
      .catch((err: unknown) => {
        if (err instanceof ZodError) {
          next(err);
        } else {
          next(HttpError.badRequest('Validation failed'));
        }
      });
  };
}

/** Replace the target's own properties with the source's (keeps the object
 * identity so Express-internal references stay valid). */
function replaceOwnProperties(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  if (!target || typeof target !== 'object') return;
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  Object.assign(target, source);
}

// Common validation schemas
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const idParamSchema = z.object({
  id: z.string().cuid(),
});

export const emailSchema = z.string().email().toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must not exceed 100 characters')
  .trim();