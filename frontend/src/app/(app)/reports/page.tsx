'use client';

// My reports (Sprint 6 — FR-CAND-094/096): students and mentors file reports
// and see only their own. Admin handling lives under /admin/reports.

import { useState } from 'react';
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
  TextInput,
  ConfirmDialog,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import { REPORT_CATEGORY_LABEL, REPORT_STATUS_LABEL } from '@/lib/status';
import type { Report, ReportCategory, ReportStatus } from '@/types';

const STATUS_TONE: Record<ReportStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  OPEN: 'warning',
  UNDER_REVIEW: 'warning',
  RESOLVED: 'success',
  REJECTED: 'neutral',
};

const CATEGORY_OPTIONS = Object.entries(REPORT_CATEGORY_LABEL).map(([value, label]) => ({
  value,
  label: label,
}));

export default function ReportsPage() {
  const { data, error, loading, reload } = useApiLoad<Report[]>(() =>
    api.get<{ data: Report[] }>('/api/reports/mine').then((r) => r.data)
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submitReport() {
    setFormError(null);
    if (description.trim().length < 20) {
      setFormError('Describe the issue in at least 20 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/reports', {
        category,
        description: description.trim(),
        evidenceLinks: evidenceLink.trim() ? [evidenceLink.trim()] : [],
      });
      setCreateOpen(false);
      setDescription('');
      setEvidenceLink('');
      reload();
    } catch (err) {
      setFormError(apiErrorMessage(parseApiError(err), 'The report could not be submitted.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reports"
        subtitle="Raise a concern about a project, an internship or conduct. Only you and administrators can read report content."
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            Submit a report
          </Button>
        }
      />

      {loading && !data && <LoadingState label="Loading reports…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="No reports submitted"
            description="If something on the platform looks wrong — a misleading internship, a fake project, misconduct or an evaluation dispute — submit a report and administrators will review it."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((report) => (
            <Panel key={report.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="font-medium text-ink">
                      {REPORT_CATEGORY_LABEL[report.category]}
                    </p>
                    <StatusBadge tone={STATUS_TONE[report.status]}>
                      {REPORT_STATUS_LABEL[report.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-secondary">{report.description}</p>
                  <p className="mt-1 text-xs text-muted">Submitted {formatDate(report.createdAt)}</p>
                  {report.resolutionNote && (
                    <p className="mt-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-body">
                      Resolution: {report.resolutionNote}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={createOpen}
        title="Submit a report"
        confirmLabel={busy ? 'Submitting…' : 'Submit report'}
        confirmVariant="primary"
        busy={busy}
        onConfirm={() => {
          void submitReport();
        }}
        onCancel={() => {
          if (!busy) setCreateOpen(false);
        }}
      >
        <div className="space-y-4">
          <Field label="Category" htmlFor="report-category">
            <Select
              id="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Description (required)"
            htmlFor="report-description"
            hint="Minimum 20 characters. Do not include passwords or other credentials."
          >
            <TextArea
              id="report-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Evidence link (optional)" htmlFor="report-evidence">
            <TextInput
              id="report-evidence"
              value={evidenceLink}
              onChange={(e) => setEvidenceLink(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          {formError && <Alert variant="error">{formError}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
