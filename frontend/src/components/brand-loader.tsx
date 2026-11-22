// BrandLoader — the application's shared branded loading experience.
//
// Visual identity is deliberately identical to the first-visit welcome gate
// (components/welcome-gate.tsx): the owner-supplied logo mark at 120px, a
// serif identity line, a small context label, and the sapling-green rule that
// draws itself in. The same `welcome-*` keyframes in globals.css are reused so
// the two experiences can never drift apart.
//
// This component is hook-free and framework-agnostic on purpose: it renders
// identically from a server `loading.tsx` boundary and from client guards
// (RequireAuth, the homepage data gate), so every loading path in the app
// shows the same branded screen.
//
// Reduced motion: the global `prefers-reduced-motion` rule in globals.css
// collapses the intro animations to their final (fully visible) frame, so the
// loader becomes a static branded screen — no JS media-query plumbing needed.
//
// There is deliberately no self-fade-out animation: the loader is unmounted by
// the caller when the destination content is ready, so it can never hide
// content that is already visible.

const LOADER_LABEL = 'InternPath';

export function BrandLoader({
  hint = 'Loading…',
}: {
  /** Small context line under the identity, e.g. "Loading your workspace…". */
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="brand-loader-in fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 bg-canvas"
    >
      <span className="sr-only">{hint}</span>

      <div className="welcome-logo-in">
        {/* Official logo mark at the same presentation size as the welcome
            gate. The transparent variant is used because the loader sits on
            the warm ivory canvas — the opaque mark's white box would show as
            a hard rectangle. Decorative: the identity line below carries the
            text. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo-mark-transparent.png"
          alt=""
          width={120}
          height={120}
          className="h-[120px] w-[120px]"
        />
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="font-serif text-xl font-semibold text-ink">{LOADER_LABEL}</p>
        <p className="text-sm text-secondary" aria-hidden="true">
          {hint}
        </p>
      </div>

      {/* Growth-inspired accent: the same rule the welcome gate draws in. */}
      <div className="h-0.5 w-40 overflow-hidden rounded-full bg-line">
        <div className="h-full w-full origin-left rounded-full bg-primary-600 welcome-grow" />
      </div>
    </div>
  );
}
