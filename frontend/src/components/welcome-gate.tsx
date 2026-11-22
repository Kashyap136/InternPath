'use client';

// First-visit welcome experience (Phase 10 §8).
//
// Behaviour contract:
//  - Shows ONCE per browser: a `ip.welcomed=1` localStorage flag is written
//    when the intro completes. Subsequent visits and route changes skip it.
//  - Renders only after mount → no server/client hydration mismatch.
//  - Storage failures are swallowed (private-mode browsers): the gate simply
//    never renders rather than blocking the app.
//  - `prefers-reduced-motion`: a short static branded state (no animation).
//  - No artificial delay: the intro is bounded (~1.9 s) and never pretends
//    the app is loading — content is rendered underneath and interactive
//    after dismissal.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ip.welcomed';
const ANIMATION_MS = 1900;
const STATIC_MS = 900;

export function WelcomeGate() {
  const [phase, setPhase] = useState<'checking' | 'animation' | 'static' | 'done'>('checking');

  useEffect(() => {
    let seenBefore = false;
    try {
      seenBefore = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      // Storage unavailable → behave like a returning visitor (skip the intro).
      seenBefore = true;
    }
    if (seenBefore) {
      setPhase('done');
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? STATIC_MS : ANIMATION_MS;
    setPhase(reducedMotion ? 'static' : 'animation');

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // Non-fatal: worst case the intro plays again next visit.
      }
      setPhase('done');
    }, duration);

    return () => window.clearTimeout(timer);
  }, []);

  if (phase !== 'animation' && phase !== 'static') return null;

  const animated = phase === 'animation';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-canvas ${
        animated ? 'welcome-fade-out' : ''
      }`}
    >
      <div className={animated ? 'welcome-logo-in' : ''}>
        {/* Official logo mark at a comfortable presentation size. The
            transparent variant avoids a hard white box on the ivory canvas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-mark-transparent.png"
          alt=""
          width={120}
          height={120}
          className="h-[120px] w-[120px]"
        />
      </div>

      <div className={`flex flex-col items-center gap-2 ${animated ? 'welcome-text-in' : ''}`}>
        <p className="font-serif text-xl font-semibold text-ink">Welcome to InternPath</p>
        <p className="text-sm text-secondary">Project-based internships, guided end to end</p>
      </div>

      {/* Growth-inspired accent: a sapling-green rule that draws itself in */}
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-line">
        <div className={`h-full w-full origin-left rounded-full bg-primary-600 ${animated ? 'welcome-grow' : ''}`} />
      </div>
    </div>
  );
}
