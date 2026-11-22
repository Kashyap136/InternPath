'use client';

// Domain detail — skills of the domain (FR-CAND-017 read model) and the entry
// point for the domain assessment (FR-CAND-023). The backend strips answer
// keys from every student-facing payload (BE-02, NFR-DRV-001).

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import type { Domain, Skill } from '@/types';

interface StartAttemptResponse {
  // Backend envelope: { data: { attempt, questions, timeLimitMinutes } }
  // (assessment.controller startAttempt). Phase 7 audit fix: the previous
  // flat shape read `res.attempt.id`, which is undefined against the real
  // backend — navigation silently failed while a server-side attempt was
  // created on every click.
  data: {
    attempt: { id: string; domainId: string };
    questions: unknown[];
    timeLimitMinutes: number;
  };
}

function startErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

function startErrorCopy(err: unknown): string {
  const code = startErrorCode(err);
  if (code === 'ATTEMPT_IN_PROGRESS') {
    return 'You already have an attempt in progress for this domain. Open it from the Assessment page to continue.';
  }
  if (code === 'RETAKE_INTERVAL_NOT_ELAPSED') {
    return 'You recently completed this assessment. A retake is available after the configured waiting interval.';
  }
  if (code === 'NO_QUESTIONS') {
    return 'No active questions are configured for this domain yet. Assessments will become available once administrators add questions.';
  }
  return apiErrorMessage(parseApiError(err), 'Cannot start the assessment.');
}

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();

  const { data, error, loading, reload } = useApiLoad<(Domain & { skills: Skill[] }) | null>(() =>
    api
      .get<{ data: (Domain & { skills: Skill[] }) | null }>(`/api/domains/${encodeURIComponent(id)}`)
      .then((r) => r.data)
  );

  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startAssessment = useCallback(async () => {
    setStarting(true);
    setStartError(null);
    try {
      const res = await api.post<StartAttemptResponse>(
        `/api/assessment/${encodeURIComponent(id)}/start`,
        {}
      );
      router.push(`/assessment/${res.data.attempt.id}`);
    } catch (err) {
      setStartError(startErrorCopy(err));
    } finally {
      setStarting(false);
    }
  }, [id, router]);

  if (loading) return <LoadingState label="Loading domain…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const domain = data;
  const skills = data?.skills ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/domains" className="text-sm text-muted underline-offset-2 hover:underline">
          ← All domains
        </Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
            {domain.name}
          </h1>
          {domain.description ? <p className="mt-1 text-muted">{domain.description}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={domain.isActive ? 'success' : 'neutral'}>
            {domain.isActive ? 'Active' : 'Inactive'}
          </StatusBadge>
          <Button
            onClick={() => void startAssessment()}
            disabled={starting || !domain.isActive}
            variant="primary"
            size="lg"
          >
            {starting ? 'Starting…' : 'Take assessment'}
          </Button>
        </div>
      </div>

      {startError ? (
        <Alert variant="error" title="Assessment">
          {startError}
        </Alert>
      ) : null}

      <Panel title={`Skills (${skills.length})`}>
        {skills.length === 0 ? (
          <EmptyState
            bordered={false}
            title="No skills yet"
            description="Skills for this domain have not been configured yet."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <li key={skill.id} className="rounded-lg border border-neutral-border bg-white p-4 transition-colors hover:border-primary-400">
                <div className="font-medium text-ink">{skill.name}</div>
                {skill.description ? (
                  <div className="mt-1 text-sm text-muted">{skill.description}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
