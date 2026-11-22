'use client';

// Google authentication button (Phase 9 requirement #4; Phase 12 §5.1 update).
//
// Phase 12 change: the control is ALWAYS visible so authentication options
// are transparent — when Google OAuth is not configured the button renders
// disabled with an explanatory configuration-unavailable note instead of
// being silently hidden.
//
// States:
// - `pending`     → capability check in flight; button rendered disabled
//   (layout reserved, nothing submitted).
// - `enabled`     → full-page navigation to the backend OAuth start endpoint
//   (`/api/backend/api/auth/google`, proxied by the Next.js rewrite to
//   Express, which 302s to Google Accounts). The callback sets the session
//   cookie and redirects — state handling stays entirely server-side.
// - `unavailable` → credentials not configured (or the check failed):
//   disabled button + explanation; the email/password form remains the way in.

import { useEffect, useState } from 'react';

type Providers = {
  providers: {
    credentials: boolean;
    google: boolean;
  };
};

/** Official Google "G" mark (brand asset — see the branding note in the header). */
export function GoogleMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.19 7.19 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.53 11.53 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/** Horizontal rule with a centred label, shown above the button. */
export function GoogleAuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export default function GoogleAuthButton({
  mode,
  className = '',
}: {
  /** Label intent: `signin` → "Continue with Google", `signup` → "Sign up with Google". */
  mode: 'signin' | 'signup';
  className?: string;
}) {
  const [state, setState] = useState<'pending' | 'enabled' | 'unavailable'>('pending');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/backend/api/auth/providers')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Providers | null) => {
        if (cancelled) return;
        setState(data?.providers?.google ? 'enabled' : 'unavailable');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buttonClasses = `inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-line-input bg-white text-[15px] font-medium text-ink transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`;

  const label = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google';

  let control: React.ReactNode;
  if (state === 'enabled') {
    control = (
      <a href="/api/backend/api/auth/google" className={buttonClasses}>
        <GoogleMark className="h-5 w-5" />
        {label}
      </a>
    );
  } else {
    control = (
      <>
        <button
          type="button"
          disabled
          className={buttonClasses}
          aria-describedby={state === 'unavailable' ? 'google-auth-unavailable' : undefined}
        >
          <GoogleMark className={`h-5 w-5 ${state === 'unavailable' ? 'opacity-50' : ''}`} />
          {label}
        </button>
        {state === 'unavailable' && (
          <p
            id="google-auth-unavailable"
            className="px-1 text-center text-xs leading-relaxed text-muted"
          >
            Google sign-in is not configured on this InternPath installation yet —
            please sign in with your email and password. An administrator can
            enable it later (see the setup guide, Google OAuth section).
          </p>
        )}
      </>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="google-auth-section">
      <GoogleAuthDivider />
      {control}
    </div>
  );
}
