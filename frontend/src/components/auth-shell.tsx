// Shared layout for authentication screens (login, register, change-password):
// public header on top, then a focused split — a page-specific context panel
// on large screens and the form on the right. The panel is hidden on small
// screens so the form stays the primary focus (spec §13.3, Pattern A).
//
// The panel title is a <p>, not a heading, so the page has a single h1 with no
// h2 before it in DOM order (fixes F-16).

import { PublicHeader } from '@/components/public-header';

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
            <div className="flex h-full flex-col rounded-xl bg-primary-950 p-10">
              <p className="text-[22px] font-bold leading-7 tracking-tight text-white text-balance">
                {panelTitle}
              </p>
              {panelBody && (
                <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-primary-100">
                  {panelBody}
                </p>
              )}
              {panelList && <div className="mt-auto pt-12">{panelList}</div>}
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
