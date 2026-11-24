'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { parseApiError, type FieldErrors } from '@/lib/form-errors';
import { Alert, Button, Field, LoadingState, PasswordInput, Wordmark } from '@/components/ui';
import { ArrowLeftIcon, CheckIcon, KeyIcon } from '@/components/icons';

const LABELS: Record<string, string> = {
  currentPassword: 'Current password',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
};

export default function ChangePasswordPage() {
  const { user, loading, passwordChangeRequired, signOut } = useAuth();
  const router = useRouter();

  const forced = passwordChangeRequired || Boolean(user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user && !passwordChangeRequired) {
      router.replace('/login');
    }
  }, [loading, user, passwordChangeRequired, router]);

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!forced && !currentPassword)
      errors.currentPassword = 'Enter your current password.';
    if (!newPassword) errors.newPassword = 'Choose a new password.';
    else if (newPassword.length < 8)
      errors.newPassword = 'Use at least 8 characters.';
    if (!confirmPassword)
      errors.confirmPassword = 'Re-enter your new password.';
    else if (newPassword !== confirmPassword)
      errors.confirmPassword = 'The two passwords do not match.';
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
      await api.post('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      // The backend invalidates ALL sessions on password change, including
      // this one → the user must sign in again with the new password. Use a
      // hard navigation so the success query survives and stale in-memory
      // auth state is discarded.
      window.location.assign('/login?changed=1');
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

  if (loading || (!user && !passwordChangeRequired)) {
    return <LoadingState variant="page" label="Loading…" />;
  }

  // Split auth layout (Pattern A) with page-specific header
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Wordmark href="/dashboard" />
          <div className="flex items-center gap-2">
            {forced ? (
              <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
                Sign out
              </Button>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="hidden rounded-md px-3 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-subtle hover:text-ink md:block"
                >
                  Go to dashboard
                </Link>
                <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div aria-hidden="true" className="bg-hero-wash pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-stretch gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-12">
          {/* Context panel — large screens only */}
          <aside className="hidden self-stretch lg:block">
            <div className="bg-evergreen relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-[28px] p-10 shadow-panel">
              <div aria-hidden="true" className="bg-line-grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-accent-300 ring-1 ring-white/15">
                <KeyIcon className="h-6 w-6" />
              </span>
              <p className="relative mt-8 font-serif text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-white text-balance">
                Choose a new password
              </p>
              <ul className="relative mt-auto space-y-4 pt-10 text-[15px] leading-relaxed text-primary-100">
                {[
                  'At least 8 characters.',
                  'You’ll be signed out on every device and asked to sign in again.',
                  ...(forced ? ['Your temporary password works only once.'] : []),
                ].map((point) => (
                  <li key={point} className="flex gap-3">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-400/20 text-accent-300 ring-1 ring-accent-300/40">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Form column — elevated card */}
          <div className="mx-auto w-full max-w-[440px] self-center lg:mx-0 lg:justify-self-center">
            <div className="rise-in rounded-[24px] border border-line bg-white p-6 shadow-panel sm:p-9">
              {!forced && (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-primary-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-700"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to dashboard
                </Link>
              )}

              <h1 className={`font-serif text-[28px] font-bold leading-[1.1] tracking-[-0.035em] text-ink ${!forced ? 'mt-5' : 'mt-0'}`}>
                {forced ? 'Set a new password' : 'Change password'}
              </h1>
              <p className="mt-1.5 max-w-[30rem] text-sm leading-relaxed text-secondary text-pretty">
                After changing your password you will be signed in again with the new password.
              </p>

              {forced && (
                <div className="mt-6">
                  <Alert variant="warning" title="Password change required">
                    Your account is using a temporary password. Set a new password to continue.
                  </Alert>
                </div>
              )}

              {error && (
                <div className="mt-6">
                  <Alert variant="error" title="Password change failed">{error}</Alert>
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

                <Field
                  label="Current password"
                  htmlFor="currentPassword"
                  hint={forced ? 'The temporary password you were given.' : undefined}
                  error={fieldErrors.currentPassword}
                >
                  <PasswordInput
                    id="currentPassword"
                    autoComplete="current-password"
                    required={forced}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    onBlur={() => handleBlur('currentPassword')}
                    placeholder="••••••••"
                    readOnly={submitting}
                    invalid={Boolean(fieldErrors.currentPassword)}
                  />
                </Field>

                <Field
                  label="New password"
                  htmlFor="newPassword"
                  hint="At least 8 characters."
                  error={fieldErrors.newPassword}
                >
                  <PasswordInput
                    id="newPassword"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onBlur={() => handleBlur('newPassword')}
                    placeholder="••••••••"
                    readOnly={submitting}
                    invalid={Boolean(fieldErrors.newPassword)}
                  />
                </Field>

                <Field
                  label="Confirm new password"
                  htmlFor="confirmPassword"
                  error={fieldErrors.confirmPassword}
                >
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="••••••••"
                    readOnly={submitting}
                    invalid={Boolean(fieldErrors.confirmPassword)}
                  />
                </Field>

                <Button type="submit" loading={submitting} className="w-full" size="lg">
                  {submitting ? 'Saving…' : 'Save new password'}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>
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