// Shared layout for authentication screens (login, register, change-password):
// public header on top, then a focused split — a page-specific context panel
// on large screens and the form on the right. The panel is hidden on small
// screens so the form stays the primary focus (spec §13.3, Pattern A).
//
// The panel title is a <p>, not a heading, so the page has a single h1 with no
// h2 before it in DOM order (fixes F-16).

import Image from 'next/image';
import { PublicHeader } from '@/components/public-header';

// Shown when a page does not supply its own panelList.
const DEFAULT_POINTS = [
  { title: 'Real projects', body: 'Milestones, tasks and evidence — the way professional teams work.' },
  { title: 'Mentor feedback', body: 'Every submission is reviewed by a mentor with matching expertise.' },
  { title: 'Verifiable certificates', body: 'Completion is checked against a published rubric, never bought.' },
];

export default function AuthShell({
  panelTitle,
  panelBody,
  panelList,
  children,
}: {
  panelTitle: string;
  panelBody?: React.ReactNode;
  panelList?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="flex-1">
        <div className="mx-auto grid w-full max-w-6xl items-stretch gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:px-8 lg:py-16">
          {/* Context panel — large screens only */}
          <aside className="hidden self-stretch lg:block">
            <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-linear-to-br from-primary-700 via-primary-800 to-primary-950 p-10 shadow-panel">
              {/* Decorative growth rings */}
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full border border-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-10 h-52 w-52 rounded-full border border-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute bottom-6 right-6 h-24 w-24 rounded-full bg-accent-500/20 blur-2xl" />

              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 shadow-xs">
                <Image src="/brand/logo-mark-64.png" alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8" />
              </span>
              <p className="relative mt-8 font-serif text-[28px] font-semibold leading-tight text-white text-balance">
                {panelTitle}
              </p>
              {panelBody && (
                <p className="relative mt-4 max-w-sm text-[15px] leading-relaxed text-primary-100">
                  {panelBody}
                </p>
              )}
              <div className="relative mt-auto pt-12">
                {panelList ?? (
                  <ul className="space-y-4">
                    {DEFAULT_POINTS.map((p) => (
                      <li key={p.title} className="flex gap-3">
                        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-100" />
                        <span>
                          <span className="block text-sm font-semibold text-white">{p.title}</span>
                          <span className="block text-[13px] leading-relaxed text-primary-200">{p.body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>

          {/* Form column — centred in the single-column layout below lg so
              the 768–1023px range does not leave the form stranded at the
              left edge with dead space beside it. */}
          <div className="mx-auto w-full max-w-[400px] self-center lg:mx-0 lg:justify-self-end">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
