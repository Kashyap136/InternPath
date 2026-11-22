'use client';

// Admin certificates (Sprint 5 — FR-CAND-087/089/092): issue (COMPLETION for
// COMPLETED internships; APPRECIATION blocked by the frozen schema — see the
// Phase 10 report), revoke with mandatory reason (FR-DRV-008 cascade), list.

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
  StatusBadge,
  TextArea,
  TextInput,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import { CERTIFICATE_STATUS_LABEL } from '@/lib/status';
import type { Certificate } from '@/types';

export default function AdminCertificatesPage() {
  const { data, error, loading, reload } = useApiLoad<Certificate[]>(() =>
    api.get<{ data: Certificate[] }>('/api/admin/certificates?limit=50').then((r) => r.data)
  );

  const [issueOpen, setIssueOpen] = useState(false);
  const [internshipId, setInternshipId] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function issue() {
    setActionError(null);
    setMessage(null);
    setBusyId('issue');
    try {
      const result = await api.post<{ data: { certificateNumber: string } }>(
        '/api/admin/certificates/issue',
        { internshipId: internshipId.trim(), type: 'COMPLETION' }
      );
      setMessage(`Certificate ${result.data.certificateNumber} issued`);
      setIssueOpen(false);
      setInternshipId('');
      reload();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The certificate could not be issued');
    } finally {
      setBusyId(null);
    }
  }

  async function revoke() {
    if (!revokeTarget) return;
    setActionError(null);
    setMessage(null);
    setBusyId(revokeTarget.id);
    try {
      await api.post(`/api/admin/certificates/${revokeTarget.id}/revoke`, {
        reason: revokeReason.trim(),
      });
      setMessage(`Certificate ${revokeTarget.certificateNumber} revoked`);
      setRevokeTarget(null);
      setRevokeReason('');
      reload();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The certificate could not be revoked');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        subtitle="Issue completion certificates for COMPLETED internships and revoke with a mandatory reason. Revoking a completion certificate also revokes the appreciation certificate of the same internship."
        actions={
          <Button size="sm" onClick={() => setIssueOpen(true)}>
            Issue certificate
          </Button>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {actionError && <Alert variant="error" title="Action failed">{actionError}</Alert>}

      {loading && <LoadingState label="Loading certificates…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="No certificates issued"
            description="Issue a certificate for an internship that has reached COMPLETED status."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((certificate) => (
            <Panel key={certificate.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-mono text-sm font-semibold text-ink">
                      {certificate.certificateNumber}
                    </h2>
                    <StatusBadge tone={certificate.status === 'VALID' ? 'success' : 'danger'}>
                      {CERTIFICATE_STATUS_LABEL[certificate.status]}
                    </StatusBadge>
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {certificate.type.toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {certificate.internship?.user?.fullName ?? 'unknown'} ·{' '}
                    {certificate.internship?.program?.title ?? ''} · issued{' '}
                    {formatDate(certificate.issuedAt)} by {certificate.issuer?.fullName ?? 'unknown'}
                  </p>
                  {certificate.status === 'REVOKED' && (
                    <p className="mt-0.5 text-sm text-danger-solid">
                      Revocation reason: {certificate.revocationReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      window.open(`/api/backend/api/certificates/${certificate.id}/download`, '_blank')
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
        </div>
      )}

      {issueOpen && (
        <ConfirmDialog
          open
          title="Issue completion certificate"
          description="The backend verifies that the internship is in COMPLETED status and that no valid completion certificate exists. The unique certificate number is generated server-side."
          confirmLabel={busyId === 'issue' ? 'Issuing…' : 'Issue'}
          busy={busyId === 'issue'}
          confirmDisabled={internshipId.trim().length < 10}
          onConfirm={() => void issue()}
          onCancel={() => {
            if (busyId !== 'issue') setIssueOpen(false);
          }}
        >
          <Field label="Internship ID" htmlFor="issue-internship">
            <TextInput
              id="issue-internship"
              value={internshipId}
              onChange={(e) => setInternshipId(e.target.value)}
              placeholder="Paste the internship id from the Internships page"
            />
          </Field>
        </ConfirmDialog>
      )}

      {revokeTarget && (
        <ConfirmDialog
          open
          title={`Revoke ${revokeTarget.certificateNumber}`}
          description="Revoked certificates are never deleted — public verification reports them as REVOKED. If this is a completion certificate, the appreciation certificate of the same internship is revoked with it."
          confirmLabel={busyId === revokeTarget.id ? 'Revoking…' : 'Revoke'}
          confirmVariant="danger"
          busy={busyId === revokeTarget.id}
          confirmDisabled={revokeReason.trim().length < 5}
          onConfirm={() => void revoke()}
          onCancel={() => {
            if (busyId !== revokeTarget.id) setRevokeTarget(null);
          }}
        >
          <Field label="Reason (mandatory)" htmlFor="revoke-reason">
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
