'use client';

// Application review surface shared by administrators and mentors.
//
//   - ApplicationReviewList   → queue of applications with a status filter
//   - ApplicationReviewDetail → full candidate record + decision form
//
// Admins call /api/admin/applications (every program); mentors call
// /api/mentor/applications (programs in their expertise domains only — the
// backend enforces the scope). Transitions are validated server-side:
// SUBMITTED → UNDER_REVIEW → APPROVED (seat + mentor capacity checked) or
// REJECTED (reason required). The UI only offers the legal next step.

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  ProgressBar,
  Select,
  StatusBadge,
  TextArea,
} from '@/components/ui';
import { ArrowLeftIcon, ExternalLinkIcon, InboxIcon } from '@/components/icons';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate, formatDateTime } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import { APPLICATION_STATUS_LABEL } from '@/lib/status';
import type {
  Application,
  ApplicationReviewDetail,
  ApplicationStatus,
  PaginatedResponse,
} from '@/types';

export const APPLICATION_STATUS_TONE: Record<
  ApplicationStatus,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  ACCEPTED: 'success',
  DECLINED: 'neutral',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};

const STATUS_FILTERS: Array<{ value: '' | ApplicationStatus; label: string }> = [
  { value: '', label: 'All submitted' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

// Admin-only: drafts are never part of the review queue (the API leaves them
// out unless asked), but administrators can look them up explicitly.
const DRAFT_FILTER = { value: 'DRAFT' as const, label: 'Drafts (not submitted)' };

const isPending = (status: ApplicationStatus) =>
  status === 'SUBMITTED' || status === 'UNDER_REVIEW';

// ------------------------------------------------------------------
// List
// ------------------------------------------------------------------

export function ApplicationReviewList({
  apiBase,
  detailBase,
  subtitle,
  emptyDescription,
  allowDrafts = false,
}: {
  /** '/api/admin/applications' or '/api/mentor/applications' */
  apiBase: string;
  /** Route prefix for the detail page, e.g. '/admin/applications' */
  detailBase: string;
  subtitle: string;
  emptyDescription: string;
  /** Offer the admin-only "Drafts (not submitted)" filter. */
  allowDrafts?: boolean;
}) {
  const filters = allowDrafts ? [...STATUS_FILTERS, DRAFT_FILTER] : STATUS_FILTERS;
  const [filter, setFilter] = useState<'' | ApplicationStatus>('');

  const applications = useApiLoad<PaginatedResponse<Application>>(
    () =>
      api.get<PaginatedResponse<Application>>(
        `${apiBase}?limit=50${filter ? `&status=${filter}` : ''}`
      ),
    [apiBase, filter]
  );

  const rows = applications.data?.data ?? [];
  const pendingCount = rows.filter((a) => isPending(a.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Applications" subtitle={subtitle} />

      <Panel
        title={
          filter === 'DRAFT'
            ? 'Drafts — not submitted by the student yet'
            : filter
              ? APPLICATION_STATUS_LABEL[filter]
              : 'All submitted applications'
        }
        subtitle={
          !filter && !applications.loading && pendingCount > 0
            ? `${pendingCount} waiting for a decision`
            : undefined
        }
        actions={
          <Field label="Status" htmlFor="status-filter">
            <Select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as '' | ApplicationStatus)}
            >
              {filters.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
        }
      >
        {applications.loading ? (
          <LoadingState label="Loading applications…" />
        ) : applications.error ? (
          <ErrorState message={applications.error} onRetry={applications.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            bordered={false}
            icon={InboxIcon}
            title="No applications"
            description={
              filter === 'DRAFT' ? 'No students have unsent drafts right now.' : emptyDescription
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((application) => (
              <li key={application.id} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={APPLICATION_STATUS_TONE[application.status]}>
                        {APPLICATION_STATUS_LABEL[application.status]}
                      </StatusBadge>
                      <span className="font-medium text-ink">
                        {application.user?.fullName ?? `Applicant ${application.userId.slice(-6)}`}
                      </span>
                      {application.program ? (
                        <span className="text-sm text-muted">→ {application.program.title}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-secondary">
                      {application.statementOfInterest || 'No statement recorded.'}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {application.submittedAt
                        ? `Submitted ${formatDate(application.submittedAt)}`
                        : `Created ${formatDate(application.createdAt)}`}
                      {application.decidedAt ? ` · decided ${formatDate(application.decidedAt)}` : ''}
                    </p>
                  </div>
                  <ButtonLink
                    href={`${detailBase}/${application.id}`}
                    className="self-start sm:self-center"
                    size="sm"
                    variant={isPending(application.status) ? 'primary' : 'secondary'}
                  >
                    {isPending(application.status) ? 'Review & decide' : 'View'}
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------
// Detail + decision form
// ------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{children}</dd>
    </div>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  NOT_ELIGIBLE: 'Not eligible',
};

export function ApplicationReviewDetailView({
  id,
  apiBase,
  listHref,
}: {
  id: string;
  apiBase: string;
  listHref: string;
}) {
  const detail = useApiLoad<{ data: ApplicationReviewDetail }>(
    () => api.get<{ data: ApplicationReviewDetail }>(`${apiBase}/${id}`),
    [apiBase, id]
  );

  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const startReview = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await api.put(`${apiBase}/${id}/under-review`, {});
      setActionSuccess('Marked as under review. The student can see their application is being assessed.');
      detail.reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'Could not start the review.'));
    } finally {
      setBusy(false);
    }
  };

  const submitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) {
      setActionError('Choose approve or reject.');
      return;
    }
    const trimmed = reason.trim();
    if (decision === 'REJECTED' && !trimmed) {
      setReasonError('Tell the student why — a reason is required for every rejection.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await api.put(`${apiBase}/${id}/decision`, {
        status: decision,
        ...(trimmed ? { reason: trimmed } : {}),
      });
      setActionSuccess(
        decision === 'APPROVED'
          ? 'Application approved — a seat is held and the student has been notified to accept the offer.'
          : 'Application rejected — the student has been notified with your reason.'
      );
      setDecision(null);
      setReason('');
      detail.reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'The decision could not be recorded.'));
    } finally {
      setBusy(false);
    }
  };

  const backLink = (
    <Link
      href={listHref}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-ink"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      All applications
    </Link>
  );

  if (detail.loading) return <LoadingState label="Loading application…" />;
  if (detail.error || !detail.data) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState message={detail.error ?? 'Application not found.'} onRetry={detail.reload} />
      </div>
    );
  }

  const app = detail.data.data;
  const profile = app.user.studentProfile;
  const program = app.program;
  const requiredLevel = program?.requiredLevel ?? program?.level ?? null;
  const pending = isPending(app.status);
  const seatsLeft = Math.max(0, app.seats.total - app.seats.taken);

  return (
    <div className="space-y-6">
      {backLink}
      <PageHeader
        eyebrow="Application review"
        title={app.user.fullName}
        subtitle={program ? `Applying to ${program.title}` : undefined}
        actions={
          <StatusBadge tone={APPLICATION_STATUS_TONE[app.status]}>
            {APPLICATION_STATUS_LABEL[app.status]}
          </StatusBadge>
        }
      />

      {actionSuccess ? (
        <Alert variant="success" title="Recorded" onDismiss={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Candidate record */}
        <div className="space-y-6">
          <Panel title="Statement of interest">
            <p className="whitespace-pre-line text-sm leading-6 text-body">
              {app.statementOfInterest || 'The student did not write a statement.'}
            </p>
          </Panel>

          <Panel title="Student profile" subtitle={app.user.email}>
            {profile ? (
              <div className="space-y-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Institution">{profile.institution}</Fact>
                  <Fact label="Degree">{profile.degree}</Fact>
                  <Fact label="Year of study">{profile.yearOfStudy}</Fact>
                  <Fact label="Graduation">{profile.graduationYear}</Fact>
                </dl>
                {profile.declaredSkills.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Declared skills</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.declaredSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-line bg-surface-subtle px-2.5 py-0.5 text-xs text-body"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {profile.githubProfileUrl || profile.portfolioUrl ? (
                  <div className="flex flex-wrap gap-4 text-sm">
                    {[
                      { href: profile.githubProfileUrl, label: 'GitHub profile' },
                      { href: profile.portfolioUrl, label: 'Portfolio' },
                    ]
                      .filter((l): l is { href: string; label: string } => Boolean(l.href))
                      .map((l) => (
                        <a
                          key={l.label}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
                        >
                          {l.label}
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                      ))}
                  </div>
                ) : null}
                {profile.bio ? (
                  <p className="whitespace-pre-line text-sm leading-6 text-secondary">{profile.bio}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">This student has not completed a profile.</p>
            )}
          </Panel>

          <Panel
            title="Domain assessment"
            subtitle={program?.domain ? program.domain.name : undefined}
          >
            {app.assessment ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <StatusBadge tone={app.assessment.resultLevel === 'NOT_ELIGIBLE' ? 'danger' : 'success'}>
                    {LEVEL_LABEL[app.assessment.resultLevel ?? ''] ?? 'No result'}
                  </StatusBadge>
                  {requiredLevel ? (
                    <span className="text-secondary">
                      Program requires {LEVEL_LABEL[requiredLevel] ?? requiredLevel}
                    </span>
                  ) : null}
                  {app.assessment.submittedAt ? (
                    <span className="text-muted">· taken {formatDate(app.assessment.submittedAt)}</span>
                  ) : null}
                </div>
                {app.assessment.skills.length > 0 ? (
                  <ul className="space-y-3">
                    {app.assessment.skills.map((s) => (
                      <li key={s.skillId}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-body">{s.name}</span>
                          {/* Per-skill scores are stored on a 0–10 scale
                              (assessment.service: correct / total × 10) — the
                              reviewer view previously printed them as a
                              percentage, so a perfect 10/10 read "10%". */}
                          <span className="font-medium tabular-nums text-ink">{Math.round(s.score)} / 10</span>
                        </div>
                        <ProgressBar
                          value={Math.max(0, Math.min(100, s.score * 10))}
                          label={`${s.name} score`}
                          valueText={`${Math.round(s.score)} out of 10`}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted">No completed assessment in this domain.</p>
            )}
          </Panel>

          <Panel title="History">
            <ol className="space-y-3">
              {app.statusHistory.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                  <div className="min-w-0">
                    <p className="text-ink">
                      <span className="font-medium">{APPLICATION_STATUS_LABEL[h.toStatus]}</span>
                      {h.changedByName ? (
                        <span className="text-secondary">
                          {' '}by {h.changedByName}
                          {h.changedByRole && h.changedByRole !== 'STUDENT'
                            ? ` (${h.changedByRole === 'ADMIN' ? 'admin' : 'mentor'})`
                            : ''}
                        </span>
                      ) : null}
                    </p>
                    {h.reason ? <p className="text-secondary">“{h.reason}”</p> : null}
                    <p className="text-xs text-muted">{formatDateTime(h.changedAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        {/* Decision */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="Decision">
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Seats left">
                {seatsLeft} of {app.seats.total}
              </Fact>
              <Fact label="Submitted">{app.submittedAt ? formatDate(app.submittedAt) : '—'}</Fact>
              {program ? (
                <>
                  <Fact label="Starts">{formatDate(program.startDate)}</Fact>
                  <Fact label="Duration">{program.durationWeeks} weeks</Fact>
                </>
              ) : null}
            </dl>

            {app.status === 'APPROVED' && app.acceptanceDeadline ? (
              <p className="mt-4 text-sm text-secondary">
                Offer open until {formatDate(app.acceptanceDeadline)}. The student must accept to start.
              </p>
            ) : null}
            {app.status === 'REJECTED' && app.rejectionReason ? (
              <p className="mt-4 text-sm text-danger-text">Reason given: “{app.rejectionReason}”</p>
            ) : null}

            {actionError ? (
              <div className="mt-4">
                <Alert variant="error" title="Not recorded">{actionError}</Alert>
              </div>
            ) : null}

            {pending ? (
              <div className="mt-5 space-y-5 border-t border-line pt-5">
                {app.status === 'SUBMITTED' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void startReview()}
                  >
                    Mark as under review
                  </Button>
                ) : null}

                <form onSubmit={(e) => void submitDecision(e)} className="space-y-4" noValidate>
                  <fieldset>
                    <legend className="text-sm font-medium text-body">Your decision</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          { value: 'APPROVED', label: 'Approve', active: 'border-primary-600 bg-primary-50 text-primary-800' },
                          { value: 'REJECTED', label: 'Reject', active: 'border-danger-solid bg-danger-bg text-danger-text' },
                        ] as const
                      ).map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${
                            decision === opt.value ? opt.active : 'border-line-input bg-white text-secondary hover:bg-surface-subtle'
                          }`}
                        >
                          <input
                            type="radio"
                            name="decision"
                            value={opt.value}
                            checked={decision === opt.value}
                            onChange={() => {
                              setDecision(opt.value);
                              setReasonError(null);
                              setActionError(null);
                            }}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {decision ? (
                    <Field
                      label={decision === 'REJECTED' ? 'Reason for the student' : 'Note'}
                      htmlFor="decision-reason"
                      optional={decision === 'APPROVED'}
                      hint={
                        decision === 'REJECTED'
                          ? 'Shown to the student. Be specific and constructive.'
                          : 'Saved in the history and visible to reviewers.'
                      }
                      error={reasonError ?? undefined}
                    >
                      <TextArea
                        id="decision-reason"
                        rows={4}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value);
                          setReasonError(null);
                        }}
                        placeholder={
                          decision === 'REJECTED'
                            ? 'e.g. The program needs stronger JavaScript fundamentals — retake the assessment and apply to the next cohort.'
                            : 'e.g. Strong assessment and relevant portfolio.'
                        }
                      />
                    </Field>
                  ) : null}

                  {decision === 'APPROVED' ? (
                    <p className="text-xs leading-5 text-muted">
                      Approving holds one seat and gives the student a limited time to accept.
                      {seatsLeft === 0 ? ' This program has no seats left, so approval will fail.' : ''}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="w-full"
                    variant={decision === 'REJECTED' ? 'danger' : 'primary'}
                    disabled={!decision}
                    loading={busy}
                  >
                    {decision === 'REJECTED'
                      ? 'Reject application'
                      : decision === 'APPROVED'
                        ? 'Approve application'
                        : 'Choose a decision'}
                  </Button>
                </form>
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-5 text-sm text-muted">
                {app.status === 'DRAFT'
                  ? 'The student has not submitted this application yet.'
                  : 'A decision has been recorded. No further action is needed here.'}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
