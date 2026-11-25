'use client';

// Application draft editor (SRS FR-CAND-028/029): statement of interest is
// editable only while the application is DRAFT; submission is a final
// guarded action re-validated server-side (deadline/profile/eligibility).

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
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
import { APPLICATION_STATUS_LABEL, applicationActionsFor } from '@/lib/status';
import type { Application, ApplicationReadiness, ApplicationStatus } from '@/types';
import { CheckCircleIcon, XCircleIcon } from '@/components/icons';

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

const STATEMENT_MAX = 2000;

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  NOT_ELIGIBLE: 'Not eligible',
};

/**
 * What the server will check on submit, shown before the student presses the
 * button. Every row mirrors one server-side gate (application.service).
 */
function readinessItems(r: ApplicationReadiness, statementFilled: boolean) {
  const required = LEVEL_LABEL[r.requiredLevel] ?? r.requiredLevel;
  return [
    {
      ok: statementFilled,
      label: 'Statement of interest written',
      help: 'Write a few sentences about why this program fits you.',
    },
    {
      ok: r.profileComplete,
      label: 'Student profile complete',
      help: 'Add your institution, degree, year of study, graduation year and at least one skill.',
      action: { href: '/profile', label: 'Complete profile' },
    },
    {
      ok: r.assessmentPassed,
      label: 'Domain assessment passed',
      help: r.assessmentTaken
        ? 'Your assessment result in this domain is not eligible yet. Retake it when the retake window allows.'
        : 'Take the skills assessment for this program’s domain.',
      action: { href: '/assessment', label: r.assessmentTaken ? 'View assessment' : 'Take assessment' },
    },
    {
      ok: r.levelMet,
      label: `Assessment level: ${required} or higher`,
      help: r.assessmentPassed
        ? `Your result is ${LEVEL_LABEL[r.resultLevel ?? ''] ?? 'below the requirement'}; this program needs ${required}.`
        : `This program needs the ${required} level on the domain assessment.`,
    },
    {
      ok: r.programOpen && r.deadlineOpen,
      label: 'Program still accepting applications',
      help: r.deadlineOpen
        ? 'The program is no longer open for applications.'
        : 'The application deadline has passed.',
    },
  ];
}

export default function ApplicationDetailPage() {
  const params = useParams<{ applicationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const applicationId = typeof params?.applicationId === 'string' ? params.applicationId : '';

  const { data, error, loading, reload } = useApiLoad<Application | null>(
    () =>
      isStudent
        ? api
            .get<{ data: Application | null }>(
              `/api/applications/${encodeURIComponent(applicationId)}`
            )
            .then((r) => r.data)
        : Promise.resolve(null),
    [isStudent, applicationId]
  );

  const [statement, setStatement] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);

  // A refused submission must be impossible to miss: the button sits at the
  // bottom of the page, so bring the error into view (on a phone it was
  // previously rendered off-screen and the draft looked silently unsent).
  useEffect(() => {
    if (submitError) submitErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [submitError]);

  useEffect(() => {
    // Seed the textarea once the server data arrives; afterwards local edits
    // rule so the student does not lose typing on data reloads.
    if (data && !dirty) setStatement(data.statementOfInterest ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    try {
      await api.put(`/api/applications/${encodeURIComponent(applicationId)}`, {
        statementOfInterest: statement,
      });
      setSaveMessage('Draft saved.');
      setDirty(false);
      reload();
    } catch (err) {
      // Field-mapped details are named for the statement so the message reads
      // naturally at form level (the textarea shows no inline error slot).
      setSaveError(
        apiErrorMessage(
          parseApiError(err, { statementOfInterest: 'Statement of interest' }),
          'Cannot save the draft.'
        )
      );
    } finally {
      setSaving(false);
    }
  }, [applicationId, statement, reload]);

  const submitApplication = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Persist the latest statement first so review follows what was shown.
      if (dirty) {
        await api.put(`/api/applications/${encodeURIComponent(applicationId)}`, {
          statementOfInterest: statement,
        });
      }
      await api.post(`/api/applications/${encodeURIComponent(applicationId)}/submit`, {});
      setConfirming(false);
      setSubmitting(false);
      setDirty(false);
      // Client-side navigation keeps the session state and shows the branded
      // loading transition (the list page refetches on mount).
      router.push('/applications');
    } catch (err) {
      setSubmitting(false);
      setConfirming(false);
      setSubmitError(
        apiErrorMessage(
          parseApiError(err, { statementOfInterest: 'Statement of interest' }),
          'Cannot submit the application.'
        )
      );
    }
  }, [applicationId, dirty, statement, router]);

  if (user && !isStudent) {
    // Backend requires STUDENT on application routes — a deep link from a
    // mentor/admin bookmark gets an honest notice instead of a raw 403.
    return (
      <div className="space-y-6">
        <Link href="/applications" className="text-sm text-muted underline-offset-2 hover:underline">
          ← My applications
        </Link>
        <Panel>
          <p className="text-sm text-secondary">
            Applications belong to student accounts. Mentors and administrators
            review applications from their own dashboards.
          </p>
        </Panel>
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading application…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    // Defensive: the backend 404s unknown ids, but never render a blank page.
    return (
      <div className="space-y-6">
        <Link href="/applications" className="text-sm text-muted underline-offset-2 hover:underline">
          ← My applications
        </Link>
        <EmptyState
          title="Application not available"
          description="This application does not exist or is not visible to your account."
          action={<ButtonLink href="/applications">My applications</ButtonLink>}
        />
      </div>
    );
  }

  const application = data;
  const actions = applicationActionsFor(application.status);
  const program = application.program;
  const readiness = application.status === 'DRAFT' ? application.readiness ?? null : null;
  const checklist = readiness ? readinessItems(readiness, statement.trim().length > 0) : [];
  const blockers = checklist.filter((item) => !item.ok);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/applications" className="text-sm text-muted underline-offset-2 hover:underline">
          ← My applications
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">{program?.title ?? 'Application'}</h1>
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

      {saveMessage ? (
        <Alert variant="success" title="Saved">
          {saveMessage}
        </Alert>
      ) : null}
      {saveError ? (
        <Alert variant="error" title="Draft not saved">
          {saveError}
        </Alert>
      ) : null}
      {application.status === 'DRAFT' ? (
        <Alert variant="info" title="This application is a draft — it has not been sent yet">
          Reviewers only see it after you press <strong>Submit for review</strong> below.
        </Alert>
      ) : null}

      {application.status === 'DRAFT' ? (
        <Panel title="Statement of interest" subtitle="Tell the review panel why this program fits your goals.">
          <Field
            label="Statement"
            htmlFor="statement"
            hint={`${statement.length}/${STATEMENT_MAX}`}
          >
            <TextArea
              id="statement"
              value={statement}
              rows={8}
              maxLength={STATEMENT_MAX}
              onChange={(e) => {
                setStatement(e.target.value);
                setDirty(true);
                setSaveMessage(null);
              }}
              placeholder="Describe your background, motivation and what you plan to build during the internship."
            />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel title="Statement of interest">
          <p className="whitespace-pre-line text-sm text-ink">
            {application.statementOfInterest || 'No statement recorded.'}
          </p>
        </Panel>
      )}

      {readiness ? (
        <Panel
          title="Ready to submit?"
          subtitle={
            blockers.length === 0
              ? 'Everything checks out. Submit when you are happy with your statement.'
              : `${blockers.length} item${blockers.length === 1 ? '' : 's'} left before you can submit.`
          }
        >
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                {item.ok ? (
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-success-text" />
                ) : (
                  <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger-solid" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.ok ? 'text-ink' : 'text-danger-text'}`}>
                    {item.label}
                  </p>
                  {!item.ok ? (
                    <p className="mt-0.5 text-sm text-secondary">
                      {item.help}{' '}
                      {item.action ? (
                        <Link
                          href={item.action.href}
                          className="font-medium text-primary-700 underline-offset-2 hover:underline"
                        >
                          {item.action.label} →
                        </Link>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {application.status !== 'DRAFT' ? (
        <Panel title="Status history">
          <ul className="space-y-1 text-sm">
            {(application.statusHistory ?? []).map((entry) => (
              <li key={entry.id} className="text-muted">
                {formatDate(entry.changedAt)}: {entry.fromStatus ?? '—'} →{' '}
                {APPLICATION_STATUS_LABEL[entry.toStatus]}
                {entry.reason ? ` — ${entry.reason}` : ''}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {submitError ? (
        <div ref={submitErrorRef}>
          <Alert variant="error" title="Not submitted — your application is still a draft">
            {submitError}
          </Alert>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href="/applications"
          className="text-sm text-muted underline-offset-2 hover:underline"
        >
          Back to applications
        </Link>
        {actions.canSubmit ? (
          <Button
            onClick={() => {
              setSubmitError(null);
              setConfirming(true);
            }}
            disabled={submitting || statement.trim().length === 0 || (readiness !== null && blockers.length > 0)}
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Submit application?"
        description="Submitting sends the application to the program's mentors and administrators for review and finalizes your statement. You cannot edit it afterwards."
        confirmLabel={submitting ? 'Submitting…' : 'Submit application'}
        confirmVariant="primary"
        busy={submitting}
        onConfirm={() => void submitApplication()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}