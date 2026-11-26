'use client';

// Email verification (6-digit code). Every new account — students who
// register, and mentors/admins created by an administrator — lands here after
// signing in until the code emailed to their address is confirmed. The
// backend refuses every other endpoint for an unverified account.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import AuthShell from '@/components/auth-shell';
import { BrandLoader } from '@/components/brand-loader';
import { Alert, Button, Field, TextInput } from '@/components/ui';

const RESEND_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, loading, passwordChangeRequired, refresh, signOut } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // A code was just sent at registration / sign-in, so start with a cooldown.
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  // Registration reports `?sent=0` when the first email could not be sent.
  // In that case there is no code on its way, so allow an immediate resend.
  const [initialSendFailed, setInitialSendFailed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sent') === '0') {
      setInitialSendFailed(true);
      setCooldown(0);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (passwordChangeRequired || user?.mustChangePassword) {
      router.replace('/change-password');
    } else if (!user) {
      router.replace('/login');
    } else if (user.emailVerified !== false) {
      router.replace('/dashboard');
    }
  }, [loading, user, passwordChangeRequired, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);
    if (!/^\d{6}$/.test(code)) {
      setFieldError('Enter the 6-digit code from the email.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await api.post('/api/auth/verify-email', { code });
      await refresh();
      router.replace('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(parseApiError(err), 'Could not verify the code.'));
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      await api.post('/api/auth/verify-email/resend', {});
      setInitialSendFailed(false);
      setNotice('A new code is on its way. Check your inbox (and the spam folder).');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      const message = apiErrorMessage(parseApiError(err), 'Could not send a new code.');
      // Server cooldown ("Please wait N seconds…"): sync the button timer.
      const wait = /wait (\d+) seconds?/i.exec(message);
      if (wait) setCooldown(Number(wait[1]));
      setError(message);
    } finally {
      setResending(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  if (loading || !user || user.emailVerified !== false) {
    return <BrandLoader hint="Checking your account…" />;
  }

  return (
    <AuthShell
      panelTitle="One quick step"
      panelBody="We confirm every email address so certificates, offers and password resets always reach the right person."
    >
      <div>
        <h1 className="font-serif text-[28px] font-bold leading-[1.1] tracking-[-0.035em] text-ink">
          Verify your email
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-secondary text-pretty">
          {initialSendFailed ? 'We will send a 6-digit code to' : 'We sent a 6-digit code to'}{' '}
          <span className="font-semibold text-ink">{user.email}</span>. Enter it
          below to finish setting up your account. The code expires in 15
          minutes.
        </p>

        {initialSendFailed && !notice && !error && (
          <div className="mt-6">
            <Alert variant="warning" title="Email not sent yet">
              We could not send your verification email. Use “Resend code” to try again.
            </Alert>
          </div>
        )}

        {notice && (
          <div className="mt-6">
            <Alert variant="success" title="Code sent">{notice}</Alert>
          </div>
        )}
        {error && (
          <div className="mt-6">
            <Alert variant="error" title="Not verified">{error}</Alert>
          </div>
        )}

        <form onSubmit={(e) => void handleVerify(e)} className="mt-7 space-y-5" noValidate>
          <Field label="Verification code" htmlFor="code" error={fieldError ?? undefined}>
            <TextInput
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setFieldError(null);
              }}
              placeholder="123456"
              readOnly={submitting}
              invalid={Boolean(fieldError)}
              className="text-center font-mono text-2xl tracking-[0.5em]"
            />
          </Field>

          <Button type="submit" loading={submitting} className="w-full" size="lg">
            {submitting ? 'Verifying…' : 'Verify email'}
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Button
            variant="ghost"
            size="sm"
            disabled={cooldown > 0 || resending}
            loading={resending}
            onClick={() => void handleResend()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
            Use a different account
          </Button>
        </div>

        <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-muted">
          Didn&apos;t get it? Codes can take a minute to arrive. Check your spam
          or promotions folder, then use “Resend code”. If your address is
          wrong, sign out and register again with the correct one.
        </p>
      </div>
    </AuthShell>
  );
}
