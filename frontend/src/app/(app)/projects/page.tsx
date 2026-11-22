'use client';

// Project repository (Sprint 3 — FR-CAND-044): searchable/filterable list for
// mentors and administrators. Students see published projects through the
// same API surface; mentor/admin listing also exposes their own drafts.

import { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextInput,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import {
  DIFFICULTY_LABEL,
  PROJECT_SOURCE_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
} from '@/lib/status';
import type { Project, PaginatedResponse } from '@/types';

export default function ProjectRepositoryPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const [appliedSourceType, setAppliedSourceType] = useState('');
  const [appliedDifficulty, setAppliedDifficulty] = useState('');

  const { data, error, loading, reload } = useApiLoad<PaginatedResponse<Project> | null>(
    () => {
      const params = new URLSearchParams();

      if (appliedSourceType) params.set('sourceType', appliedSourceType);
      if (appliedDifficulty) params.set('difficulty', appliedDifficulty);
      if (query) params.set('search', query);
      params.set('limit', '50');
      return api.get<PaginatedResponse<Project>>(`/api/projects?${params.toString()}`);
    },
    [query, appliedSourceType, appliedDifficulty]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project repository"
        subtitle="Browse the project catalogue. Projects carry a source-type label everywhere they are shown (FR-CAND-043)."
      />

      <Panel>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
            setAppliedSourceType(sourceType);
            setAppliedDifficulty(difficulty);
          }}
        >
          <div className="lg:col-span-2">
            <Field label="Search" htmlFor="project-search">
              <TextInput
                id="project-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title or problem statement"
              />
            </Field>
          </div>
          <Field label="Source type" htmlFor="project-source">
            <Select
              id="project-source"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="">Any</option>
              {Object.entries(PROJECT_SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty" htmlFor="project-difficulty">
            <Select
              id="project-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="">Any</option>
              <option value="BEGINNER">{DIFFICULTY_LABEL.BEGINNER}</option>
              <option value="INTERMEDIATE">{DIFFICULTY_LABEL.INTERMEDIATE}</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Apply filters
            </Button>
          </div>
        </form>
      </Panel>

      {loading && !data && <LoadingState label="Loading projects…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.data.length === 0) && (
        <Panel>
          <EmptyState
            title="No projects match"
            description="Adjust the filters, or — as a mentor — create a new project draft from the My projects page."
          />
        </Panel>
      )}

      {data && data.data.length > 0 && (
        <div>
          {/* Honest scope note: the list is capped at 50 items per response. */}
          {data.meta && data.meta.total > data.data.length ? (
            <p className="mb-3 text-[13px] text-muted">
              Showing {data.data.length} of {data.meta.total} matching projects — narrow the
              filters to see more.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
          {data.data.map((project) => (
            <Panel key={project.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-base font-semibold text-ink">{project.title}</h2>
                    <StatusBadge tone={PROJECT_STATUS_TONE[project.status]}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {project.domain ? `${project.domain.name} · ` : ''}
                    {DIFFICULTY_LABEL[project.difficulty]} ·{' '}
                    {project.durationWeeks} weeks
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{project.problemStatement}</p>
                  <p className="mt-2 inline-flex rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-secondary">
                    {PROJECT_SOURCE_LABEL[project.sourceType]}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  View project →
                </Link>
              </div>
            </Panel>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
