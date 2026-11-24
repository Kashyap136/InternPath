'use client';

// Mentor profile form — GET → create (POST) / update (PUT) of
// /api/profiles/mentor/me (summary, capacity, expertise domains).

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { parseApiError, type FieldErrors } from '@/lib/form-errors';
import type { Domain, MentorProfile } from '@/types';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  TextArea,
  TextInput,
} from '@/components/ui';
import { focusFirstError, ValidationSummary } from '@/components/profile-form-helpers';

const MENTOR_LABELS: Record<string, string> = {
  summary: 'Summary',
  maxActiveInterns: 'Maximum active interns',
};

export function MentorProfileForm({
  initial,
  onSaved,
}: {
  initial: MentorProfile | null;
  onSaved: (p: MentorProfile) => void;
}) {
  const hasProfile = Boolean(initial);

  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [maxActiveInterns, setMaxActiveInterns] = useState(
    initial ? String(initial.maxActiveInterns) : '3'
  );
  // Public-release fix (2026-11-20): expertise domains — FR-047 assignment
  // eligibility requires them; without this control admins could never
  // assign any mentor through the product.
  const domainsLoad = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/domains?limit=100').then((r) => r.data)
  );
  const [domainIds, setDomainIds] = useState<string[]>(
    (initial?.domains ?? []).map((d) => d.id)
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initial) return;
    setSummary(initial.summary ?? '');
    setMaxActiveInterns(String(initial.maxActiveInterns));
  }, [initial]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const max = Number(maxActiveInterns);
    if (!maxActiveInterns.trim())
      errors.maxActiveInterns = 'Enter how many interns you can supervise.';
    else if (!Number.isInteger(max) || max < 1)
      errors.maxActiveInterns = 'Enter a whole number of 1 or more.';
    return errors;
  }

  function markEdited() {
    if (saved) setSaved(false);
  }

  function handleBlur(field: keyof FieldErrors) {
    if (!submitted) return;
    const next = validate();
    setFieldErrors((prev) => {
      const merged = { ...prev };
      if (next[field]) merged[field] = next[field]!;
      else delete merged[field];
      return merged;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setFormError(null);
    setSaved(false);
    setSubmitted(true);

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      focusFirstError(clientErrors, summaryRef);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    const body = {
      summary: summary.trim() || null,
      maxActiveInterns: maxActiveInterns ? Number(maxActiveInterns) : undefined,
      domainIds,
    };

    try {
      const res = hasProfile
        ? await api.put<{ profile: MentorProfile }>(
            '/api/profiles/mentor/me',
            body
          )
        : await api.post<{ profile: MentorProfile }>(
            '/api/profiles/mentor/me',
            body
          );
      void onSaved(res.profile);
      setSaved(true);
    } catch (err) {
      const parsed = parseApiError(err);
      const hasFieldErrors = Object.keys(parsed.fieldErrors).length > 0;
      if (hasFieldErrors) setFieldErrors(parsed.fieldErrors);
      const formLevel = parsed.formError ?? parsed.summaryErrors.join(' ');
      if (formLevel) setFormError(formLevel);
      if (hasFieldErrors) focusFirstError(parsed.fieldErrors, summaryRef);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card
      title={hasProfile ? 'Mentor profile' : 'Create your mentor profile'}
      subtitle="Tell interns what you work on and how many interns you can supervise."
    >
      {saved && (
        <div className="mb-5">
          <Alert variant="success" title="Profile saved">
            Your mentor profile was saved.
          </Alert>
        </div>
      )}
      {formError && (
        <div className="mb-5">
          <Alert variant="error" title="Could not save profile">
            {formError}
          </Alert>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
        <ValidationSummary
          errors={fieldErrors}
          labels={MENTOR_LABELS}
          summaryRef={summaryRef}
        />

        <Field
          label="Summary"
          htmlFor="summary"
          hint="Optional, up to 1000 characters."
          optional
        >
          <TextArea
            id="summary"
            rows={4}
            maxLength={1000}
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value);
              markEdited();
            }}
            placeholder="Areas of expertise and how you like to mentor."
            readOnly={submitting}
          />
        </Field>

        <Field
          label="Expertise domains"
          htmlFor="expertise-domains"
          hint="Administrators can only assign interns in the domains you select."
        >
          <div id="expertise-domains" className="grid gap-2 sm:grid-cols-2">
            {domainsLoad.loading && (
              <p className="text-sm text-muted">Loading domains…</p>
            )}
            {domainsLoad.error && (
              <p className="text-sm text-danger-solid" role="alert">
                Domains could not be loaded — try again after saving.
              </p>
            )}
            {(domainsLoad.data ?? []).map((domain) => (
              <label
                key={domain.id}
                className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm text-body"
              >
                <Checkbox
                  checked={domainIds.includes(domain.id)}
                  onChange={(e) => {
                    setDomainIds((prev) =>
                      e.target.checked
                        ? [...prev, domain.id]
                        : prev.filter((id) => id !== domain.id)
                    );
                    markEdited();
                  }}
                  disabled={submitting}
                />
                {domain.name}
              </label>
            ))}
          </div>
        </Field>

        <Field
          label="Maximum active interns"
          htmlFor="maxActiveInterns"
          error={fieldErrors.maxActiveInterns}
          hint="How many interns you can supervise at once."
        >
          <TextInput
            id="maxActiveInterns"
            type="number"
            inputMode="numeric"
            min={1}
            value={maxActiveInterns}
            onChange={(e) => {
              setMaxActiveInterns(e.target.value);
              markEdited();
            }}
            onBlur={() => handleBlur('maxActiveInterns')}
            readOnly={submitting}
            invalid={Boolean(fieldErrors.maxActiveInterns)}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting
              ? hasProfile
                ? 'Saving…'
                : 'Creating…'
              : hasProfile
                ? 'Save changes'
                : 'Create profile'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
