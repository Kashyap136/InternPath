'use client';

// Admin: application review surface (SRS FR-CAND-030/031, BE-14/BE-18).
// SUBMITTED → UNDER_REVIEW (once), then APPROVED (seat allocated) or
// REJECTED (mandatory reason). All transitions happen server-side inside
// transactions; the UI only *offers* the legal next action per state.

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
  Select,
  StatusBadge,
  TextArea,
  ConfirmDialog,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import { APPLICATION_STATUS_LABEL } from '@/lib/status';
import type { Application, ApplicationStatus, PaginatedResponse } from '@/types';

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

type Decision = { application: Application; approved: boolean } | null;

const STATUS_FILTERS: Array<{ value: '' | ApplicationStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

export default function AdminApplicationsPage() {
  const [filter, setFilter] = useState<'' | ApplicationStatus>('');

  const applications = useApiLoad<PaginatedResponse<Application>>(
    () =>
      api.get<PaginatedResponse<Application>>(
        `/api/admin/applications?limit=50${filter ? `&status=${filter}` : ''}`
      ),
    [filter]
  );

  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const setUnderReview = async (application: Application) => {
    setActionError(null);
    setBusy(true);
    try {
      await api.put(`/api/admin/applications/${application.id}/under-review`, {});
      setActionSuccess('Application moved to under review.');
      applications.reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setActionError(
        parsed.formError ?? (err instanceof Error ? err.message : 'Cannot update the application.')
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmDecision = async () => {
    if (!decision) return;
    const { application, approved } = decision;

    if (!approved && reason.trim().length === 0) {
      setReasonError('A reason is required for every rejection (FR-CAND-031).');
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      await api.put(`/api/admin/applications/${application.id}/decision`, {
        status: approved ? 'APPROVED' : 'REJECTED',
        ...(approved ? {} : { reason: reason.trim() }),
      });
      setActionSuccess(approved ? 'Application approved — seat allocated.' : 'Application rejected.');
      setDecision(null);
      setReason('');
      applications.reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'The decision failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        subtitle="Review submitted applications and record approve/reject decisions."
      />

      {actionSuccess ? (
        <Alert variant="success" title="Recorded">
          {actionSuccess}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="error" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <Panel
        title="Filter by status"
        actions={
          <Field label="Status" htmlFor="status-filter">
            <Select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as '' | ApplicationStatus)}
            >
              {STATUS_FILTERS.map((f) => (
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
        ) : (applications.data?.data ?? []).length === 0 ? (
          <EmptyState
            bordered={false}
            title="No applications"
            description="Applications appear here once students submit them."
          />
        ) : (
          <ul className="divide-y divide-neutral-border">
            {applications.data?.data.map((application) => {
              return (
                <li key={application.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={STATUS_TONE[application.status]}>
                          {APPLICATION_STATUS_LABEL[application.status]}
                        </StatusBadge>
                        {application.program ? (
                          <Link
                            href={`/programs/${application.program.id}`}
                            className="font-medium text-ink underline-offset-2 hover:underline"
                          >
                            {application.program.title}
                          </Link>
                        ) : null}
                        <span className="text-sm text-muted">
                          {application.user
                            ? `${application.user.fullName} (${application.user.email})`
                            : `Applicant ${application.userId.slice(-6)}`}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {application.statementOfInterest
                          ? application.statementOfInterest.length > 220
                            ? `${application.statementOfInterest.slice(0, 220)}…`
                            : application.statementOfInterest
                          : 'No statement recorded.'}
                      </p>
                      <p className="text-xs text-muted">
                        Submitted {application.createdAt ? formatDate(application.createdAt) : '—'}
                        {application.decidedAt && application.decidedById
                          ? ` · decided ${formatDate(application.decidedAt)}`
                          : ''}
                      </p>
                      {application.rejectionReason ? (
                        <p className="mt-1 text-xs text-danger-text">Rejection reason: {application.rejectionReason}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {application.status === 'SUBMITTED' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void setUnderReview(application)}
                        >
                          Move to under review
                        </Button>
                      ) : null}
                      {application.status === 'UNDER_REVIEW' || application.status === 'SUBMITTED' ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setReason('');
                              setReasonError(null);
                              setDecision({ application, approved: true });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReason('');
                              setReasonError(null);
                              setDecision({ application, approved: false });
                            }}
                          >
                            Reject…
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={decision !== null}
        title={decision?.approved ? 'Approve application?' : 'Reject application?'}
        description={
          decision?.approved
            ? 'Approving allocates a seat for this program and lets the student accept or decline the offer. Seats are limited; approvals are transactional.'
            : 'Rejections require a recorded reason. The student will see the reason and cannot re-apply while another application for the same program is open.'
        }
        confirmLabel={decision?.approved ? 'Approve' : 'Reject with reason'}
        confirmVariant={decision?.approved ? 'primary' : 'danger'}
        busy={busy}
        error={actionError ?? undefined}
        onConfirm={() => void confirmDecision()}
        onCancel={() => {
          setDecision(null);
          setReasonError(null);
        }}
      >
        {decision && !decision.approved ? (
          <div className="mt-3">
            <Field label="Reason (required)" htmlFor="reject-reason" error={reasonError ?? undefined}>
              <TextArea
                id="reject-reason"
                value={reason}
                maxLength={500}
                rows={3}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                placeholder="Tell the student why the application was rejected."
              />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}