'use client';

// Program discovery for students (SRS FR-CAND-021): only non-DRAFT programs
// are returned by the backend; filters by domain, duration and level; each
// item indicates whether applications are currently open (FR-CAND-020).
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
  Panel,
  Select,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { DIFFICULTY_LABEL, programApplicationWindow } from '@/lib/status';
import type { Domain, PaginatedResponse, Program } from '@/types';

const DURATIONS = [2, 4, 6, 8];

// Dark tokens only — every tile colour must carry white 11px text at AA
// contrast (the previous palette included a mid-tone that measured ≈3.4:1).
const tileColours = [
  'bg-primary-700',
  'bg-wine-500',
  'bg-secondary',
  'bg-primary-900',
  'bg-wine-700',
];

function ProgramsView() {
  // The catalogue honours deep links: /programs?domainId=… (used by the
  // homepage search card) pre-selects the domain filter. A mangled or
  // forged param (not shaped like the cuids the backend issues) is ignored
  // instead of surfacing a raw validation error.
  const searchParams = useSearchParams();
  const rawDomain = searchParams.get('domainId') ?? '';
  const initialDomain = /^c[^\s-]{8,}$/i.test(rawDomain) ? rawDomain : '';
  const [domainFilter, setDomainFilter] = useState(initialDomain);
  const [durationFilter, setDurationFilter] = useState('');
  const [page, setPage] = useState(1);
  const domains = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/domains').then((r) => r.data)
  );

  const filterQuery = () => {
    const params = new URLSearchParams({ status: 'OPEN' });
    if (domainFilter) params.set('domainId', domainFilter);
    if (durationFilter) params.set('durationWeeks', durationFilter);
    params.set('page', String(page));
    params.set('limit', '12');
    return params;
  };

  const programs = useApiLoad<PaginatedResponse<Program>>(
    () => api.get<PaginatedResponse<Program>>(`/api/programs?${filterQuery()}`),
    [domainFilter, durationFilter, page]
  );

  const meta = programs.data?.meta ?? null;

  // Changing a filter returns to the first page so the count and the items
  // always agree.
  function onDomainChange(value: string) {
    setDomainFilter(value);
    setPage(1);
  }

  function onDurationChange(value: string) {
    setDurationFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internship programs"
        subtitle="Open internship programs. Applications stop automatically at the deadline."
      />

      {/* Filters stay mounted during refetches — only the results region
          below swaps to its loading state, so filter changes never flash
          the whole page or scroll the user to the top. */}
      <Panel title="Filters">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Field label="Domain" htmlFor="filter-domain">
              <Select
                id="filter-domain"
                value={domainFilter}
                onChange={(e) => onDomainChange(e.target.value)}
              >
                <option value="">All domains</option>
                {(domains.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Duration" htmlFor="filter-duration">
              <Select
                id="filter-duration"
                value={durationFilter}
                onChange={(e) => onDurationChange(e.target.value)}
              >
                <option value="">Any duration</option>
                {DURATIONS.map((w) => (
                  <option key={w} value={String(w)}>
                    {w} weeks
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      {programs.loading && !programs.data ? (
        <LoadingState label="Loading programs…" />
      ) : programs.error ? (
        <ErrorState message={programs.error} onRetry={programs.reload} />
      ) : (programs.data?.data ?? []).length === 0 ? (
        <EmptyState
          title="No open programs"
          description="No programs match the current filters. New programs appear here when administrators open them."
        />
      ) : (
        <Panel padded={false} className="overflow-hidden">
          <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {programs.data?.data.map((program) => {
            const { open: windowOpen } = programApplicationWindow(program, new Date());
            const seatsLeft = Math.max(0, program.seats - (program._count?.applications ?? 0));
            const color = tileColours[
              Math.abs(
                indexOf(program.id, programs.data?.data ?? [])
              ) % tileColours.length
            ];
            return (
              <Link
                key={program.id}
                href={`/programs/${program.id}`}
                className="group rounded-xl border border-line bg-white p-5 transition-colors hover:border-primary-400 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} text-[11px] font-bold text-white tracking-tight`}>
                  {program.title.slice(0, 1)}
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight text-ink group-hover:text-primary-700">
                  {program.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge tone={windowOpen ? 'success' : 'neutral'}>
                    {windowOpen ? 'Accepting applications' : 'Applications closed'}
                  </StatusBadge>
                  <StatusBadge tone="neutral">
                    {DIFFICULTY_LABEL[program.level as 'BEGINNER' | 'INTERMEDIATE'] ?? program.level}
                  </StatusBadge>
                  {program.domain ? <StatusBadge tone="neutral">{program.domain.name}</StatusBadge> : null}
                </div>
                <ul className="mt-4 space-y-1 text-sm text-muted">
                  <li>
                    <strong className="text-ink">{program.durationWeeks} weeks</strong> starting{' '}
                    {formatDate(program.startDate)}
                  </li>
                  <li>Apply by {formatDate(program.applicationDeadline)}</li>
                  <li>
                    Seats: {seatsLeft} of {program.seats} available ·{' '}
                    {(program._count?.applications ?? 0) === 1
                      ? '1 applicant'
                      : `${program._count?.applications ?? 0} applicants`}
                  </li>
                  {program.requiredLevel ? (
                    <li>
                      Eligibility level required:{' '}
                      {DIFFICULTY_LABEL[program.requiredLevel as 'BEGINNER' | 'INTERMEDIATE'] ??
                        program.requiredLevel}
                    </li>
                  ) : null}
                </ul>
              </Link>
            );
          })}
          </div>
          <Pagination
            page={page}
            totalPages={meta?.totalPages ?? 1}
            total={meta?.total}
            noun="open programs"
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(meta?.totalPages ?? 1, p + 1))}
            disabled={programs.loading}
          />
        </Panel>
      )}
    </div>
  );
}

function indexOf<T extends { id: string }>(id: string, items: T[]): number {
  return items.findIndex((i) => i.id === id);
}

// useSearchParams needs a Suspense boundary during prerendering.
export default function ProgramsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader title="Internship programs" />
          <LoadingState label="Loading programs…" />
        </div>
      }
    >
      <ProgramsView />
    </Suspense>
  );
}