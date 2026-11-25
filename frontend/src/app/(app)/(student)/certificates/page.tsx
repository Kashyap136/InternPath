'use client';

// My certificates (Sprint 5 — FR-CAND-090): the student's issued certificates
// with on-demand PDF download. Issuance itself is administrator-only
// (BR-CAND-032); completed internships awaiting issuance surface a status note.

import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CERTIFICATE_STATUS_LABEL } from '@/lib/status';
import type { Certificate } from '@/types';

export default function CertificatesPage() {
  const { user } = useAuth();
  const role = user?.role;
  const { data, error, loading, reload } = useApiLoad<Certificate[] | null>(
    () => (role === 'STUDENT' ? api.get<{ data: Certificate[] }>('/api/certificates').then((r) => r.data) : Promise.resolve(null)),
    [role ?? '']
  );

  if (user && user.role !== 'STUDENT') {
    return (
      <div className="space-y-6">
        <PageHeader title="My certificates" />
        <Panel>
          <p className="text-sm text-secondary">
            Certificates are issued to student accounts after their internships are
            completed and verified.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My certificates"
        subtitle="Certificates are issued by InternPath administration after an internship is completed and verified."
      />
      {loading && <LoadingState label="Loading certificates…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="No certificates yet"
            description="When you complete an internship and administration issues your certificate, it appears here with a downloadable PDF and a public verification number."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((certificate) => (
            <Panel key={certificate.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-serif text-lg font-semibold text-ink">
                      {certificate.internship?.program?.title ?? 'Internship'}
                    </h2>
                    <StatusBadge
                      tone={certificate.status === 'VALID' ? 'success' : 'danger'}
                    >
                      {CERTIFICATE_STATUS_LABEL[certificate.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {certificate.type === 'APPRECIATION' ? 'Certificate of appreciation' : 'Certificate of completion'} ·{' '}
                    <span className="font-mono">{certificate.certificateNumber}</span> · Issued{' '}
                    {formatDate(certificate.issuedAt)}
                    {certificate.internship?.project ? ` · ${certificate.internship.project.title}` : ''}
                  </p>
                  {certificate.status === 'REVOKED' && certificate.revocationReason && (
                    <div className="mt-2 max-w-xl">
                      <Alert variant="error" title="Revoked">
                        {certificate.revocationReason}
                      </Alert>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {certificate.status === 'VALID' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      title="Copy the public verification link to share with employers"
                      onClick={() => {
                        const url = `${window.location.origin}/verify/${encodeURIComponent(certificate.certificateNumber)}`;
                        void navigator.clipboard?.writeText(url);
                      }}
                    >
                      Copy verify link
                    </Button>
                  )}
                  <ButtonLink
                    href={`/verify/${encodeURIComponent(certificate.certificateNumber)}`}
                    variant="secondary"
                    size="sm"
                  >
                    Verify
                  </ButtonLink>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      window.open(`/api/backend/api/certificates/${certificate.id}/download`, '_blank')
                    }
                  >
                    Download PDF
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
