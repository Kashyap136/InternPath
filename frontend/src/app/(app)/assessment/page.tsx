'use client';

// Assessment participation hub (SRS FR-CAND-023..025, FR-CAND-027).
// Students see every attempt for their account (server-scoped), can open an
// in-progress attempt, review results of submitted ones, or start a new one
// by choosing an active domain.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import type { AssessmentAttempt, AssessmentResultLevel, Domain } from '@/types';

const LEVEL_LABEL: Record<AssessmentResultLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  NOT_ELIGIBLE: 'Not eligible',
};

const LEVEL_TONE: Record<AssessmentResultLevel, 'success' | 'warning' | 'neutral'> = {
  BEGINNER: 'success',
  INTERMEDIATE: 'success',
  NOT_ELIGIBLE: 'neutral',
};

export default function AssessmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const attempts = useApiLoad<AssessmentAttempt[]>(
    () =>
      isStudent
        ? api.get<{ data: AssessmentAttempt[] }>('/api/assessment/attempts').then((r) => r.data)
        : Promise.resolve([]),
    [isStudent]
  );
  const domains = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/domains').then((r) => r.data)
  );

  const [startError, setStartError] = useState<string | null>(null);
  const [startingDomainId, setStartingDomainId] = useState<string | null>(null);

  const startAssessment = async (domainId: string) => {
    setStartingDomainId(domainId);
    setStartError(null);
    try {
      const res = await api.post<{ data: { attempt: { id: string } } }>(
        `/api/assessment/${encodeURIComponent(domainId)}/start`,
        {}
      );
      // Client-side transition (a full location.assign reload is unnecessary;
      // the attempt page loads its own state on mount).
      router.push(`/assessment/${res.data.attempt.id}`);
    } catch (err) {
      setStartingDomainId(null);
      const message =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (message === 'ATTEMPT_IN_PROGRESS') {
        setStartError('You already have an attempt in progress. Open it below under "My attempts".');
        void attempts.reload();
      } else {
        setStartError(err instanceof Error ? err.message : 'Cannot start the assessment.');
      }
    }
  };

  const activeDomains = (domains.data ?? []).filter((d) => d.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment"
        subtitle="Take a timed assessment per domain. Scores determine the program levels you can apply for."
      />

      {user && !isStudent ? (
        <Panel>
          <p className="text-sm text-secondary">
            Assessments are taken by student accounts to determine program
            eligibility. Mentor and administrator accounts are not assessed.
          </p>
        </Panel>
      ) : null}

      {isStudent && (
      <Panel title="Start a new assessment" subtitle="Choose a technical domain.">
        {domains.loading ? (
          <LoadingState label="Loading domains…" />
        ) : domains.error ? (
          <ErrorState message={domains.error} onRetry={domains.reload} />
        ) : activeDomains.length === 0 ? (
          <EmptyState
            bordered={false}
            title="No active domains"
            description="Domains become available once administrators configure them."
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {activeDomains.map((domain) => (
              <li key={domain.id}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={startingDomainId !== null}
                  onClick={() => void startAssessment(domain.id)}
                >
                  {startingDomainId === domain.id ? 'Starting…' : domain.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {startError ? (
          <Alert variant="warning" title="Cannot start">
            {startError}
          </Alert>
        ) : null}
      </Panel>
      )}

      {isStudent && (
      <Panel title="My attempts">
        {attempts.loading ? (
          <LoadingState label="Loading attempts…" />
        ) : attempts.error ? (
          <ErrorState message={attempts.error} onRetry={attempts.reload} />
        ) : (attempts.data ?? []).length === 0 ? (
          <EmptyState
            bordered={false}
            title="No attempts yet"
            description="Start your first attempt from a domain above."
          />
        ) : (
          <ul className="divide-y divide-neutral-border">
            {(attempts.data ?? []).map((attempt) => (
              <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/assessment/${attempt.id}`}
                    className="font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {attempt.domain?.name ?? 'Domain'}
                  </Link>
                  <div className="text-sm text-muted">
                    Started {formatDate(attempt.startedAt)}
                    {attempt.submittedAt ? ` · submitted ${formatDate(attempt.submittedAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {attempt.resultLevel ? (
                    <StatusBadge tone={LEVEL_TONE[attempt.resultLevel]}>
                      {LEVEL_LABEL[attempt.resultLevel]}
                    </StatusBadge>
                  ) : attempt.submittedAt === null &&
                    new Date(attempt.deadlineAt) > new Date() ? (
                    <StatusBadge tone="warning">In progress</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">Expired</StatusBadge>
                  )}
                  {/* Honest verb per state: an unfinished attempt resumes, a
                      finished one is opened read-only. */}
                  <Link
                    href={`/assessment/${attempt.id}`}
                    className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
                  >
                    {attempt.submittedAt === null &&
                    attempt.resultLevel === null &&
                    new Date(attempt.deadlineAt) > new Date()
                      ? 'Resume →'
                      : 'View →'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      )}
    </div>
  );
}
