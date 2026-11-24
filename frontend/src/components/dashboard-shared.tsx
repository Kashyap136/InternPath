'use client';

// Building blocks shared by the three role dashboards: a cancellable data
// loader, greeting helpers and the account summary card.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useApiErrorHandler, roleLabels } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AuthUser } from '@/types';
import { Avatar, ButtonLink, Panel } from '@/components/ui';

export function useAsyncLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const handleApiError = useApiErrorHandler();

  const reload = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        handleApiError(err);
        if (active)
          setError(
            err instanceof ApiError ? err.message : 'Failed to load data'
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handleApiError]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  return { data, error, loading, reload };
}

/** First name for greetings, ignoring bracketed suffixes such as "(Demo)". */
export function firstName(fullName: string): string {
  return fullName.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/)[0] ?? fullName;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AccountCard({ user }: { user: AuthUser }) {
  return (
    <Panel title="Account">
      <div className="flex items-center gap-3">
        <Avatar name={user.fullName} className="h-10 w-10 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line border-t border-line text-sm">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Role</dt>
          <dd className="font-medium text-ink">{roleLabels[user.role]}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Member since</dt>
          <dd className="font-medium text-ink">{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href="/profile" variant="secondary" size="sm">
          Edit profile
        </ButtonLink>
        <ButtonLink href="/change-password" variant="ghost" size="sm">
          Change password
        </ButtonLink>
      </div>
    </Panel>
  );
}
