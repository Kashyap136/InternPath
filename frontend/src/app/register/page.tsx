'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { parseApiError, type FieldErrors } from '@/lib/form-errors';
import AuthShell from '@/components/auth-shell';
import { Alert, Button, Checkbox, Field, PasswordInput, TextInput } from '@/components/ui';
import GoogleAuthButton from '@/components/google-auth-button';
import { CheckIcon } from '@/components/icons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user && !user.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!fullName.trim()) errors.fullName = 'Enter your full name.';
    else if (fullName.trim().length < 2)
      errors.fullName = 'Enter your full name as it should appear.';

    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(email.trim()))
      errors.email = 'Enter a valid email address.';

    if (!password) errors.password = 'Choose a password.';
    else if (password.length < 8)
      errors.password = 'Use at least 8 characters.';

    if (!privacyAccepted)
      errors.privacyAccepted = 'Please accept the participation policy to continue.';

    return errors;
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
    setError(null);
    setSubmitted(true);

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      focusFirstError(clientErrors, summaryRef);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await api.post<{ user: { emailVerified?: boolean } }>('/api/auth/register', {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        privacyAccepted,
      });
      await refresh();
      // New accounts confirm their address with the emailed 6-digit code.
      router.replace(res.user.emailVerified === false ? '/verify-email' : '/dashboard');
    } catch (err) {
      const parsed = parseApiError(err);
      const hasFieldErrors = Object.keys(parsed.fieldErrors).length > 0;
      if (hasFieldErrors) setFieldErrors(parsed.fieldErrors);
      const formLevel = parsed.formError ?? parsed.summaryErrors.join(' ');
      if (formLevel) setError(formLevel);
      if (hasFieldErrors) focusFirstError(parsed.fieldErrors, summaryRef);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Your internship pathway starts here"
      panelBody="You'll need"
      panelList={
        <>
          <ul className="mt-3 space-y-2 text-sm text-primary-100">
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0" />
              Your full name and an email address
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0" />
              A password of at least 8 characters
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 shrink-0" />
              About two minutes to add your study details afterwards
            </li>
          </ul>
          <p className="mt-4 text-[13px] text-primary-200">
            Mentor and administrator accounts are created by administrators.
          </p>
        </>
      }
    >
      <div>
        <h1 className="font-serif text-[28px] font-bold leading-[1.1] tracking-[-0.035em] text-ink">
          Create your student account
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-secondary text-pretty">
          Register quickly with role-based access — your account will start as
          a student. Mentors and administrators are created by administrators
          with secure, temporary passwords.
        </p>

        {error && (
          <div className="mt-6">
            <Alert variant="error" title="Registration failed">{error}</Alert>
          </div>
        )}

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-7 space-y-5"
          noValidate
        >
          {Object.keys(fieldErrors).length >= 2 && (
            <div ref={summaryRef} tabIndex={-1} className="focus:outline-hidden">
              <Alert variant="error" title="Fix the following:">
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {Object.entries(fieldErrors).map(([key, message]) => (
                    <li key={key}>
                      <a
                        href={`#${key}`}
                        className="font-medium underline underline-offset-2"
                      >
                        {LABELS[key] ?? key}
                      </a>
                      : {message}
                    </li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}

          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <TextInput
              id="fullName"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => handleBlur('fullName')}
              placeholder="Jane Doe"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.fullName)}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <TextInput
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.email)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            hint="At least 8 characters."
            error={fieldErrors.password}
          >
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="••••••••"
              readOnly={submitting}
              invalid={Boolean(fieldErrors.password)}
            />
          </Field>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-body">Privacy notice</legend>
            <div className="rounded-lg border border-line bg-surface-subtle p-4">
              <p className="text-sm leading-relaxed text-secondary">
                InternPath stores the details you provide (name, email, study
                information and internship work) to operate your account and
                internships. Public certificate verification shows only your
                name, internship and issue date — never contact details or
                scores. Read the{' '}
                <Link
                  href="/policy"
                  className="font-medium text-primary-700 underline-offset-4 hover:underline"
                >
                  participation policy
                </Link>{' '}
                for the full details.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="privacyAccepted"
                checked={privacyAccepted}
                onChange={(e) => {
                  setPrivacyAccepted(e.target.checked);
                  if (e.target.checked) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.privacyAccepted;
                      return next;
                    });
                  }
                }}
                className="mt-0.5"
                aria-invalid={Boolean(fieldErrors.privacyAccepted)}
                aria-describedby={
                  fieldErrors.privacyAccepted ? 'privacyAccepted-error' : undefined
                }
                required
              />
              <label
                htmlFor="privacyAccepted"
                className="text-sm leading-relaxed text-secondary"
              >
                I have read the participation policy and consent to my details
                being used to operate my account.
              </label>
            </div>
            {fieldErrors.privacyAccepted && (
              <p
                id="privacyAccepted-error"
                className="ml-6 text-[13px] text-danger-text"
              >
                {fieldErrors.privacyAccepted}
              </p>
            )}
          </fieldset>

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        {/* Google sign-up (feature-detected; hidden entirely when OAuth is
             not configured). Public Google registration always creates a
             STUDENT account — the same rule as the form above — so the two
             paths are offered side by side. */}
        <GoogleAuthButton mode="signup" className="mt-6" />
        <p className="mt-3 px-1 text-center text-[13px] leading-relaxed text-muted">
          Signing up with Google follows the same participation policy, and the
          account starts as a student.
        </p>

        <p className="mt-10 border-t border-line pt-6 text-center text-sm text-secondary">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary-700 underline-offset-4 hover:text-primary-800 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

const LABELS: Record<string, string> = {
  fullName: 'Full name',
  email: 'Email',
  password: 'Password',
  privacyAccepted: 'Privacy acknowledgement',
};

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
