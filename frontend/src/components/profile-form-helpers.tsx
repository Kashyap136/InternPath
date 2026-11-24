'use client';

// Helpers shared by the role profile forms (student + mentor): URL check,
// first-error focus and the top-of-form validation summary.

import type { FieldErrors } from '@/lib/form-errors';
import { Alert } from '@/components/ui';

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function focusFirstError(
  errors: FieldErrors,
  summaryRef: React.RefObject<HTMLDivElement | null>
) {
  const keys = Object.keys(errors);
  if (keys.length === 0) return;
  if (keys.length === 1) {
    const id = keys[0]!;
    window.requestAnimationFrame(() => document.getElementById(id)?.focus());
  } else {
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }
}

/** The top-of-form summary shown when a submit produces 2+ field errors. */
export function ValidationSummary({
  errors,
  labels,
  summaryRef,
}: {
  errors: FieldErrors;
  labels: Record<string, string>;
  summaryRef: React.RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(errors);
  if (entries.length < 2) return null;
  return (
    <div ref={summaryRef} tabIndex={-1} className="mb-5 focus:outline-hidden">
      <Alert variant="error" title="Fix the following:">
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {entries.map(([key, message]) => (
            <li key={key}>
              <a
                href={`#${key}`}
                className="font-medium underline underline-offset-2"
              >
                {labels[key] ?? key}
              </a>
              : {message}
            </li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}
