'use client';

// Public verification result (Sprint 5 — FR-CAND-091, §6.4 privacy rules).
// Shows only what is safe to disclose: VALID / REVOKED / NOT FOUND, the
// certificate number, recipient display name, program/domain/project with the
// source-type label (FR-CAND-043) and issue details. No contact data, scores
// or review content is ever returned by the API or rendered here.

import { use, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  ButtonLink,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { PublicHeader } from '@/components/public-header';
import { PublicFooter } from '@/components/public-footer';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import type { CertificateVerification } from '@/types';

export default function VerifyResultPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = use(params);
  const [retried, setRetried] = useState(0);

  const { data, error, loading } = useApiLoad<CertificateVerification>(
    // The api client returns the full `{ data: ... }` envelope — unwrap it so
    // the page receives the CertificateVerification payload itself. Without
    // this the VALID/REVOKED/NOT_FOUND branches all keyed off the envelope and
    // the public verification page rendered an empty body.
    () =>
      api
        .get<{ data: CertificateVerification }>(`/api/verify/${encodeURIComponent(number)}`)
        .then((r) => r.data),
    [number, String(retried)]
  );

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
        <PageHeader title="Certificate verification" />

        {loading && <LoadingState label="Verifying…" />}

        {!loading && error && (
          <Panel>
            <Alert variant="error" title="Verification unavailable">
              {error}
            </Alert>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => setRetried((r) => r + 1)}>
                Try again
              </Button>
            </div>
          </Panel>
        )}

        {!loading && !error && data && data.status === 'NOT_FOUND' && (
          <Panel>
            <Alert variant="warning" title="Certificate not found">
              No certificate matches the number{' '}
              <span className="font-mono font-semibold">{data.certificateNumber}</span>. Check the
              number printed on the certificate and try again.
            </Alert>
            <ButtonLink href="/verify" variant="secondary" size="sm" className="mt-4">
              Verify another certificate
            </ButtonLink>
          </Panel>
        )}

        {!loading && !error && data && data.certificate && (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {data.certificate.type === 'APPRECIATION'
                    ? 'Certificate of Appreciation'
                    : 'Certificate of Completion'}
                </p>
                <h2 className="break-words font-serif text-xl font-semibold text-ink">
                  {data.certificate.recipientName}
                </h2>
              </div>
              <StatusBadge tone={data.status === 'VALID' ? 'success' : 'danger'}>
                {data.status === 'VALID' ? 'Valid' : 'Revoked'}
              </StatusBadge>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Certificate number</dt>
                <dd className="font-mono font-medium text-ink">{data.certificateNumber}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Program</dt>
                <dd className="text-ink">{data.certificate.programTitle}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Domain</dt>
                <dd className="text-ink">{data.certificate.domainName}</dd>
              </div>
              {data.certificate.projectTitle && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="w-44 shrink-0 text-secondary">Project</dt>
                  <dd className="text-ink">
                    {data.certificate.projectTitle}
                    {data.certificate.projectSourceType && (
                      <span className="ml-2 text-muted">
                        (
                        {data.certificate.projectSourceType === 'MENTOR_CREATED'
                          ? 'Mentor-created project'
                          : data.certificate.projectSourceType === 'SIMULATED'
                            ? 'Simulated industry project'
                            : data.certificate.projectSourceType === 'OPEN_SOURCE'
                              ? 'Open-source contribution'
                              : data.certificate.projectSourceType === 'COMMUNITY'
                                ? 'Community project'
                                : 'Client project'}
                        )
                      </span>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Internship start</dt>
                <dd className="text-ink">{formatDate(data.certificate.internshipStart)}</dd>
              </div>
              {data.certificate.internshipCompletion && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="w-44 shrink-0 text-secondary">Completed</dt>
                  <dd className="text-ink">{formatDate(data.certificate.internshipCompletion)}</dd>
                </div>
              )}
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Issued</dt>
                <dd className="text-ink">{formatDate(data.certificate.issuedAt)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="w-44 shrink-0 text-secondary">Issuer</dt>
                <dd className="text-ink">
                  InternPath — {data.certificate.issuedByRole.toLowerCase()}
                </dd>
              </div>
            </dl>

            {data.certificate.revocationNote && (
              <div className="mt-4">
                <Alert variant="error" title="Revoked">
                  {data.certificate.revocationNote}
                  {data.certificate.revokedAt ? ` Revoked on ${formatDate(data.certificate.revokedAt)}.` : ''}
                  {data.certificate.replacedBy && (
                    <>
                      {' '}It was replaced by certificate{' '}
                      <Link
                        href={`/verify/${encodeURIComponent(data.certificate.replacedBy)}`}
                        className="font-mono font-semibold underline"
                      >
                        {data.certificate.replacedBy}
                      </Link>
                      .
                    </>
                  )}
                </Alert>
              </div>
            )}

            <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
              This verification confirms only that the InternPath platform issued the certificate
              described above in the stated status. It is not an academic qualification, a
              professional accreditation or an employment verification.
            </p>

            <ButtonLink href="/verify" variant="secondary" size="sm" className="mt-4">
              Verify another certificate
            </ButtonLink>
          </Panel>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
