// Shared layout for authentication screens (login, register, change-password,
// forgot-password, verify-email): public header on top, then a split — an
// evergreen brand panel on large screens and the form in an elevated card.
// The panel is hidden on small screens so the form stays the primary focus
// (spec §13.3, Pattern A).
//
// The panel title is a <p>, not a heading, so the page has a single h1 with no
// h2 before it in DOM order (fixes F-16). The floating product cards are pure
// illustration (aria-hidden) — they describe the workflow, not live data.

import Image from 'next/image';
import { PublicHeader } from '@/components/public-header';
import { CheckIcon } from '@/components/icons';

// Shown when a page does not supply its own panelList.
const DEFAULT_POINTS = [
  { title: 'Real projects', body: 'Milestones, tasks and evidence — the way professional teams work.' },
  { title: 'Mentor feedback', body: 'Every submission is reviewed by a mentor with matching expertise.' },
  { title: 'Verifiable certificates', body: 'Completion is checked against a published rubric, never bought.' },
];

function IllustrationCards() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative mt-10 h-44 select-none">
      {/* Review card */}
      <div className="float-slow absolute left-0 top-0 w-[78%] -rotate-2 rounded-2xl bg-white p-4 shadow-dialog">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-primary-500 to-primary-800 text-[11px] font-bold text-white">
            MR
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">Milestone review</p>
            <p className="truncate text-[11px] text-muted">Task submitted · mentor feedback</p>
          </div>
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-bold text-success-text ring-1 ring-success-border">
            Approved
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full w-[68%] rounded-full bg-linear-to-r from-primary-400 to-primary-700" />
        </div>
      </div>

      {/* Certificate chip */}
      <div className="float-slower absolute bottom-2 right-0 flex rotate-2 items-center gap-2.5 rounded-xl bg-accent-400 px-3.5 py-2.5 shadow-dialog">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/90 text-accent-300">
          <CheckIcon className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-[12px] font-bold text-ink">Certificate verified</span>
          <span className="block text-[10.5px] font-medium text-ink/75">Public check · no account needed</span>
        </span>
      </div>
    </div>
  );
}

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
      <main className="relative flex-1">
        <div aria-hidden="true" className="bg-hero-wash pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-stretch gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-12">
          {/* Brand panel — large screens only */}
          <aside className="hidden self-stretch lg:block">
            <div className="bg-evergreen relative flex h-full min-h-[640px] flex-col overflow-hidden rounded-[28px] p-10 shadow-panel">
              <div aria-hidden="true" className="bg-line-grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />

              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs">
                <Image src="/brand/logo-mark-64.png" alt="" aria-hidden="true" width={32} height={32} className="h-8 w-8" />
              </span>
              <p className="relative mt-8 font-serif text-[34px] font-bold leading-[1.08] tracking-[-0.035em] text-white text-balance">
                {panelTitle}
              </p>
              {panelBody && (
                <p className="relative mt-4 max-w-md text-[15px] leading-relaxed text-primary-100">
                  {panelBody}
                </p>
              )}

              <IllustrationCards />

              <div className="relative mt-auto pt-10">
                {panelList ?? (
                  <ul className="space-y-4">
                    {DEFAULT_POINTS.map((p) => (
                      <li key={p.title} className="flex gap-3">
                        <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-400/20 text-accent-300 ring-1 ring-accent-300/40">
                          <CheckIcon className="h-3 w-3" />
                        </span>
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

          {/* Form card — centred in the single-column layout below lg. */}
          <div className="mx-auto w-full max-w-[440px] self-center lg:mx-0 lg:justify-self-center">
            <div className="rise-in rounded-[24px] border border-line bg-white p-6 shadow-panel sm:p-9">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
