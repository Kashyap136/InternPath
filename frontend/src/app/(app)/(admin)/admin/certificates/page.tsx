'use client';

// Admin certificates (Sprint 5 — FR-CAND-087/089/092).
//
// - Awaiting issuance: every COMPLETED internship without a valid completion
//   certificate (including internships completed earlier and certificates
//   revoked and awaiting reissue), plus internships qualifying for an
//   appreciation certificate (BR-031). Issue one at a time or all at once.
// - Issued certificates: filter/search, download PDF, revoke with mandatory
//   reason (FR-DRV-008 cascade to the appreciation certificate).

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
  TextInput,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import { CERTIFICATE_STATUS_LABEL } from '@/lib/status';
import type { Certificate, CertificateType, EligibleInternship } from '@/types';

const TYPE_LABEL: Record<CertificateType, string> = {
  COMPLETION: 'Completion',
  APPRECIATION: 'Appreciation',
};

type IssueTarget = { internship: EligibleInternship; type: CertificateType };

export default function AdminCertificatesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const eligible = useApiLoad<{ rows: EligibleInternship[]; threshold: number }>(() =>
    api
      .get<{ data: EligibleInternship[]; meta: { appreciationThreshold: number } }>(
        '/api/admin/certificates/eligible'
      )
      .then((r) => ({ rows: r.data, threshold: r.meta.appreciationThreshold }))
  );

  const issued = useApiLoad<Certificate[]>(
    () => {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      if (appliedSearch) params.set('search', appliedSearch);
      return api.get<{ data: Certificate[] }>(`/api/admin/certificates?${params}`).then((r) => r.data);
    },
    [statusFilter, typeFilter, appliedSearch]
  );

  const [issueTarget, setIssueTarget] = useState<IssueTarget | null>(null);
  const [remarks, setRemarks] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = eligible.data?.rows ?? [];
  const pendingCompletion = rows.filter((r) => r.canIssueCompletion).length;
  const pendingAppreciation = rows.filter((r) => r.appreciationQualified).length;

  function reloadAll() {
    eligible.reload();
    issued.reload();
  }

  async function issue() {
    if (!issueTarget) return;
    setActionError(null);
    setMessage(null);
    setBusy('issue');
    try {
      const result = await api.post<{ data: { certificateNumber: string } }>('/api/admin/certificates/issue', {
        internshipId: issueTarget.internship.id,
        type: issueTarget.type,
        remarks: remarks.trim() || undefined,
      });
      setMessage(
        `${TYPE_LABEL[issueTarget.type]} certificate ${result.data.certificateNumber} issued to ${issueTarget.internship.user.fullName}`
      );
      setIssueTarget(null);
      setRemarks('');
      reloadAll();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The certificate could not be issued');
    } finally {
      setBusy(null);
    }
  }

  async function issueAll() {
    setActionError(null);
    setMessage(null);
    setBusy('bulk');
    try {
      const result = await api.post<{
        data: { issued: unknown[]; failed: { error: string }[] };
        message: string;
      }>('/api/admin/certificates/issue-pending', { includeAppreciation: true });
      setMessage(result.message);
      if (result.data.failed.length > 0) {
        setActionError(result.data.failed.map((f) => f.error).join(' · '));
      }
      setBulkOpen(false);
      reloadAll();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'Pending certificates could not be issued');
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!revokeTarget) return;
    setActionError(null);
    setMessage(null);
    setBusy(revokeTarget.id);
    try {
      const result = await api.post<{ data: { cascadedCertificates: number } }>(
        `/api/admin/certificates/${revokeTarget.id}/revoke`,
        { reason: revokeReason.trim() }
      );
      setMessage(
        `Certificate ${revokeTarget.certificateNumber} revoked` +
          (result.data.cascadedCertificates > 0
            ? ` (plus ${result.data.cascadedCertificates} linked appreciation certificate)`
            : '') +
          '. It can now be reissued from "Awaiting issuance".'
      );
      setRevokeTarget(null);
      setRevokeReason('');
      reloadAll();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The certificate could not be revoked');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        subtitle="Issue completion and appreciation certificates for COMPLETED internships, reissue revoked ones, and revoke with a mandatory reason."
      />

      {message && <Alert variant="success">{message}</Alert>}
      {actionError && (
        <Alert variant="error" title="Action failed">
          {actionError}
        </Alert>
      )}

      {/* ---------------- Awaiting issuance ---------------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Awaiting issuance</h2>
            <p className="text-sm text-secondary">
              Completed internships without a valid certificate, including earlier completions and
              revoked certificates awaiting reissue.
            </p>
          </div>
          {rows.length > 0 && (
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              Issue all pending ({pendingCompletion + pendingAppreciation})
            </Button>
          )}
        </div>

        {eligible.loading && <LoadingState label="Checking completed internships…" />}
        {eligible.error && <ErrorState message={eligible.error} onRetry={eligible.reload} />}
        {!eligible.loading && !eligible.error && rows.length === 0 && (
          <Panel>
            <EmptyState
              title="Nothing to issue"
              description="Every completed internship has its certificates. New completions appear here automatically."
            />
          </Panel>
        )}

        {rows.map((row) => (
          <Panel key={row.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-ink">{row.user.fullName}</p>
                <p className="break-words text-sm text-secondary">
                  {row.program.title}
                  {row.project ? ` · ${row.project.title}` : ''} · completed{' '}
                  {row.completedAt ? formatDate(row.completedAt) : '—'}
                  {row.finalScore !== null ? ` · score ${row.finalScore}/100` : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {row.canIssueCompletion && (
                    <StatusBadge tone="warning">
                      {row.revokedCompletion
                        ? `Reissue (replaces ${row.revokedCompletion})`
                        : 'Completion pending'}
                    </StatusBadge>
                  )}
                  {row.appreciationQualified && (
                    <StatusBadge tone="success">Qualifies for appreciation</StatusBadge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {row.canIssueCompletion && (
                  <Button size="sm" onClick={() => setIssueTarget({ internship: row, type: 'COMPLETION' })}>
                    {row.revokedCompletion ? 'Reissue completion' : 'Issue completion'}
                  </Button>
                )}
                {row.appreciationQualified && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!row.canIssueAppreciation}
                    title={
                      row.canIssueAppreciation
                        ? undefined
                        : 'Issue the completion certificate first'
                    }
                    onClick={() => setIssueTarget({ internship: row, type: 'APPRECIATION' })}
                  >
                    Issue appreciation
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </section>

      {/* ---------------- Issued certificates ---------------- */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-ink">Issued certificates</h2>
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
          }}
        >
          <TextInput
            aria-label="Search certificates"
            placeholder="Search number, student, email or program"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="VALID">Valid</option>
            <option value="REVOKED">Revoked</option>
          </Select>
          <Select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="COMPLETION">Completion</option>
            <option value="APPRECIATION">Appreciation</option>
          </Select>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {issued.loading && <LoadingState label="Loading certificates…" />}
        {issued.error && <ErrorState message={issued.error} onRetry={issued.reload} />}
        {!issued.loading && !issued.error && (!issued.data || issued.data.length === 0) && (
          <Panel>
            <EmptyState title="No certificates found" description="Issued certificates will be listed here." />
          </Panel>
        )}

        {issued.data?.map((certificate) => (
          <Panel key={certificate.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-mono text-sm font-semibold text-ink">{certificate.certificateNumber}</h3>
                  <StatusBadge tone={certificate.status === 'VALID' ? 'success' : 'danger'}>
                    {CERTIFICATE_STATUS_LABEL[certificate.status]}
                  </StatusBadge>
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {TYPE_LABEL[certificate.type]}
                  </span>
                </div>
                <p className="mt-1 break-words text-sm text-secondary">
                  {certificate.internship?.user?.fullName ?? 'unknown'} ·{' '}
                  {certificate.internship?.program?.title ?? ''} · issued {formatDate(certificate.issuedAt)} by{' '}
                  {certificate.issuer?.fullName ?? 'unknown'}
                </p>
                {certificate.replacesCertificate && (
                  <p className="mt-0.5 text-xs text-muted">Replaces {certificate.replacesCertificate}</p>
                )}
                {certificate.status === 'REVOKED' && (
                  <p className="mt-0.5 text-sm text-danger-solid">
                    Revoked{certificate.revokedAt ? ` ${formatDate(certificate.revokedAt)}` : ''}:{' '}
                    {certificate.revocationReason}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(`/verify/${encodeURIComponent(certificate.certificateNumber)}`, '_blank')}
                >
                  Verify
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    window.open(`/api/backend/api/admin/certificates/${certificate.id}/download`, '_blank')
                  }
                >
                  PDF
                </Button>
                {certificate.status === 'VALID' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRevokeTarget(certificate);
                      setRevokeReason('');
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </section>

      {issueTarget && (
        <ConfirmDialog
          open
          title={`Issue ${TYPE_LABEL[issueTarget.type].toLowerCase()} certificate`}
          description={
            <>
              For <strong>{issueTarget.internship.user.fullName}</strong> —{' '}
              {issueTarget.internship.program.title}.
              {issueTarget.type === 'COMPLETION' && issueTarget.internship.revokedCompletion
                ? ` This replaces revoked certificate ${issueTarget.internship.revokedCompletion}.`
                : ''}{' '}
              The backend re-verifies eligibility and generates the certificate number. The student is
              notified.
            </>
          }
          confirmLabel={busy === 'issue' ? 'Issuing…' : 'Issue'}
          confirmVariant="primary"
          busy={busy === 'issue'}
          onConfirm={() => void issue()}
          onCancel={() => {
            if (busy !== 'issue') setIssueTarget(null);
          }}
        >
          <Field label="Internal remarks (optional, audit log only)" htmlFor="issue-remarks">
            <TextArea id="issue-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}

      {bulkOpen && (
        <ConfirmDialog
          open
          title="Issue all pending certificates"
          description={`This issues ${pendingCompletion} completion certificate(s) and ${pendingAppreciation} appreciation certificate(s) for internships that qualify (score ≥ ${eligible.data?.threshold ?? '—'} and mentor recommendation). Each is re-verified by the backend and each student is notified.`}
          confirmLabel={busy === 'bulk' ? 'Issuing…' : 'Issue all'}
          confirmVariant="primary"
          busy={busy === 'bulk'}
          onConfirm={() => void issueAll()}
          onCancel={() => {
            if (busy !== 'bulk') setBulkOpen(false);
          }}
        />
      )}

      {revokeTarget && (
        <ConfirmDialog
          open
          title={`Revoke ${revokeTarget.certificateNumber}`}
          description="Revoked certificates are never deleted — public verification reports them as REVOKED. Revoking a completion certificate also revokes the appreciation certificate of the same internship. A replacement can be issued afterwards."
          confirmLabel={busy === revokeTarget.id ? 'Revoking…' : 'Revoke'}
          confirmVariant="danger"
          busy={busy === revokeTarget.id}
          confirmDisabled={revokeReason.trim().length < 5}
          onConfirm={() => void revoke()}
          onCancel={() => {
            if (busy !== revokeTarget.id) setRevokeTarget(null);
          }}
        >
          <Field label="Reason (mandatory, at least 5 characters)" htmlFor="revoke-reason">
            <TextArea
              id="revoke-reason"
              rows={3}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
