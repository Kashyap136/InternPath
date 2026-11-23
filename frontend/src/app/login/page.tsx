'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import type { FieldErrors } from '@/lib/form-errors';
import { demoNoticeEnabled } from '@/lib/config';
import AuthShell from '@/components/auth-shell';
import { ChevronDownIcon, KeyIcon } from '@/components/icons';
import GoogleAuthButton from '@/components/google-auth-button';
import { Alert, Button, Field, PasswordInput, Spinner, TextInput } from '@/components/ui';

// Public demo accounts (documented in backend/prisma/seed.ts). These are
// intentionally public, fictional academic-demo accounts (ASM-CAND-022) so a
// presenter can sign in to any role during a live demonstration.
const DEMO_ACCOUNTS = [
  { role: 'Administrator', email: 'admin@internpath.demo' },
  { role: 'Mentor', email: 'mentor@internpath.demo' },
  { role: 'Student', email: 'student@internpath.demo' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginForm() {
  const { user, signIn, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const changed = searchParams.get('changed') === '1' || searchParams.get('reset') === '1';
  const expired = searchParams.get('expired') === '1';
  // Google OAuth failures land back on this page with a short, non-sensitive
  // reason (see the backend googleCallback handler). Displayed as a normal
  // form-level alert; the user simply retries — no technical detail shown.
  const oauthError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && user && !user.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Enter your email address.';
    else if (!EMAIL_PATTERN.test(email.trim()))
      errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Enter your password.';
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
      const res = await signIn(email.trim(), password);
      router.replace(
        res.user.mustChangePassword ? '/change-password' : '/dashboard'
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Can't reach InternPath. Check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(account: (typeof DEMO_ACCOUNTS)[number]) {
    // P1-04 fix (comprehensive audit 2026-11-15): demo passwords are no
    // longer embedded in frontend source or the compiled bundle. The helper
    // fills the documented demo EMAIL only; the password comes from the
    // local, access-controlled presentation runbook
    // (docs/07-final/InternPath_Phase_13_Examiner_Presentation_Runbook.md)
    // and is typed by the presenter. Production builds contain no
    // credentials, and the helper itself renders only when the local
    // NEXT_PUBLIC_DEMO_NOTICE_ENABLED='true' opt-in is set.
    setEmail(account.email);
    setPassword('');
    setError(null);
    setFieldErrors({});
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
        Sign in to InternPath
      </h1>
      <p className="mt-5 max-w-[34rem] text-base leading-7 text-body text-pretty">
        Use the email address your account was created with. Mentors and
        administrators receive a temporary password from an administrator and
        set their own on first sign-in.
      </p>

      {changed && (
        <div className="mt-8">
          <Alert variant="success" title="Password changed">
            Please sign in with your new password.
          </Alert>
        </div>
      )}

      {expired && !changed && (
        <div className="mt-8">
          <Alert variant="info" title="Your session ended">
            For your security we signed you out. Sign in again to continue.
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-8">
          <Alert variant="error" title="Could not sign in">{error}</Alert>
        </div>
      )}

      {oauthError && !error && (
        <div className="mt-8">
          <Alert variant="error" title="Could not sign in with Google">
            {oauthError}
          </Alert>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-9 space-y-5"
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
                      {key === 'email' ? 'Email' : 'Password'}
                    </a>
                    : {message}
                  </li>
                ))}
              </ul>
            </Alert>
          </div>
        )}

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

        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            placeholder="••••••••"
            readOnly={submitting}
            invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full" size="lg">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {/* Google sign-in (feature-detected; hidden entirely when OAuth is
           not configured so no control is shown that would fail). */}
      <GoogleAuthButton mode="signin" className="mt-6" />

      {/* Collapsible demo helper — ivory card with colored left edge, only
           expanded on request, gated by demoNoticeEnabled (ASM-CAND-022). */}
      {demoNoticeEnabled && (
        <div className="mt-9">
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            aria-expanded={demoOpen}
            aria-controls="demo-accounts"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white p-4 text-left transition-colors hover:border-line-input hover:bg-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-700"
          >
            <span className="flex items-center gap-2.5 text-sm font-medium text-body">
              <KeyIcon className="h-4 w-4 text-primary-700" />
              Presenting? Use a demo account
            </span>
            <ChevronDownIcon
              className={`h-4 w-4 text-muted transition-transform duration-200 ${
                demoOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {demoOpen && (
            <div id="demo-accounts" className="mt-4">
              <p className="px-1 text-xs text-muted">
                Pick a role to fill its demo email. For security the password is
                not stored in the application — take it from the local
                presentation runbook and type it in.
              </p>
              <div className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-700"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        {account.role}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {account.email}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Self-service recovery: a 6-digit code is emailed to the account
          address (/forgot-password). Administrators can still reset a
          password from the admin console. */}
      <p className="mt-4 text-center text-[13px] leading-relaxed text-muted">
        Trouble signing in?{' '}
        <Link
          href="/forgot-password"
          className="font-medium text-primary-700 underline-offset-4 hover:text-primary-800 hover:underline"
        >
          Reset your password
        </Link>{' '}
        with a code sent to your email.
      </p>

      <p className="mt-10 border-t border-line pt-6 text-center text-sm text-secondary">
        New to InternPath?{' '}
        <Link
          href="/register"
          className="font-medium text-primary-700 underline-offset-4 hover:text-primary-800 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-700"
        >
          Register as a student
        </Link>
      </p>
    </div>
  );
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

export default function LoginPage() {
  return (
    <AuthShell
      panelTitle="One account, every role"
      panelBody="Students apply and build; mentors review and guide; administrators run the platform. Use the email address your account was created with — mentors and administrators set their own password on first sign-in."
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-6 w-6 text-primary-700" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
