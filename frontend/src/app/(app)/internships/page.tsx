'use client';

// My internships (Sprint 3/4 – FR-CAND-085): role-guarded student list with
// progress summaries. The backend returns only the student's own internships.

import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  ProgressBar,
  StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { INTERNSHIP_STATUS_LABEL, INTERNSHIP_STATUS_TONE as STATUS_TONE } from '@/lib/status';
import type { Internship } from '@/types';

export default function InternshipsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  const { data, error, loading, reload } = useApiLoad<Internship[]>(() =>
    api.get<{ data: Internship[] }>('/api/internships').then((r) => r.data)
  );

  if (!isStudent) {
    return (
      <div className="space-y-6">
        <PageHeader title="My internships" />
        <Panel>
          <p className="text-sm text-secondary">
            Internships are available to student accounts. Mentors can find their
            assignments under Assigned internships in the menu.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My internships" />
      {loading && <LoadingState label="Loading your internships…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="No internships yet"
            description="When an application is approved and you accept the offer, your internship appears here."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((internship) => (
            <Panel key={internship.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-serif text-lg font-semibold text-ink">
                      {internship.program?.title ?? 'Internship'}
                    </h2>
                    <StatusBadge tone={STATUS_TONE[internship.status]}>
                      {INTERNSHIP_STATUS_LABEL[internship.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {formatDate(internship.startDate)} – {formatDate(internship.endDate)}
                    {internship.project ? ` · ${internship.project.title}` : ''}
                  </p>
                  {internship.progress && (
                    <div className="mt-3 max-w-sm">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>
                          {internship.progress.approvedMandatoryTasks}/
                          {internship.progress.mandatoryTasks} mandatory tasks approved
                        </span>
                        <span>{internship.progress.approvedPercentage}%</span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar
                          value={internship.progress.approvedPercentage}
                          label="Internship completion"
                          valueText={`${internship.progress.approvedPercentage}% complete`}
                        />
                      </div>
                      {internship.progress.overdueCount > 0 && (
                        <p className="mt-1.5 text-xs text-danger-solid">
                          {internship.progress.overdueCount} overdue task
                          {internship.progress.overdueCount === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <ButtonLink href={`/internships/${internship.id}`} size="sm" className="shrink-0 self-start sm:self-center">
                  Open internship
                </ButtonLink>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
