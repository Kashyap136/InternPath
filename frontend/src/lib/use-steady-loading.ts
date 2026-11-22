'use client';

// useSteadyLoading — keeps a full-screen loader honest and stable.
//
// A bare `isLoading` flag is a poor gate for a branded loading screen:
// a fetch that resolves in 60 ms would flash the overlay for a few frames,
// and a slow fetch would leave it up until the very last byte even though
// the page could have been revealed. This hook smooths both edges:
//
//  - `delayMs` — loads shorter than this never show the overlay at all
//                (no flicker for instant loads). With `delayMs: 0` the
//                overlay is visible from the very first render (including
//                server-rendered HTML), which is what entry-point gates
//                such as session restoration want: the branded screen is
//                the first thing the user sees, never a blank page.
//  - `minMs`   — once shown, the overlay stays at least this long
//                (no half-visible flash when content arrives mid-fade).
//  - `maxMs`   — safety bound: if the underlying flag stays `true`
//                continuously longer than this, the overlay is force-
//                hidden so a hung request can never trap the user. The
//                guarded content still renders its own inline loading or
//                error states, so revealing early is always safe.
//
// All timers are cleared on unmount and on flag flips; no state updates
// are issued after cleanup.

import { useEffect, useRef, useState } from 'react';

export function useSteadyLoading(
  isLoading: boolean,
  {
    delayMs = 180,
    minMs = 700,
    maxMs = 12000,
  }: { delayMs?: number; minMs?: number; maxMs?: number } = {}
): boolean {
  // `delayMs: 0` means "the loader is the entry state": show it on the first
  // render whenever the guarded content is not ready yet.
  const [shown, setShown] = useState(isLoading && delayMs === 0);
  const shownAtRef = useRef<number | null>(shown ? Date.now() : null);

  useEffect(() => {
    // Post-hydration sync: the ref initializer ran before hydration, so the
    // timestamp is already set; but if `shown` was flipped true by a timer,
    // record the moment here.
    if (shown && shownAtRef.current === null) {
      shownAtRef.current = Date.now();
    }

    if (!isLoading) {
      if (!shown) return;
      // Respect the minimum display time before hiding.
      const elapsed = shownAtRef.current !== null ? Date.now() - shownAtRef.current : 0;
      if (elapsed >= minMs) {
        shownAtRef.current = null;
        setShown(false);
        return;
      }
      const hideTimer = window.setTimeout(() => {
        shownAtRef.current = null;
        setShown(false);
      }, minMs - elapsed);
      return () => window.clearTimeout(hideTimer);
    }

    if (shown) {
      // Already visible — only the safety bound applies.
      const safetyTimer = window.setTimeout(() => {
        shownAtRef.current = null;
        setShown(false);
      }, maxMs);
      return () => window.clearTimeout(safetyTimer);
    }

    const showTimer = window.setTimeout(() => {
      shownAtRef.current = Date.now();
      setShown(true);
    }, delayMs);

    const safetyTimer = window.setTimeout(() => {
      shownAtRef.current = null;
      setShown(false);
    }, maxMs);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(safetyTimer);
    };
    // `shown` is intentionally read but not a dependency: visibility changes
    // are driven by the timers created here, and adding it would re-run the
    // effect (and reset the safety bound) on every show/hide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, delayMs, minMs, maxMs]);

  return shown;
}
