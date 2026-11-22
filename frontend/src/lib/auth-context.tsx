'use client';

// Auth context — restores the session on load and exposes sign in/out.
//
// The backend uses httpOnly, same-origin cookies (via the /api/backend
// rewrite), so the browser just needs `credentials: 'include'` — handled by
// the api client. On mount we call /api/auth/me:
//   200                          → authenticated, user attached
//   401                          → not authenticated
//   403 PASSWORD_CHANGE_REQUIRED → authenticated but must change password
//                                  before any other endpoint works
// The server invalidates ALL sessions on password change, so after a
// successful change the user must sign in again (handled by the
// change-password page).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, isPasswordChangeRequired } from './api';
import { onSessionExpired } from './session-events';
import { isUnauthorized } from './form-errors';
import type { AuthUser, UserRole } from '@/types';

interface LoginResult {
  user: Pick<
    AuthUser,
    'id' | 'email' | 'fullName' | 'role' | 'mustChangePassword'
  >;
  message: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** Session is being restored from /api/auth/me */
  loading: boolean;
  /** Authenticated, but only /api/auth/change-password is allowed */
  passwordChangeRequired: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Update user after a successful password change or profile action */
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: AuthUser }>('/api/auth/me');
      setUserState(res.user);
      setPasswordChangeRequired(false);
    } catch (err) {
      // P2-07 fix (comprehensive audit 2026-11-15): only a definitive 401 (or
      // the password-change gate) means signed-out. A 429 (rate limit) or 5xx
      // is a transient server condition — clearing the user here used to
      // bounce the visitor to /login with a misleading "session expired"
      // message. Leave the existing user state untouched so RequireAuth keeps
      // rendering the workspace; the failing page surfaces its own error.
      if (isUnauthorized(err)) {
        if (isPasswordChangeRequired(err)) {
          setUserState(null);
          setPasswordChangeRequired(true);
        } else {
          setUserState(null);
          setPasswordChangeRequired(false);
        }
      } else if (!isPasswordChangeRequired(err)) {
        // Keep the current state; nothing to change for transient failures.
      }
    }
  }, []);

  useEffect(() => {
    // Any 401 from a data call clears the local session so RequireAuth
    // redirects to /login instead of showing an unrecoverable error (F-09).
    const unsubscribe = onSessionExpired(() => {
      setUserState(null);
      setPasswordChangeRequired(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await api.get<{ user: AuthUser }>('/api/auth/me');
        if (!active) return;
        setUserState(res.user);
        setPasswordChangeRequired(false);
      } catch (err) {
        if (!active) return;
        if (isPasswordChangeRequired(err)) {
          setUserState(null);
          setPasswordChangeRequired(true);
        } else {
          setUserState(null);
          setPasswordChangeRequired(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await api.post<LoginResult>('/api/auth/login', {
        email,
        password,
      });
      // The session cookie is set; load the full current user. If the user
      // must change their password, /me returns 403 and refresh() records
      // passwordChangeRequired instead — the brief login user is still useful
      // for routing to /change-password.
      setUserState(res.user as AuthUser);
      await refresh();
      return res;
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Even if the logout request fails, clear local state.
    } finally {
      setUserState(null);
      setPasswordChangeRequired(false);
    }
  }, []);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    setPasswordChangeRequired(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      passwordChangeRequired,
      signIn,
      signOut,
      refresh,
      setUser,
    }),
    [user, loading, passwordChangeRequired, signIn, signOut, refresh, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}

/**
 * Inspects an error from an authenticated call and, when the session is no
 * longer valid (401), refreshes the auth state. `RequireAuth` then redirects to
 * `/login?expired=1` because a user was previously present (spec §19.3).
 */
export function useApiErrorHandler(): (err: unknown) => void {
  const { refresh } = useAuth();
  return useCallback(
    (err: unknown) => {
      if (isUnauthorized(err)) void refresh();
    },
    [refresh]
  );
}

export const roleLabels: Record<UserRole, string> = {
  STUDENT: 'Student',
  MENTOR: 'Mentor',
  ADMIN: 'Administrator',
};