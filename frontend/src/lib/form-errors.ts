// Form error mapping — shared by every form so no server validation message
// is ever silently dropped (spec §18.2, §12.3).
//
// Backend validation errors arrive as:
//   { error: 'VALIDATION_ERROR', message, details: [{ path: 'body.email', message }] }
// Other errors arrive as { error, message }. Network failures throw a
// non-ApiError (TypeError from fetch).

import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

/** Per-form map from a backend field key (after `body.` is stripped) to the
 * frontend field id used by the form controls. */
export type FieldMap = Record<string, string>;

export interface ParsedApiError {
  /** Messages keyed by frontend field id. */
  fieldErrors: FieldErrors;
  /** An unmapped validation message list, or a single form-level message. */
  summaryErrors: string[];
  /** A form-level message for non-validation errors (or network failures). */
  formError: string | null;
}

export const NETWORK_ERROR_MESSAGE =
  "Can't reach InternPath. Check your connection and try again.";

/**
 * Parse any error thrown by the API client into field errors, a summary list
 * and/or a form-level message.
 */
export function parseApiError(
  err: unknown,
  fieldMap: FieldMap = {}
): ParsedApiError {
  if (!(err instanceof ApiError)) {
    return { fieldErrors: {}, summaryErrors: [], formError: NETWORK_ERROR_MESSAGE };
  }

  const details = err.details;
  if (err.code === 'VALIDATION_ERROR' && Array.isArray(details)) {
    const fieldErrors: FieldErrors = {};
    const summaryErrors: string[] = [];
    for (const detail of details as Array<{ path?: string; message?: string }>) {
      const raw = (detail.path ?? '').replace(/^body\./, '');
      const message = detail.message ?? 'Invalid value';
      if (!raw) {
        // A validation detail with no field path is surfaced at form level.
        summaryErrors.push(message);
        continue;
      }
      // Map the backend key to its frontend control id, falling back to the
      // key itself (most fields share the same name on both sides).
      const key = fieldMap[raw] ?? raw;
      if (!fieldErrors[key]) fieldErrors[key] = message;
    }
    return { fieldErrors, summaryErrors, formError: null };
  }

  return { fieldErrors: {}, summaryErrors: [], formError: err.message };
}

/** True when the request failed because the session is no longer valid. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * The single best user-facing message for a parsed API error.
 *
 * Replaces the previously widespread `parsed.formError ??
 * parsed.summaryErrors.join(' ') ?? fallback` chains, which were broken:
 * `Array.join` returns '' (never null/undefined) when the list is empty, so
 * the final fallback was unreachable and failed actions could surface as an
 * empty string — i.e. no feedback at all. Order: form-level message, joined
 * unmapped validation messages, then mapped field messages (keyed by the
 * frontend field id so nothing is dropped when a dialog has no field
 * components to render them inline), then the caller's fallback.
 */
export function apiErrorMessage(
  parsed: ParsedApiError,
  fallback = 'The action could not be completed. Try again.'
): string {
  if (parsed.formError) return parsed.formError;
  if (parsed.summaryErrors.length > 0) return parsed.summaryErrors.join(' ');
  const fieldEntries = Object.entries(parsed.fieldErrors);
  if (fieldEntries.length > 0) {
    return fieldEntries.map(([field, message]) => `${field}: ${message}`).join(' ');
  }
  return fallback;
}
