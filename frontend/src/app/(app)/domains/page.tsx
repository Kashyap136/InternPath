'use client';

// Technical domains — the discovery surface for the assessment pathway
// (SRS FR-CAND-017 read model, FR-CAND-021 filtering, FR-CAND-023 entry).
// Server-side authorization is enforced by the backend; this page only hides
// what cannot succeed.
import Link from 'next/link';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import type { Domain } from '@/types';

// Dark tokens only — every tile colour must carry white 11px text at AA
// contrast (the previous palette included a mid-tone that measured ≈3.4:1).
const tileColours = [
  'bg-primary-700',
  'bg-wine-500',
  'bg-secondary',
  'bg-primary-900',
  'bg-wine-700',
];

export default function DomainsPage() {
  const { data, error, loading, reload } = useApiLoad<Domain[]>(() =>
    api
      .get<{ data: Domain[] }>('/api/domains')
      .then((r) => r.data)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technical domains"
        subtitle="Assess your skills and find internship programs by technology area."
      />

      {loading ? (
        <LoadingState label="Loading domains…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="No domains yet"
          description="Technical domains are configured by the administrators. Check back soon."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(data ?? []).map((domain, index) => {
            const color = tileColours[index % tileColours.length];
            return (
              <Link
                key={domain.id}
                href={`/domains/${domain.id}`}
                className="group rounded-[20px] border border-line bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-panel focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} text-[11px] font-bold text-white tracking-tight`}>
                  {domain.name.slice(0, 1)}
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight text-ink group-hover:text-primary-700">
                  {domain.name}
                </h2>
                {domain.description ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-secondary line-clamp-2">
                    {domain.description}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-xs text-secondary">
                    {domain.skills?.length ?? 0} skills
                  </span>
                  <StatusBadge tone={domain.isActive ? 'success' : 'neutral'}>
                    {domain.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
