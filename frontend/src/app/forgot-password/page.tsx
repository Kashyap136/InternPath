'use client';

// Self-service password reset with an emailed 6-digit code.
// Step 1: request a code (the response never reveals whether the account
// exists). Step 2: enter the code and a new password; every existing session
// is signed out and the user signs in again.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import AuthShell from '@/components/auth-shell';
import { Alert, Button, Field, PasswordInput, TextInput } from '@/components/ui';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<'email' | 'code' | 'newPassword' | 'confirmPassword', string>>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setErrors({ email: 'Enter the email address of your account.' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/api/auth/forgot-password', {
        email: email.trim(),
      });
      setNotice(res.message);
      setStep('reset');
    } catch (err) {
      setError(apiErrorMessage(parseApiError(err), 'Could not send the code.'));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const next: Errors = {};
    if (!/^\d{6}$/.test(code)) next.code = 'Enter the 6-digit code from the email.';
    if (newPassword.length < 8) next.newPassword = 'Use at least 8 characters.';
    if (confirmPassword !== newPassword) next.confirmPassword = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', {
        email: email.trim(),
        code,
        newPassword,
      });
      router.replace('/login?reset=1');
    } catch (err) {
      setError(apiErrorMessage(parseApiError(err), 'Could not reset the password.'));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      panelTitle="Locked out? Get back in"
      panelBody="We email a one-time code to the address on your account. Resetting your password signs you out everywhere else."
    >
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
          Reset your password
        </h1>
        <p className="mt-5 max-w-[34rem] text-base leading-7 text-body text-pretty">
          {step === 'request'
            ? 'Enter the email address you use for InternPath and we will send you a 6-digit code.'
            : `Enter the code sent to ${email.trim()} and choose a new password.`}
        </p>

        {notice && step === 'reset' && (
          <div className="mt-8">
            <Alert variant="info" title="Check your email">{notice}</Alert>
          </div>
        )}
        {error && (
          <div className="mt-8">
            <Alert variant="error" title="Something went wrong">{error}</Alert>
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={(e) => void requestCode(e)} className="mt-9 space-y-5" noValidate>
            <Field label="Email" htmlFor="email" error={errors.email}>
              <TextInput
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                readOnly={busy}
                invalid={Boolean(errors.email)}
              />
            </Field>
            <Button type="submit" loading={busy} className="w-full" size="lg">
              {busy ? 'Sending…' : 'Send reset code'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => void resetPassword(e)} className="mt-9 space-y-5" noValidate>
            <Field label="6-digit code" htmlFor="code" error={errors.code}>
              <TextInput
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                readOnly={busy}
                invalid={Boolean(errors.code)}
                className="font-mono tracking-[0.3em]"
              />
            </Field>
            <Field label="New password" htmlFor="newPassword" hint="At least 8 characters." error={errors.newPassword}>
              <PasswordInput
                id="newPassword"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                readOnly={busy}
                invalid={Boolean(errors.newPassword)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmPassword" error={errors.confirmPassword}>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                readOnly={busy}
                invalid={Boolean(errors.confirmPassword)}
              />
            </Field>
            <Button type="submit" loading={busy} className="w-full" size="lg">
              {busy ? 'Saving…' : 'Set new password'}
            </Button>
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void requestCode()}>
                Send a new code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setStep('request');
                  setCode('');
                  setError(null);
                  setNotice(null);
                }}
              >
                Use a different email
              </Button>
            </div>
          </form>
        )}

        <p className="mt-10 border-t border-line pt-6 text-center text-sm text-secondary">
          Remembered it?{' '}
          <Link
            href="/login"
            className="font-medium text-primary-700 underline-offset-4 hover:text-primary-800 hover:underline"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
