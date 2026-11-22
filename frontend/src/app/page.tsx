// Landing page — public entry point (spec §6 public experience).
//
// Visual design follows the owner-supplied reference collection: warm ivory
// background, editorial serif headline, terracotta primary actions, ivory
// cards with coloured left edges and skills pill rows. All data comes from
// the real backend — nothing is mocked.
//
// Curation contract (UI audit 2026-11-12): the homepage is a landing page,
// not a catalogue dump. It shows a small, deterministic selection of
// programs and domains; the complete catalogue stays on /programs and
// /domains. The selection rules are documented beside the helpers below and
// use only existing backend data — no database changes, nothing hidden or
// deleted, and newly added content still reaches the homepage whenever it
// matches the rule.
//
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';
import { BrandLoader } from '@/components/brand-loader';
import { useSteadyLoading } from '@/lib/use-steady-loading';
import {
  BuildingOfficeIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
} from '@/components/icons';
import { Button, ButtonLink, LoadingState, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import type { Domain, Program } from '@/types';

/* ------------------------------------------------------------------ */
/* Curated selection                                                   */
/* ------------------------------------------------------------------ */

// How many tiles the landing page shows.
const FEATURED_PROGRAM_COUNT = 6;
const FEATURED_DOMAIN_COUNT = 8;

/**
 * Deterministic homepage selection for domains.
 *
 * Rule: active domains ranked by assessed-skill richness (skill count,
 * highest first), ties broken alphabetically by name, first 8.
 *
 * Rationale: skill count is the platform's own quality signal for a domain
 * ("N skills" is the card's badge) and it is already returned by
 * GET /api/domains — a presentation-level rule over existing data, no
 * schema or admin fields involved. Alphabetical tie-breaking keeps the
 * selection stable between renders and across visits.
 */
function curatedDomains(domains: Domain[]): Domain[] {
  return [...domains]
    .sort(
      (a, b) =>
        (b.skills?.length ?? 0) - (a.skills?.length ?? 0) ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
    )
    .slice(0, FEATURED_DOMAIN_COUNT);
}

/**
 * Deterministic homepage selection for programs.
 *
 * Rule: OPEN programs whose application deadline is still in the future,
 * ranked by soonest deadline (what a student needs to act on first), ties
 * broken by fewest applications (best odds), then alphabetically. When
 * fewer than three programs have a future deadline the pool falls back to
 * all OPEN programs so the section never under-fills while a cycle is
 * being set up — but expired-deadline programs always sort AFTER live ones
 * so the featured tiles never lead with "Applications closed". First 6.
 */
function curatedPrograms(programs: Program[]): Program[] {
  const now = Date.now();
  const withFutureDeadline = programs.filter(
    (p) => new Date(p.applicationDeadline).getTime() >= now
  );
  const pool = withFutureDeadline.length >= 3 ? withFutureDeadline : programs;
  return pool
    .sort(
      (a, b) =>
        // Expired deadlines last, regardless of the other keys.
        (new Date(a.applicationDeadline).getTime() < now ? 1 : 0) -
          (new Date(b.applicationDeadline).getTime() < now ? 1 : 0) ||
        new Date(a.applicationDeadline).getTime() -
          new Date(b.applicationDeadline).getTime() ||
        (a.applicationsCount ?? a._count?.applications ?? 0) -
          (b.applicationsCount ?? b._count?.applications ?? 0) ||
        (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)
    )
    .slice(0, FEATURED_PROGRAM_COUNT);
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

// Tile colours cycle through the brand palette — never random, so the same
// domain always shows the same colour. Dark tokens only: every tile carries
// white 11px text, which needs the darker swatches to stay at AA contrast.
const tileColours = [
  'bg-primary-700',
  'bg-wine-500',
  'bg-secondary',
  'bg-primary-900',
  'bg-wine-700',
];

function domainInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1).toUpperCase() : '?';
}

/**
 * Whole days until the application deadline. Negative when the deadline has
 * already passed — the caller renders an honest "Applications closed" state
 * instead of a misleading "Deadline today".
 */
function daysUntil(value: string): number | null {
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return null;
  return Math.floor((date - Date.now()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const router = useRouter();
  const [searchDomain, setSearchDomain] = useState<string>('');

  const domains = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/domains').then((r) => r.data),
  );
  const openPrograms = useApiLoad<{ data: Program[]; total: number } | null>(() =>
    api
      .get<{ data: Program[]; meta?: { total: number } }>('/api/programs?status=OPEN&limit=100')
      .then((r) => ({ data: r.data, total: r.meta?.total ?? r.data.length })),
  );

  // Entry gate: the branded loader is the first thing a visitor sees on a
  // homepage refresh or direct open, and it stays until the essential
  // content (domains + open programs) is ready. Failures reveal the page —
  // the affected section then renders its own error state with a retry —
  // and the safety bound in the hook guarantees the loader can never trap
  // the user behind a hung request. `delayMs` avoids a pointless loader
  // flash for soft navigations that resolve almost instantly; `minMs` keeps
  // the branded moment readable on refreshes.
  const initialLoading = domains.loading || openPrograms.loading;
  const showGate = useSteadyLoading(initialLoading, {
    delayMs: 120,
    minMs: 500,
    maxMs: 12000,
  });

  const allDomains = domains.data ?? [];
  const allPrograms = openPrograms.data?.data ?? [];
  const featuredDomains = curatedDomains(allDomains);
  const featuredPrograms = curatedPrograms(allPrograms);
  // Honest totals from the response meta — the tile list is capped, the
  // statistics row is not.
  const domainCount = allDomains.length;
  const programCount = openPrograms.data?.total ?? allPrograms.length;

  function handleSearch() {
    if (searchDomain) {
      void router.push(`/programs?domainId=${encodeURIComponent(searchDomain)}`);
    } else {
      void router.push('/programs');
    }
  }

  if (showGate) {
    return <BrandLoader hint="Loading internships…" />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <PublicHeader />

      <main className="flex-1">
        {/* Hero — editorial serif headline, search card, decorative right
             panel. The 12-column grid puts the copy in columns 1–7 and the
             panel in columns 8–12, so the hero uses the full content width
             instead of leaving the right half empty. */}
        <section className="relative border-b border-line pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="min-w-0 lg:col-span-7">
                <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
                  Start where your{' '}
                  <span className="block">experience begins.</span>
                </h1>
                <p className="mt-5 max-w-[36rem] text-base leading-7 text-body">
                  Find unpaid internships that build real skills, strengthen
                  your portfolio and give you a head start on your career.
                </p>

                {/* Search card — the domain select drives the real
                     destination (/programs?domainId=…, which the programmes
                     page reads into its filter). Keyword/location fields
                     were removed during the UI audit: the backend has no
                     keyword or location search in V1, and dead inputs are a
                     misleading interaction. */}
                <div className="mt-8 max-w-[34rem] rounded-xl border border-line bg-white p-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="home-search-domain"
                        className="text-[12px] font-semibold uppercase tracking-wider text-muted"
                      >
                        Find internships by domain
                      </label>
                      <Select
                        id="home-search-domain"
                        value={searchDomain}
                        onChange={(e) => setSearchDomain(e.target.value)}
                        disabled={domains.loading}
                      >
                        <option value="">All domains</option>
                        {allDomains.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                      {domains.error && (
                        <p className="text-[12px] text-danger-solid" role="alert">
                          Domains could not be loaded — search still opens the full catalogue.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="accent"
                      size="lg"
                      onClick={handleSearch}
                      disabled={domains.loading}
                    >
                      Search internships
                    </Button>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-warning-text/10 text-warning-text">
                      <span className="text-[10px] font-bold">i</span>
                    </span>
                    Opens the open programmes in the chosen domain.
                  </p>
                </div>

                <p className="mt-6 flex items-center gap-1.5 text-[13px] text-muted">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success-text/10 text-success-text">
                    <span className="text-[11px] font-bold">✓</span>
                  </span>
                  100% free for students · No hidden fees
                </p>
              </div>

              {/* Decorative right panel — abstract brand geometry, no copied
                  illustration. */}
              <div className="hidden lg:col-span-5 lg:block">
                <div className="relative h-80 overflow-hidden rounded-2xl border border-line bg-surface-subtle">
                  <svg
                    className="absolute inset-0 h-full w-full text-muted"
                    viewBox="0 0 800 320"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <circle cx="120" cy="140" r="90" fill="var(--color-primary-700)" opacity="0.12" />
                    <circle cx="620" cy="60" r="110" fill="var(--color-warning-text)" opacity="0.08" />
                    <circle cx="700" cy="260" r="70" fill="var(--color-success-text)" opacity="0.10" />
                    <path
                      d="M40 240 Q 200 60 440 260 T 760 200"
                      fill="none"
                      stroke="var(--color-muted)"
                      strokeWidth="1"
                      opacity="0.35"
                    />
                  </svg>
                </div>
                <p className="mt-5 text-[12px] text-muted text-balance">
                  Free for students — build a real project with a mentor,
                  get structured feedback, and earn a verifiable completion
                  certificate.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured internships — a small, deadline-driven selection of the
             open catalogue. The full catalogue stays on /programs. */}
        <section className="border-b border-line py-14 sm:py-20 lg:py-24" id="featured-internships">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex h-7 items-center gap-1.5 rounded-lg bg-primary-700 px-2">
                <span className="text-[10px] font-bold text-white">★</span>
                <h2 className="text-sm font-semibold text-white">Featured internships</h2>
              </div>
              <Link
                href="/programs"
                className="text-xs font-semibold text-accent-600 hover:text-accent-700"
              >
                Explore all programs →
              </Link>
            </div>

            {openPrograms.loading && !openPrograms.data ? (
              <div className="mt-6 rounded-xl border border-line bg-white p-6">
                <LoadingState label="Loading open internships…" />
              </div>
            ) : openPrograms.error ? (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-6">
                <p className="text-sm font-semibold text-ink">
                  Open programs could not be loaded
                </p>
                <p className="mt-1 text-[13px] text-secondary">
                  {openPrograms.error}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={openPrograms.reload}>
                    Try again
                  </Button>
                  <ButtonLink href="/programs" variant="ghost" size="sm">
                    Browse the catalogue →
                  </ButtonLink>
                </div>
              </div>
            ) : featuredPrograms.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-6 text-center">
                <p className="text-sm font-semibold text-ink">No open internships right now</p>
                <p className="mt-1 text-[13px] text-secondary">
                  New programs are published regularly — check the catalogue for
                  upcoming cycles.
                </p>
                <ButtonLink href="/programs" variant="secondary" size="sm" className="mt-4">
                  Browse the catalogue →
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featuredPrograms.map((program) => {
                  const days = daysUntil(program.applicationDeadline);
                  return (
                    <Link
                      key={program.id}
                      href={`/programs/${program.id}`}
                      className="group flex min-w-0 flex-col rounded-xl border border-line bg-white p-5 transition-colors hover:border-primary-400"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-xs font-medium text-secondary">
                          {program.domain?.name ?? 'Program'}
                        </span>
                        {days !== null && (
                          <span
                            className={`shrink-0 text-[12px] font-medium tabular-nums ${
                              days < 0 ? 'text-danger-solid' : 'text-muted'
                            }`}
                          >
                            {days < 0
                              ? 'Applications closed'
                              : days === 0
                                ? 'Deadline today'
                                : `${days}d left to apply`}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight text-ink group-hover:text-primary-700">
                        {program.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-secondary">
                        <span>{program.durationWeeks} weeks</span>
                        <span aria-hidden="true">·</span>
                        <span>{program.level}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-[12px] text-muted">
                        <span className="tabular-nums">
                          Apply by {formatDate(program.applicationDeadline)}
                        </span>
                        {(() => {
                          const applicants =
                            program.applicationsCount ?? program._count?.applications ?? 0;
                          return (
                            <span className="shrink-0 tabular-nums">
                              {applicants === 0
                                ? 'No applicants yet'
                                : `${applicants} applicant${applicants === 1 ? '' : 's'} · ${program.seats} seats`}
                            </span>
                          );
                        })()}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Recommended domains — a curated selection; the complete domain
             catalogue stays on /domains. */}
        <section className="border-b border-line py-14 sm:py-20 lg:py-24" id="featured-domains">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex h-7 items-center gap-1.5 rounded-lg bg-wine-500 px-2">
                <span className="text-[10px] font-bold text-white">◆</span>
                <h2 className="text-sm font-semibold text-white">Recommended domains</h2>
              </div>
              <Link
                href="/domains"
                className="text-xs font-semibold text-accent-600 hover:text-accent-700"
              >
                Explore all domains →
              </Link>
            </div>

            {domains.loading && !domains.data ? (
              <div className="mt-6 rounded-xl border border-line bg-white p-6">
                <LoadingState label="Loading domains…" />
              </div>
            ) : domains.error ? (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-6">
                <p className="text-sm font-semibold text-ink">
                  Domains could not be loaded
                </p>
                <p className="mt-1 text-[13px] text-secondary">{domains.error}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={domains.reload}>
                    Try again
                  </Button>
                  <ButtonLink href="/domains" variant="ghost" size="sm">
                    Open the domain catalogue →
                  </ButtonLink>
                </div>
              </div>
            ) : featuredDomains.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-line bg-white p-6 text-center">
                <p className="text-sm font-semibold text-ink">No domains published yet</p>
                <p className="mt-1 text-[13px] text-secondary">
                  Technical domains are configured by the administrators. Check
                  back soon.
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {featuredDomains.map((domain, index) => {
                  const color = tileColours[index % tileColours.length]!;
                  const skillCount = domain.skills?.length ?? 0;
                  return (
                    <Link
                      key={domain.id}
                      href={`/domains/${domain.id}`}
                      className="group rounded-xl border border-line bg-white p-5 transition-colors hover:border-primary-400"
                    >
                      <div
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} text-[11px] font-bold tracking-tight text-white`}
                      >
                        {domainInitial(domain.name)}
                      </div>
                      <h3 className="mt-3 text-base font-semibold tracking-tight text-ink group-hover:text-primary-700">
                        {domain.name}
                      </h3>
                      {domain.description && (
                        <p className="mt-1.5 text-sm leading-relaxed text-secondary line-clamp-2">
                          {domain.description}
                        </p>
                      )}
                      <div className="mt-4 flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-xs text-secondary">
                          {skillCount} skills
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* How it works — anchor target for the public header/footer menu. */}
        <section className="border-b border-line bg-surface-subtle py-14 sm:py-20 lg:py-24" id="how-it-works">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">
              How InternPath works
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
              One guided pathway from your first skill assessment to a
              mentor-supervised project internship.
            </p>
            <ol className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Choose a technical domain',
                  body: 'Browse the domains and see exactly which skills are assessed before you commit.',
                },
                {
                  step: '2',
                  title: 'Take a timed assessment',
                  body: 'A short assessment places you at a level. Your result decides program eligibility.',
                },
                {
                  step: '3',
                  title: 'Apply and start your internship',
                  body: 'Apply to open programs, get matched with a mentor and build a real project.',
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="rounded-xl border border-line bg-white p-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-base font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                    {item.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Roles — anchor target for the public header/footer menu. */}
        <section className="border-b border-line py-14 sm:py-20 lg:py-24" id="roles">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">
              Built for every role
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  title: 'Students',
                  body: 'Discover internships, prove your skills and work on a real project with mentor feedback at every milestone.',
                },
                {
                  title: 'Mentors',
                  body: 'Guide assigned students, review submissions and keep each internship on track with structured feedback.',
                },
                {
                  title: 'Administrators',
                  body: 'Publish programs, manage applications and oversee internships, evaluations and certificates.',
                },
              ].map((role) => (
                <div
                  key={role.title}
                  className="rounded-xl border border-line bg-white p-6"
                >
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {role.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                    {role.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Honest, live statistics — never invented counts. Rendered only
            once the data is in: while the requests are still in flight the
            row would show misleading zeros. Every figure here comes from the
            platform's own catalogue API. */}
        {domains.data && openPrograms.data && (
          <section className="bg-surface-subtle py-14 sm:py-20 lg:py-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="grid gap-y-8 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-3 lg:gap-x-16">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                  <BuildingOfficeIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-3xl font-bold tracking-tight text-ink">
                    {domainCount}
                  </p>
                  <p className="text-[12px] text-muted">learning domains</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-text/10 text-success-text">
                  <ClipboardCheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-3xl font-bold tracking-tight text-ink">
                    {programCount}
                  </p>
                  <p className="text-[12px] text-muted">open programmes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning-text/10 text-warning-text">
                  <GraduationCapIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-serif text-3xl font-bold tracking-tight text-ink">
                    100%
                  </p>
                  <p className="text-[12px] text-muted">free for students</p>
                </div>
              </div>
            </div>
            </div>
          </section>
        )}

        {/* Questions — accurate answers only; every claim here is backed by
            the participation policy or a real platform feature. */}
        <section className="border-t border-line py-14 sm:py-20 lg:py-24" id="faq">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-ink">
              Questions, answered
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {[
                {
                  q: 'Is InternPath really free?',
                  a: 'Yes. InternPath charges no registration, participation or placement fee, and takes no commission. The participation policy lists exactly what the platform does not charge for.',
                },
                {
                  q: 'Are the internships paid?',
                  a: 'Internships on InternPath are unpaid learning engagements centred on real project work and mentor feedback. The platform never intermediates or collects payment between students and organizations.',
                },
                {
                  q: 'Who reviews my work?',
                  a: 'A dedicated mentor reviews every submission with written feedback, and administrators oversee final evaluations and issue completion certificates.',
                },
                {
                  q: 'Are the certificates verifiable?',
                  a: 'Every certificate carries a unique number that anyone can check on the public verification page. A certificate records internship completion — it is not an academic qualification or a guarantee of employment.',
                },
                {
                  q: 'How do I report a problem?',
                  a: 'Signed-in users can raise a concern from the Reports page; reports go directly to administrators and are visible only to the reporter and administrators.',
                },
                {
                  q: 'What happens to my personal details?',
                  a: 'Your name, email and study details are used to operate your account and internships. Public certificate verification shows only the certificate holder\u2019s name, the internship and the issue date \u2014 never contact details or scores.',
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="rounded-xl border border-line bg-white p-6"
                >
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {item.q}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm leading-relaxed text-secondary">
              Need something else? Read{' '}
              <Link href="/about" className="font-medium text-primary-700 underline-offset-4 hover:underline">
                about InternPath
              </Link>{' '}
              and the{' '}
              <Link href="/policy" className="font-medium text-primary-700 underline-offset-4 hover:underline">
                participation policy
              </Link>
              , or raise a concern in-app once signed in.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
