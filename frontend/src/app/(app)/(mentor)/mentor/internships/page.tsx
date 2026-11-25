'use client';

// Assigned internships (Sprint 3/4 — SRS §18: mentors see ONLY internships
// assigned to them; the backend 404s everything else). Administrators use the
// same page to supervise every internship that has a mentor.

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
import { useApiLoad } from '@/lib/use-async';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { INTERNSHIP_STATUS_LABEL, INTERNSHIP_STATUS_TONE as STATUS_TONE } from '@/lib/status';
import type { Internship } from '@/types';

export default function MentorInternshipsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data, error, loading, reload } = useApiLoad<Internship[]>(() =>
    api.get<{ data: Internship[] }>('/api/mentor/internships').then((r) => r.data)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Task reviews & evaluation' : 'Assigned internships'}
        subtitle={
          isAdmin
            ? 'Every internship with an assigned mentor. Open one to review submissions, reopen tasks, adjust due dates or record the final evaluation.'
            : 'Only internships assigned to you are listed. Open one to track progress and review submissions.'
        }
      />
      {loading && <LoadingState label="Loading internships…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title={isAdmin ? 'No supervised internships' : 'No assigned internships'}
            description={
              isAdmin
                ? 'Internships appear here once a mentor is assigned to them from Operations → Internships.'
                : 'When an administrator assigns you as a mentor, the internship appears here with its tasks and review workload.'
            }
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
                    {internship.intern ? `Intern: ${internship.intern.fullName} · ` : ''}
                    {isAdmin && internship.mentor ? `Mentor: ${internship.mentor.fullName} · ` : ''}
                    {formatDate(internship.startDate)} – {formatDate(internship.endDate)}
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
                <ButtonLink href={`/mentor/internships/${internship.id}`} size="sm" className="shrink-0 self-start sm:self-center">
                  Open
                </ButtonLink>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
