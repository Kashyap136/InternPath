'use client';

// Student applications hub (SRS FR-CAND-028..034). Actions shown per state:
//  - DRAFT: edit statement + submit (server re-checks deadline/profile/eligibility)
//  - SUBMITTED/UNDER_REVIEW/APPROVED: withdraw (mandatory reason, FR-CAND-034)
//  - APPROVED: accept (creates internship) or decline, with confirmation
// Rejection reasons are only displayed for REJECTED applications (BE-18).

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  TextArea,
  ConfirmDialog,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import {
  APPLICATION_STATUS_LABEL,
  applicationActionsFor,
  visibleRejectionReason,
} from '@/lib/status';
import type { Application, ApplicationStatus } from '@/types';

const STATUS_TONE: Record<ApplicationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
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

const tileColours = [
  'bg-primary-700',
  'bg-wine-500',
  'bg-secondary',
  'bg-primary-900',
  'bg-wine-700',
];

function indexOf<T extends { id: string }>(id: string, items: T[]): number {
  return items.findIndex((i) => i.id === id);
}

type PendingAction =
  | { kind: 'submit'; application: Application }
  | { kind: 'withdraw'; application: Application }
  | { kind: 'accept'; application: Application }
  | { kind: 'decline'; application: Application }
  | null;

export default function ApplicationsPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  const { data, error, loading, reload } = useApiLoad<Application[]>(
    () =>
      isStudent
        ? api.get<{ data: Application[] }>('/api/applications').then((r) => r.data)
        : Promise.resolve([]),
    [isStudent]
  );

  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const openConfirm = (next: PendingAction) => {
    setActionError(null);
    setSuccess(null);
    setReason('');
    setReasonError(null);
    setPending(next);
  };

  const confirmAction = async () => {
    if (!pending) return;
    const { kind, application } = pending;

    if (kind === 'withdraw' && reason.trim().length === 0) {
      setReasonError('A reason is required to withdraw.');
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      if (kind === 'submit') {
        await api.post(`/api/applications/${application.id}/submit`, {});
        setSuccess('Application submitted for review.');
      } else if (kind === 'withdraw') {
        await api.post(`/api/applications/${application.id}/withdraw`, {
          reason: reason.trim(),
        });
        setSuccess('Application withdrawn.');
      } else if (kind === 'accept') {
        await api.post(`/api/applications/${application.id}/accept`, {});
        setSuccess('Offer accepted — an internship record was created. Congratulations!');
      } else if (kind === 'decline') {
        await api.post(`/api/applications/${application.id}/decline`, {});
        setSuccess('Offer declined.');
      }
      setPending(null);
      reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setActionError(apiErrorMessage(parsed, 'The action could not be completed.'));
      if (kind === 'withdraw') {
        setReasonError(parsed.fieldErrors['reason'] ?? null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My applications"
        subtitle="Track your internship applications and their status history."
      />

      {user && !isStudent ? (
        <Panel>
          <p className="text-sm text-secondary">
            Applications are managed by student accounts. Mentors review assigned
            work from the review queue; administrators use the Applications page
            under Administration.
          </p>
        </Panel>
      ) : null}

      {isStudent && success ? (
        <Alert variant="success" title="Done">
          {success}
        </Alert>
      ) : null}
      {isStudent && actionError ? (
        <Alert variant="error" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      {isStudent && loading ? (
        <LoadingState label="Loading applications…" />
      ) : isStudent && error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : isStudent && (data ?? []).length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Browse open programs to start your first application."
          action={
            <Link
              href="/programs"
              className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              Browse programs →
            </Link>
          }
        />
      ) : isStudent ? (
        <div className="space-y-4">
          {data?.map((application) => {
            const actions = applicationActionsFor(application.status);
            const program = application.program;
            const rejection = visibleRejectionReason(application);
            const color = tileColours[
              Math.abs(indexOf(application.id, data ?? [])) % tileColours.length
            ];
            return (
              // The card itself must not be a link: it contains real buttons
              // (accept/decline/withdraw) and nested interactive elements
              // would both open the confirm dialog and navigate away.
              <div
                key={application.id}
                className="rounded-[20px] border border-line bg-white p-5 shadow-card"
              >
                <div className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color} text-[11px] font-bold text-white tracking-tight`}>
                  {program ? program.title.slice(0, 1) : 'P'}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium text-ink">
                      {program ? (
                        <Link
                          href={`/applications/${application.id}`}
                          className="underline-offset-2 hover:text-primary-700 hover:underline"
                        >
                          {program.title}
                        </Link>
                      ) : (
                        'Program'
                      )}
                    </h2>
                    {program ? (
                      <p className="text-sm text-muted">
                        {program.durationWeeks} weeks · apply by {formatDate(program.applicationDeadline)}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge tone={STATUS_TONE[application.status]}>
                    {APPLICATION_STATUS_LABEL[application.status]}
                  </StatusBadge>
                </div>

                {application.status === 'DRAFT' ? (
                  <p className="mt-2 text-sm text-warning-text">
                    Not submitted yet — reviewers can’t see this application until you submit it.
                  </p>
                ) : null}

                {rejection ? (
                  <Alert variant="warning" title="Reason for rejection">
                    {rejection}
                  </Alert>
                ) : null}

                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted underline-offset-2 hover:underline">
                    Status history ({application.statusHistory?.length ?? 0})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {(application.statusHistory ?? []).map((entry) => (
                      <li key={entry.id} className="text-muted">
                        {formatDate(entry.changedAt)}: {entry.fromStatus ?? '—'} →{' '}
                        {APPLICATION_STATUS_LABEL[entry.toStatus]}
                        {entry.reason ? ` — ${entry.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>

                <div className="flex flex-wrap items-center gap-2 border-t border-neutral-border pt-3">
                  <Link
                    href={`/applications/${application.id}`}
                    className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
                  >
                    {actions.canSubmit ? 'Finish & submit →' : 'Open →'}
                  </Link>
                  {actions.canAccept ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openConfirm({ kind: 'accept', application })}
                    >
                      Accept offer
                    </Button>
                  ) : null}
                  {actions.canDecline ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openConfirm({ kind: 'decline', application })}
                    >
                      Decline offer
                    </Button>
                  ) : null}
                  {actions.canWithdraw ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => openConfirm({ kind: 'withdraw', application })}
                    >
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.kind === 'withdraw'
            ? 'Withdraw application?'
            : pending?.kind === 'accept'
              ? 'Accept the offer?'
              : pending?.kind === 'decline'
                ? 'Decline the offer?'
                : 'Submit application?'
        }
        description={
          pending?.kind === 'accept'
            ? 'Accepting creates your internship record for this program. This is a final decision.'
            : pending?.kind === 'decline'
              ? 'Declining releases your seat. This is a final decision.'
              : pending?.kind === 'withdraw'
                ? 'Withdrawing is final and cannot be undone. Please tell us why so the administrators get useful context.'
                : 'Submitting sends the application for administrator review. You cannot edit it afterwards.'
        }
        confirmLabel={
          pending?.kind === 'withdraw'
            ? 'Withdraw'
            : pending?.kind === 'accept'
              ? 'Accept offer'
              : pending?.kind === 'decline'
                ? 'Decline offer'
                : 'Submit'
        }
        confirmVariant={
          pending?.kind === 'withdraw' ? 'danger' : pending?.kind === 'decline' ? 'secondary' : 'primary'
        }
        busy={busy}
        onConfirm={() => void confirmAction()}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'withdraw' ? (
          <div className="mt-3">
            <Field label="Reason (required)" htmlFor="withdraw-reason" error={reasonError ?? undefined}>
              <TextArea
                id="withdraw-reason"
                value={reason}
                maxLength={500}
                rows={3}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                placeholder="Why are you withdrawing?"
                aria-invalid={reasonError ? true : undefined}
              />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}




