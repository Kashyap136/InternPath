'use client';

// Admin reports handling (Sprint 6 — FR-CAND-095): move reports through
// OPEN → UNDER_REVIEW → RESOLVED/REJECTED with a mandatory resolution note.

import { useState } from 'react';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextArea,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL } from '@/lib/status';
import type { Report, ReportStatus } from '@/types';

const STATUS_TONE: Record<ReportStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning',
  UNDER_REVIEW: 'warning',
  RESOLVED: 'success',
  REJECTED: 'neutral',
};

export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, error, loading, reload } = useApiLoad<Report[]>(
    () => {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      return api.get<{ data: Report[] }>(`/api/admin/reports?${params.toString()}`).then((r) => r.data);
    },
    [statusFilter]
  );

  const [target, setTarget] = useState<Report | null>(null);
  const [nextStatus, setNextStatus] = useState<ReportStatus>('UNDER_REVIEW');
  const [resolutionNote, setResolutionNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function changeStatus() {
    if (!target) return;
    setActionError(null);
    setMessage(null);
    setBusyId(target.id);
    try {
      await api.patch(`/api/admin/reports/${target.id}/status`, {
        status: nextStatus,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      setMessage(`Report moved to ${REPORT_STATUS_LABEL[nextStatus]}`);
      setTarget(null);
      setResolutionNote('');
      reload();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The status could not be updated');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Report content is restricted to the reporter and administrators (FR-CAND-096). Resolutions require a note."
        actions={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(REPORT_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {actionError && <Alert variant="error" title="Action failed">{actionError}</Alert>}

      {loading && <LoadingState label="Loading reports…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState title="No reports" description="Reports filed by students and mentors appear here." />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((report) => (
            <Panel key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="font-medium text-ink">{REPORT_CATEGORY_LABEL[report.category]}</p>
                    <StatusBadge tone={STATUS_TONE[report.status]}>
                      {REPORT_STATUS_LABEL[report.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-body">{report.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    By {report.reporter?.fullName ?? 'unknown'} ({report.reporter?.role?.toLowerCase() ?? '?'}) ·{' '}
                    {formatDateTime(report.createdAt)}
                    {report.evidenceLinks.length > 0 && ` · ${report.evidenceLinks.length} evidence link(s)`}
                  </p>
                  {report.resolutionNote && (
                    <p className="mt-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-body">
                      Resolution: {report.resolutionNote}
                    </p>
                  )}
                </div>
                {report.status !== 'RESOLVED' && report.status !== 'REJECTED' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      setTarget(report);
                      setNextStatus(report.status === 'OPEN' ? 'UNDER_REVIEW' : 'RESOLVED');
                      setResolutionNote('');
                    }}
                  >
                    Handle
                  </Button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {target && (
        <ConfirmDialog
          open
          title="Update report status"
          confirmLabel={busyId === target.id ? 'Saving…' : 'Update'}
          busy={busyId === target.id}
          confirmDisabled={
            (nextStatus === 'RESOLVED' || nextStatus === 'REJECTED') && resolutionNote.trim().length < 5
          }
          onConfirm={() => void changeStatus()}
          onCancel={() => {
            if (busyId !== target.id) setTarget(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Next status" htmlFor="report-next-status">
              <Select
                id="report-next-status"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ReportStatus)}
              >
                {(['UNDER_REVIEW', 'RESOLVED', 'REJECTED'] as ReportStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {REPORT_STATUS_LABEL[status]}
                  </option>
                ))}
              </Select>
            </Field>
            {(nextStatus === 'RESOLVED' || nextStatus === 'REJECTED') && (
              <Field label="Resolution note (mandatory)" htmlFor="report-note">
                <TextArea
                  id="report-note"
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
              </Field>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
