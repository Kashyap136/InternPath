'use client';

// Client-side route guard for authenticated pages. While the session is being
// restored we show a full-page loading state; unauthenticated visitors are
// sent to /login; users who must change their password are sent to
// /change-password (the only endpoint the backend will accept for them).
//
// When a previously signed-in session ends (expired or invalidated), the
// redirect carries `?expired=1` so the login screen can explain what happened
// and show the session notice (spec §19.3, F-09).

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { BrandLoader } from '@/components/brand-loader';
import { Button } from '@/components/ui';
import { useSteadyLoading } from '@/lib/use-steady-loading';

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, passwordChangeRequired, refresh } = useAuth();
  const router = useRouter();
  const hadUser = useRef(false);

  // Full-screen branded loader while the session is restored. The gate shows
  // immediately (no artificial delay — session restoration is the app's
  // entry point), keeps a short minimum so it never flashes, and is force-
  // hidden after a safety bound so a hung /api/auth/me call can never trap
  // the user behind it (the redirect effect below still fires).
  const showLoader = useSteadyLoading(loading, {
    delayMs: 0,
    minMs: 500,
    maxMs: 12000,
  });

  useEffect(() => {
    if (user) hadUser.current = true;
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (passwordChangeRequired) {
      router.replace('/change-password');
      return;
    }
    if (!user) {
      router.replace(hadUser.current ? '/login?expired=1' : '/login');
      return;
    }
    if (user.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [loading, user, passwordChangeRequired, router]);

  if (showLoader) {
    return <BrandLoader hint="Preparing your workspace…" />;
  }

  if (loading) {
    // The safety bound has force-hidden the loader while the session check
    // is still in flight. Rendering `null` here would leave a permanent
    // blank page when /api/auth/me hangs, so show an honest recovery state
    // with a retry action instead (the redirect effect still fires once the
    // request settles).
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-4 text-center">
        <p className="font-serif text-xl font-semibold text-ink">
          Still checking your session…
        </p>
        <p className="max-w-sm text-sm text-secondary">
          This is taking longer than expected. You can retry now or continue to
          the sign-in page.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.replace('/login')}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (!user || user.mustChangePassword || passwordChangeRequired) {
    // No loader shown (fast settle): render nothing while the redirect
    // effect above routes the user to the right place.
    return null;
  }

  return <>{children}</>;
}
