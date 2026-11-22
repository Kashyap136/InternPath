'use client';

// Shared student & mentor profile forms. Both handle the
// GET → create (POST) / update (PUT) lifecycle of /api/profiles/*/me and show
// every validation message the backend returns, mapped to its field
// (spec §18.2, fixes F-04). Client-side checks run first; server messages are
// always displayed.

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { parseApiError, type FieldErrors } from '@/lib/form-errors';
import type { Domain, MentorProfile, StudentProfile } from '@/types';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  TextArea,
  TextInput,
} from '@/components/ui';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function focusFirstError(
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
function ValidationSummary({
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

/* ------------------------------------------------------------------ */
/* Student profile                                                     */
/* ------------------------------------------------------------------ */

const STUDENT_LABELS: Record<string, string> = {
  institution: 'Institution',
  degree: 'Degree',
  yearOfStudy: 'Year of study',
  graduationYear: 'Graduation year',
  skills: 'Declared skills',
  github: 'GitHub profile',
  portfolio: 'Portfolio',
  bio: 'Bio',
};

// Maps backend field keys to the frontend control ids.
const STUDENT_FIELD_MAP = {
  declaredSkills: 'skills',
  githubProfileUrl: 'github',
  portfolioUrl: 'portfolio',
};

export function StudentProfileForm({
  initial,
  onSaved,
}: {
  initial: StudentProfile | null;
  onSaved: (p: StudentProfile) => void | Promise<void>;
}) {
  const hasProfile = Boolean(initial);

  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [degree, setDegree] = useState(initial?.degree ?? '');
  const [yearOfStudy, setYearOfStudy] = useState(
    initial ? String(initial.yearOfStudy) : ''
  );
  const [graduationYear, setGraduationYear] = useState(
    initial ? String(initial.graduationYear) : ''
  );
  const [skills, setSkills] = useState(initial?.declaredSkills.join(', ') ?? '');
  const [github, setGithub] = useState(initial?.githubProfileUrl ?? '');
  const [portfolio, setPortfolio] = useState(initial?.portfolioUrl ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initial) return;
    setInstitution(initial.institution);
    setDegree(initial.degree);
    setYearOfStudy(String(initial.yearOfStudy));
    setGraduationYear(String(initial.graduationYear));
    setSkills(initial.declaredSkills.join(', '));
    setGithub(initial.githubProfileUrl ?? '');
    setPortfolio(initial.portfolioUrl ?? '');
    setBio(initial.bio ?? '');
  }, [initial]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const now = new Date().getFullYear();

    if (!institution.trim()) errors.institution = 'Enter your institution.';
    if (!degree.trim()) errors.degree = 'Enter your degree or programme.';

    const year = Number(yearOfStudy);
    if (!yearOfStudy.trim()) errors.yearOfStudy = 'Enter your year of study.';
    else if (!Number.isInteger(year) || year < 1)
      errors.yearOfStudy = 'Year of study must be a whole number of 1 or more.';

    const grad = Number(graduationYear);
    if (!graduationYear.trim())
      errors.graduationYear = 'Enter your graduation year.';
    else if (!Number.isInteger(grad) || grad < now)
      errors.graduationYear = `Graduation year must be ${now} or later.`;

    if (github.trim() && !isHttpUrl(github.trim()))
      errors.github = 'Enter a full URL starting with https://.';
    if (portfolio.trim() && !isHttpUrl(portfolio.trim()))
      errors.portfolio = 'Enter a full URL starting with https://.';

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
      institution: institution.trim(),
      degree: degree.trim(),
      yearOfStudy: yearOfStudy ? Number(yearOfStudy) : undefined,
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
      declaredSkills: skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      githubProfileUrl: github.trim() || null,
      portfolioUrl: portfolio.trim() || null,
      bio: bio.trim() || null,
    };

    try {
      const res = hasProfile
        ? await api.put<{ profile: StudentProfile }>(
            '/api/profiles/student/me',
            body
          )
        : await api.post<{ profile: StudentProfile }>(
            '/api/profiles/student/me',
            body
          );
      void onSaved(res.profile);
      setSaved(true);
    } catch (err) {
      const parsed = parseApiError(err, STUDENT_FIELD_MAP);
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
      title={hasProfile ? 'Student profile' : 'Create your student profile'}
      subtitle={
        hasProfile
          ? 'Update your academic details.'
          : 'Add your institution and study details to complete your profile.'
      }
    >
      {saved && (
        <div className="mb-5">
          <Alert variant="success" title="Profile saved">
            Your student profile was saved.
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
          labels={STUDENT_LABELS}
          summaryRef={summaryRef}
        />

        <Field
          label="Institution"
          htmlFor="institution"
          error={fieldErrors.institution}
        >
          <TextInput
            id="institution"
            value={institution}
            onChange={(e) => {
              setInstitution(e.target.value);
              markEdited();
            }}
            onBlur={() => handleBlur('institution')}
            placeholder="University of Example"
            autoComplete="organization"
            readOnly={submitting}
            invalid={Boolean(fieldErrors.institution)}
          />
        </Field>

        <Field label="Degree" htmlFor="degree" error={fieldErrors.degree}>
          <TextInput
            id="degree"
            value={degree}
            onChange={(e) => {
              setDegree(e.target.value);
              markEdited();
            }}
            onBlur={() => handleBlur('degree')}
            placeholder="B.Sc. Computer Science"
            readOnly={submitting}
            invalid={Boolean(fieldErrors.degree)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Year of study"
            htmlFor="yearOfStudy"
            error={fieldErrors.yearOfStudy}
          >
            <TextInput
              id="yearOfStudy"
              type="number"
              inputMode="numeric"
              min={1}
              value={yearOfStudy}
              onChange={(e) => {
                setYearOfStudy(e.target.value);
                markEdited();
              }}
              onBlur={() => handleBlur('yearOfStudy')}
              placeholder="2"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.yearOfStudy)}
            />
          </Field>

          <Field
            label="Graduation year"
            htmlFor="graduationYear"
            error={fieldErrors.graduationYear}
          >
            <TextInput
              id="graduationYear"
              type="number"
              inputMode="numeric"
              min={new Date().getFullYear()}
              value={graduationYear}
              onChange={(e) => {
                setGraduationYear(e.target.value);
                markEdited();
              }}
              onBlur={() => handleBlur('graduationYear')}
              placeholder={String(new Date().getFullYear() + 2)}
              readOnly={submitting}
              invalid={Boolean(fieldErrors.graduationYear)}
            />
          </Field>
        </div>

        <Field
          label="Declared skills"
          htmlFor="skills"
          error={fieldErrors.skills}
          hint="Comma-separated, e.g. JavaScript, React, SQL"
        >
          <TextInput
            id="skills"
            value={skills}
            onChange={(e) => {
              setSkills(e.target.value);
              markEdited();
            }}
            onBlur={() => handleBlur('skills')}
            placeholder="TypeScript, React, PostgreSQL"
            readOnly={submitting}
            invalid={Boolean(fieldErrors.skills)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="GitHub profile"
            htmlFor="github"
            error={fieldErrors.github}
            optional
          >
            <TextInput
              id="github"
              type="url"
              value={github}
              onChange={(e) => {
                setGithub(e.target.value);
                markEdited();
              }}
              onBlur={() => handleBlur('github')}
              placeholder="https://github.com/you"
              autoComplete="url"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.github)}
            />
          </Field>

          <Field
            label="Portfolio"
            htmlFor="portfolio"
            error={fieldErrors.portfolio}
            optional
          >
            <TextInput
              id="portfolio"
              type="url"
              value={portfolio}
              onChange={(e) => {
                setPortfolio(e.target.value);
                markEdited();
              }}
              onBlur={() => handleBlur('portfolio')}
              placeholder="https://you.example"
              autoComplete="url"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.portfolio)}
            />
          </Field>
        </div>

        <Field
          label="Bio"
          htmlFor="bio"
          hint="Optional, up to 1000 characters."
          optional
        >
          <TextArea
            id="bio"
            rows={4}
            maxLength={1000}
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              markEdited();
            }}
            placeholder="A short summary about you and your interests."
            readOnly={submitting}
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

/* ------------------------------------------------------------------ */
/* Mentor profile                                                      */
/* ------------------------------------------------------------------ */

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
