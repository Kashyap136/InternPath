'use client';

// Shared data-loading hook for authenticated pages (Phase 3).
//
// Extracted from the pattern established in (app)/dashboard/page.tsx
// (`useAsyncLoad`) so new pages reuse one implementation instead of
// duplicating it. Differences from the dashboard-private hook:
//  - returns a `reload` function for retry affordances
//  - errors already render through the page's ErrorState; the auth side
//    reacts to 401s globally (api.ts → session-events → auth-context).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { useApiErrorHandler } from '@/lib/auth-context';

interface ApiLoadResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useApiLoad<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<string | number | boolean> = []
): ApiLoadResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const handleApiError = useApiErrorHandler();
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err: unknown) => {
        handleApiError(err);
        if (active) setError(err instanceof ApiError ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // deps Drive refetching when a page's query inputs change; loaderRef
    // always points at the freshest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, error, loading, reload };
}
