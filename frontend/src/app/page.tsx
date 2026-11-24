// Landing page — public entry point (spec §6 public experience).
//
// Visual design (2026-11 redesign, "Evergreen & Marigold"): editorial display
// headline with an italic serif accent, a soft paper hero wash, a product
// illustration collage, live catalogue statistics, an evergreen "how it works"
// band and a closing call to action. All DATA comes from the real backend —
// nothing is mocked. The hero collage is decorative illustration
// (aria-hidden) describing the workflow, never presented as live figures.
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
  ArrowRightIcon,
  BriefcaseIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  PencilSquareIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquaresIcon,
} from '@/components/icons';
import { Button, ButtonLink, LoadingState } from '@/components/ui';
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

// Tile colours cycle through the palette — never random, so the same domain
// always shows the same colour. Every swatch carries white text at AA.
const tileColours = [
  'bg-primary-700',
  'bg-wine-600',
  'bg-purple-600',
  'bg-accent-600',
  'bg-primary-900',
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

function SectionHeading({
  eyebrow,
  title,
  body,
  action,
  tone = 'dark',
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  action?: React.ReactNode;
  tone?: 'dark' | 'light';
}) {
  const light = tone === 'light';
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <p
          className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${
            light ? 'text-accent-300' : 'text-primary-700'
          }`}
        >
          <span aria-hidden="true" className={`h-px w-6 ${light ? 'bg-accent-300' : 'bg-primary-600'}`} />
          {eyebrow}
        </p>
        <h2
          className={`mt-3 font-serif text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[2.6rem] ${
            light ? 'text-white' : 'text-ink'
          }`}
        >
          {title}
        </h2>
        {body && (
          <p className={`mt-3 text-[15px] leading-relaxed ${light ? 'text-primary-100' : 'text-secondary'}`}>
            {body}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function SeeAllLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[13px] font-semibold text-ink shadow-xs transition-colors hover:border-primary-300 hover:text-primary-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {children}
      <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Decorative product collage for the hero (pure illustration). */
function HeroIllustration() {
  const tasks = [
    { title: 'Project brief & milestones', state: 'Approved', tone: 'bg-success-bg text-success-text ring-success-border' },
    { title: 'API design document', state: 'In review', tone: 'bg-warning-bg text-warning-text ring-warning-border' },
    { title: 'Feature build · sprint 2', state: 'Next up', tone: 'bg-neutral-bg text-neutral-text ring-neutral-border' },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none relative mx-auto w-full max-w-[460px] select-none">
      {/* Glow */}
      <div className="absolute -inset-6 rounded-[40px] bg-radial from-accent-200/60 via-primary-100/40 to-transparent to-70% blur-2xl" />

      {/* Workspace card */}
      <div className="relative rounded-[24px] border border-line bg-white p-5 shadow-dialog">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-700 text-white">
              <BriefcaseIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-ink">Internship workspace</p>
              <p className="text-[11px] text-muted">Mentor-supervised project</p>
            </div>
          </div>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-primary-700 ring-1 ring-primary-100">
            Active
          </span>
        </div>

        <div className="mt-5 flex items-center gap-5 rounded-2xl bg-surface-subtle p-4 ring-1 ring-line">
          <svg viewBox="0 0 36 36" className="h-16 w-16 shrink-0 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3.5" className="stroke-surface-sunken" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="97.4"
              strokeDashoffset="34"
              className="stroke-primary-600"
            />
          </svg>
          <div className="min-w-0">
            <p className="font-serif text-2xl font-bold tracking-tight text-ink">Milestone 2</p>
            <p className="text-[12px] text-muted">Mandatory tasks approved by your mentor</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {tasks.map((t) => (
            <li key={t.title} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                <span className="truncate text-[12.5px] font-medium text-body">{t.title}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${t.tone}`}>{t.state}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating: assessment */}
      <div className="float-slow absolute -left-10 -top-7 hidden rounded-2xl border border-line bg-white px-3.5 py-3 shadow-panel sm:block">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 ring-1 ring-purple-100">
            <PencilSquareIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[11.5px] font-bold text-ink">Assessment passed</p>
            <p className="text-[10.5px] text-muted">Level unlocks programs</p>
          </div>
        </div>
      </div>

      {/* Floating: certificate */}
      <div className="float-slower absolute -bottom-6 -right-4 rotate-2 rounded-2xl bg-accent-400 px-4 py-3 shadow-dialog">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-accent-300">
            <ShieldCheckIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[12px] font-bold text-ink">Certificate issued</p>
            <p className="text-[10.5px] font-medium text-ink/75">Verifiable by number</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: SquaresIcon,
    title: 'Choose a technical domain',
    body: 'Browse the domains and see exactly which skills are assessed before you commit.',
  },
  {
    icon: PencilSquareIcon,
    title: 'Take a timed assessment',
    body: 'A short assessment places you at a level. Your result decides program eligibility.',
  },
  {
    icon: BriefcaseIcon,
    title: 'Apply and start your internship',
    body: 'Apply to open programs, get matched with a mentor and build a real project.',
  },
];

const ROLES = [
  {
    icon: GraduationCapIcon,
    title: 'Students',
    body: 'Discover internships, prove your skills and work on a real project with mentor feedback at every milestone.',
    chip: 'bg-primary-50 text-primary-700 ring-primary-100',
    bar: 'bg-primary-600',
  },
  {
    icon: ClipboardCheckIcon,
    title: 'Mentors',
    body: 'Guide assigned students, review submissions and keep each internship on track with structured feedback.',
    chip: 'bg-accent-50 text-accent-700 ring-accent-100',
    bar: 'bg-accent-400',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Administrators',
    body: 'Publish programs, manage applications and oversee internships, evaluations and certificates.',
    chip: 'bg-purple-50 text-purple-600 ring-purple-100',
    bar: 'bg-purple-500',
  },
];

const FAQ = [
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
    a: 'Your name, email and study details are used to operate your account and internships. Public certificate verification shows only the certificate holder’s name, the internship and the issue date — never contact details or scores.',
  },
];

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
  // the user behind a hung request.
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

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
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
        {/* ============================ Hero ============================ */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="bg-hero-wash pointer-events-none absolute inset-0" />
          <div aria-hidden="true" className="bg-dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28">
            <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
              <div className="rise-in min-w-0 lg:col-span-7">
                <p className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1.5 pr-3.5 text-[12.5px] font-medium text-body shadow-xs backdrop-blur">
                  <span className="rounded-full bg-primary-700 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
                    Free
                  </span>
                  For every student · mentor-reviewed projects
                </p>

                <h1 className="mt-6 font-serif text-[2.9rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[4rem] lg:text-[4.6rem]">
                  Start where your{' '}
                  <span className="font-accent font-normal tracking-[-0.02em] text-primary-700">experience</span>{' '}
                  <span className="text-highlight">begins.</span>
                </h1>
                <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.65] text-body">
                  Find unpaid internships that build real skills, strengthen
                  your portfolio and give you a head start on your career.
                </p>

                {/* Search — the domain select drives the real destination
                     (/programs?domainId=…, which the programmes page reads
                     into its filter). Keyword/location fields were removed
                     during the UI audit: the backend has no keyword or
                     location search in V1, and dead inputs mislead. */}
                <form
                  onSubmit={handleSearch}
                  className="mt-8 max-w-[36rem] rounded-[20px] border border-line bg-white p-2 shadow-panel"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[14px] px-3 py-1.5 ring-primary-500/30 transition-shadow focus-within:ring-4 sm:py-1">
                      <SearchIcon className="h-5 w-5 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor="home-search-domain"
                          className="block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted"
                        >
                          Find internships by domain
                        </label>
                        {/* Borderless select: the card is the field. The
                            card's :focus-within ring shows keyboard focus. */}
                        <div className="relative">
                          <select
                            id="home-search-domain"
                            value={searchDomain}
                            onChange={(e) => setSearchDomain(e.target.value)}
                            disabled={domains.loading}
                            className="h-8 w-full cursor-pointer appearance-none bg-transparent pr-7 text-[15px] font-semibold text-ink outline-hidden disabled:cursor-not-allowed disabled:text-muted"
                          >
                            <option value="">All domains</option>
                            {allDomains.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDownIcon className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        </div>
                      </div>
                    </div>
                    <Button type="submit" variant="accent" size="lg" disabled={domains.loading} className="sm:px-6">
                      Search internships
                      <ArrowRightIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
                {domains.error && (
                  <p className="mt-2 text-[12.5px] text-danger-text" role="alert">
                    Domains could not be loaded — search still opens the full catalogue.
                  </p>
                )}

                <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] font-medium text-body">
                  {['No fees, ever', 'Mentor feedback on every task', 'Verifiable certificates'].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-700 text-white">
                        <CheckIcon className="h-3 w-3" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rise-in rise-in-2 lg:col-span-5">
                <HeroIllustration />
              </div>
            </div>

            {/* Honest, live statistics — never invented counts. Rendered
                only once the data is in: while requests are in flight the
                row would show misleading zeros. */}
            {domains.data && openPrograms.data && (
              <dl className="rise-in rise-in-3 mt-20 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-white/80 shadow-card backdrop-blur sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                  { value: domainCount, label: 'learning domains', icon: SquaresIcon, chip: 'bg-primary-50 text-primary-700' },
                  { value: programCount, label: 'open programmes', icon: SparklesIcon, chip: 'bg-accent-50 text-accent-700' },
                  { value: '100%', label: 'free for students', icon: GraduationCapIcon, chip: 'bg-purple-50 text-purple-600' },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-4 px-6 py-5">
                    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.chip}`}>
                      <s.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <dd className="font-serif text-[2rem] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
                        {s.value}
                      </dd>
                      <dt className="mt-1 text-[13px] text-muted">{s.label}</dt>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        {/* ===================== Featured internships ===================== */}
        <section className="py-16 sm:py-24" id="featured-internships">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Open now"
              title={
                <>
                  Featured <span className="font-accent font-normal text-primary-700">internships</span>
                </>
              }
              body="The programmes closing soonest — apply while there is still time."
              action={<SeeAllLink href="/programs">Explore all programs</SeeAllLink>}
            />

            {openPrograms.loading && !openPrograms.data ? (
              <div className="mt-10 rounded-2xl border border-line bg-white p-6">
                <LoadingState label="Loading open internships…" />
              </div>
            ) : openPrograms.error ? (
              <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-white p-6">
                <p className="text-sm font-semibold text-ink">Open programs could not be loaded</p>
                <p className="mt-1 text-[13px] text-secondary">{openPrograms.error}</p>
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
              <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
                <p className="font-serif text-lg font-semibold text-ink">No open internships right now</p>
                <p className="mt-1 text-[13.5px] text-secondary">
                  New programs are published regularly — check the catalogue for upcoming cycles.
                </p>
                <ButtonLink href="/programs" variant="secondary" size="sm" className="mt-4">
                  Browse the catalogue →
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {featuredPrograms.map((program) => {
                  const days = daysUntil(program.applicationDeadline);
                  const applicants = program.applicationsCount ?? program._count?.applications ?? 0;
                  const urgent = days !== null && days >= 0 && days <= 7;
                  return (
                    <Link
                      key={program.id}
                      href={`/programs/${program.id}`}
                      className="group relative flex min-w-0 flex-col rounded-[20px] border border-line bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-panel focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate rounded-full bg-primary-50 px-2.5 py-1 text-[11.5px] font-semibold text-primary-700 ring-1 ring-inset ring-primary-100">
                          {program.domain?.name ?? 'Program'}
                        </span>
                        {days !== null && (
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ring-1 ring-inset ${
                              days < 0
                                ? 'bg-danger-bg text-danger-text ring-danger-border'
                                : urgent
                                  ? 'bg-accent-50 text-accent-700 ring-accent-200'
                                  : 'bg-surface-subtle text-secondary ring-line'
                            }`}
                          >
                            {days < 0 ? 'Applications closed' : days === 0 ? 'Deadline today' : `${days}d left`}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-4 font-serif text-[1.15rem] font-semibold leading-snug tracking-[-0.02em] text-ink group-hover:text-primary-800">
                        {program.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="h-4 w-4 text-muted" />
                          {program.durationWeeks} weeks
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <GraduationCapIcon className="h-4 w-4 text-muted" />
                          {program.level}
                        </span>
                      </div>
                      <div aria-hidden="true" className="min-h-5 flex-1" />
                      <div className="flex items-center justify-between gap-2 border-t border-dashed border-line pt-4 text-[12px] text-muted">
                        <span className="tabular-nums">Apply by {formatDate(program.applicationDeadline)}</span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums">
                          {applicants === 0
                            ? 'No applicants yet'
                            : `${applicants} applicant${applicants === 1 ? '' : 's'} · ${program.seats} seats`}
                          <ArrowRightIcon
                            className="h-3.5 w-3.5 -translate-x-1 text-primary-700 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                          />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ===================== Recommended domains ===================== */}
        <section className="border-t border-line bg-surface-subtle/60 py-16 sm:py-24" id="featured-domains">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Explore by skill"
              title="Recommended domains"
              body="Each domain lists the exact skills its assessment covers."
              action={<SeeAllLink href="/domains">Explore all domains</SeeAllLink>}
            />

            {domains.loading && !domains.data ? (
              <div className="mt-10 rounded-2xl border border-line bg-white p-6">
                <LoadingState label="Loading domains…" />
              </div>
            ) : domains.error ? (
              <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-white p-6">
                <p className="text-sm font-semibold text-ink">Domains could not be loaded</p>
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
              <div className="mt-10 rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center">
                <p className="font-serif text-lg font-semibold text-ink">No domains published yet</p>
                <p className="mt-1 text-[13.5px] text-secondary">
                  Technical domains are configured by the administrators. Check back soon.
                </p>
              </div>
            ) : (
              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featuredDomains.map((domain, index) => {
                  const color = tileColours[index % tileColours.length]!;
                  const skillCount = domain.skills?.length ?? 0;
                  return (
                    <Link
                      key={domain.id}
                      href={`/domains/${domain.id}`}
                      className="group flex flex-col rounded-[20px] border border-line bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-panel focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color} font-serif text-lg font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]`}
                        >
                          {domainInitial(domain.name)}
                        </span>
                        <ArrowRightIcon className="h-4 w-4 -translate-x-1 text-muted opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100" />
                      </div>
                      <h3 className="mt-4 font-serif text-[1.05rem] font-semibold tracking-[-0.02em] text-ink group-hover:text-primary-800">
                        {domain.name}
                      </h3>
                      {domain.description && (
                        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-secondary">
                          {domain.description}
                        </p>
                      )}
                      <div className="mt-auto pt-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-[11.5px] font-semibold text-secondary ring-1 ring-inset ring-line">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-500" />
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

        {/* ========================= How it works ========================= */}
        <section className="bg-evergreen relative overflow-hidden py-16 sm:py-24" id="how-it-works">
          <div aria-hidden="true" className="bg-line-grid-light pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              tone="light"
              eyebrow="How it works"
              title={
                <>
                  One guided <span className="font-accent font-normal text-accent-300">pathway</span>
                </>
              }
              body="From your first skill assessment to a mentor-supervised project internship."
            />
            <ol className="relative mt-12 grid gap-5 md:grid-cols-3">
              <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-[38px] hidden border-t border-dashed border-white/25 md:block" />
              {STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className="relative rounded-[20px] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition-colors hover:bg-white/[0.09]"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-400 text-ink shadow-[0_8px_24px_-8px_rgb(245_170_47/0.6)]">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <span className="font-serif text-sm font-semibold tracking-[0.04em] text-primary-200">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 font-serif text-lg font-semibold tracking-[-0.02em] text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-primary-100">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================ Roles ============================ */}
        <section className="py-16 sm:py-24" id="roles">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Roles"
              title={
                <>
                  Built for <span className="font-accent font-normal text-primary-700">every</span> role
                </>
              }
              body="One platform, three workspaces — each shows exactly the work that role owns."
            />
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {ROLES.map((role) => (
                <div
                  key={role.title}
                  className="group relative overflow-hidden rounded-[20px] border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-panel"
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${role.bar}`} />
                  <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset ${role.chip}`}>
                    <role.icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 font-serif text-xl font-semibold tracking-[-0.02em] text-ink">{role.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-secondary">{role.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================= FAQ ============================= */}
        <section className="border-t border-line bg-surface-subtle/60 py-16 sm:py-24" id="faq">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.5fr] lg:gap-16 lg:px-8">
            <div>
              <SectionHeading eyebrow="FAQ" title="Questions, answered" />
              <p className="mt-4 text-[15px] leading-relaxed text-secondary">
                Need something else? Read{' '}
                <Link href="/about" className="font-semibold text-primary-700 underline decoration-primary-200 underline-offset-4 hover:decoration-primary-600">
                  about InternPath
                </Link>{' '}
                and the{' '}
                <Link href="/policy" className="font-semibold text-primary-700 underline decoration-primary-200 underline-offset-4 hover:decoration-primary-600">
                  participation policy
                </Link>
                , or raise a concern in-app once signed in.
              </p>
            </div>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <details
                  key={item.q}
                  open={i === 0}
                  className="group rounded-2xl border border-line bg-white px-5 shadow-card transition-shadow open:shadow-panel"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-serif text-base font-semibold tracking-[-0.015em] text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-subtle ring-1 ring-line transition-colors group-open:bg-primary-700 group-open:ring-primary-700"
                    >
                      <span className="absolute h-0.5 w-3 rounded-full bg-ink group-open:bg-white" />
                      <span className="absolute h-3 w-0.5 rounded-full bg-ink transition-transform group-open:scale-y-0 group-open:bg-white" />
                    </span>
                  </summary>
                  <p className="pb-5 pr-10 text-[14.5px] leading-relaxed text-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ========================== Final CTA ========================== */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-[28px] bg-accent-300 px-6 py-12 sm:px-12 sm:py-14">
              <div aria-hidden="true" className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60" />
              <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-200 blur-2xl" />
              <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
                <div className="max-w-xl">
                  <h2 className="font-serif text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[2.6rem]">
                    Your first real project is{' '}
                    <span className="font-accent font-normal">one application</span> away.
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink/80">
                    Create a free student account, take an assessment and apply to an open programme today.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ButtonLink href="/register" size="lg">
                    Create free account
                    <ArrowRightIcon className="h-4 w-4" />
                  </ButtonLink>
                  <ButtonLink href="/programs" variant="secondary" size="lg">
                    Browse programs
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
