'use client';

// Mentor review queue (Sprint 4 — FR-CAND-067/071): pending submissions for
// this mentor's interns, oldest first, with waiting time and a flag when the
// configured review period is breached.

import {
  Alert,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

interface QueueItem {
  submissionId: string;
  versionNumber: number;
  task: { id: string; title: string; status: string };
  intern: { id: string; fullName: string };
  program: { title: string };
  internshipId: string;
  submittedAt: string;
  waitingHours: number;
  reviewPeriodBreached: boolean;
}

export default function ReviewQueuePage() {
  const { data, error, loading, reload } = useApiLoad<QueueItem[]>(() =>
    api.get<{ data: QueueItem[] }>('/api/mentor/review-queue').then((r) => r.data)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review queue"
        subtitle="Pending submissions from your interns, oldest first. Reviews are handled from the internship detail page."
      />

      {loading && <LoadingState label="Loading review queue…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="Nothing waiting for review"
            description="When an intern submits work for one of your assigned internships, it appears here."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.some((item) => item.reviewPeriodBreached) && (
            <Alert variant="warning" title="Review period breached">
              Some submissions have waited longer than the configured review period.
            </Alert>
          )}
          {data.map((item) => (
            <Panel key={item.submissionId}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {item.task.title}{' '}
                    <span className="text-muted">(version {item.versionNumber})</span>
                  </p>
                  <p className="mt-0.5 text-sm text-secondary">
                    {item.intern.fullName} · {item.program.title} · submitted{' '}
                    {formatDateTime(item.submittedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.reviewPeriodBreached && (
                    <StatusBadge tone="danger" dot={false}>
                      Overdue review
                    </StatusBadge>
                  )}
                  <span className="text-sm text-muted">
                    waiting {item.waitingHours}h
                  </span>
                  <ButtonLink href={`/mentor/internships/${item.internshipId}`} size="sm">
                    Review
                  </ButtonLink>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
