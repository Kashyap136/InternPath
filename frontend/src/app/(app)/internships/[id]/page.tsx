'use client';

// Internship detail (Sprint 3/4): milestones and task instances with lock
// state (FR-056), start (FR-057) and submit (FR-061-066) flows, submission
// versions with mentor feedback (FR-070), the final evaluation (FR-077),
// certificate status and withdrawal (FR-083). Every action the backend would
// reject is hidden or disabled with the reason shown.

import { use, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
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
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import {
  CERTIFICATE_STATUS_LABEL,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE,
  RECOMMENDATION_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE,
} from '@/lib/status';
import { ProgressBar } from '@/components/ui';
import type {
  CertificateStatus,
  InternTask,
  Internship,
} from '@/types';

const INTERNSHIP_TONE = INTERNSHIP_STATUS_TONE;
const TASK_TONE = TASK_STATUS_TONE;

export default function InternshipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const { data, error, loading, reload } = useApiLoad<Internship | null>(
    () =>
      isStudent
        ? api.get<{ data: Internship }>(`/api/internships/${id}`).then((r) => r.data)
        : Promise.resolve(null),
    [isStudent, id]
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [submitTask, setSubmitTask] = useState<InternTask | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setActionError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await action();
      setActionMessage(successMessage);
      reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  }

  function startTask(task: InternTask) {
    setStartingTaskId(task.id);
    void runAction(
      () => api.post(`/api/internships/${id}/tasks/${task.id}/start`, {}),
      'Task started'
    ).finally(() => setStartingTaskId(null));
  }

  async function submitWork(fields: {
    repositoryUrl?: string;
    commitRef?: string;
    documentUrl?: string;
    liveDemoUrl?: string;
    notes?: string;
  }) {
    if (!submitTask) return;
    setActionError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await api.post(`/api/internships/${id}/tasks/${submitTask.id}/submissions`, {
        ...fields,
        originalityDeclared: true,
      });
      setActionMessage('Submission recorded — your mentor has been notified');
      reload();
      // Close only on success: a failed submission keeps the dialog open with
      // its inline error so the entered evidence is never lost.
      setSubmitTask(null);
    } catch (err) {
      // Surfaced by the dialog's own inline error state (it stays open).
      throw new Error(
        apiErrorMessage(parseApiError(err), 'The submission could not be recorded')
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    await runAction(
      () => api.post(`/api/internships/${id}/withdraw`, { reason: withdrawReason.trim() }),
      'Internship withdrawn'
    );
    setWithdrawOpen(false);
  }

  if (user && !isStudent) {
    return (
      <Panel>
        <p className="text-sm text-secondary">
          Internship workspaces belong to student accounts. Mentors find their
          assigned internships under Assigned internships in the menu.
        </p>
      </Panel>
    );
  }

  if (loading) return <LoadingState label="Loading internship…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const internship = data;
  const finished = ['COMPLETED', 'WITHDRAWN', 'TERMINATED'].includes(internship.status);
  const evaluation = internship.evaluation ?? null;

  return (
    <>
      <PageHeader
        title={internship.program?.title ?? 'Internship'}
        subtitle={`${formatDate(internship.startDate)} – ${formatDate(internship.endDate)}${
          internship.mentor ? ` · Mentor: ${internship.mentor.fullName}` : ' · Mentor assignment pending'
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge tone={INTERNSHIP_TONE[internship.status]}>
              {INTERNSHIP_STATUS_LABEL[internship.status]}
            </StatusBadge>
            {!finished && (
              <Button variant="secondary" size="sm" onClick={() => setWithdrawOpen(true)}>
                Withdraw
              </Button>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="mb-4">
          <Alert variant="error" title="Action failed">{actionError}</Alert>
        </div>
      )}
      {actionMessage && (
        <div className="mb-4">
          <Alert variant="success" title="Done">{actionMessage}</Alert>
        </div>
      )}

      {internship.progress && (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">
                {internship.progress.approvedMandatoryTasks} of{' '}
                {internship.progress.mandatoryTasks} mandatory tasks approved
              </p>
              {internship.progress.currentMilestone && (
                <p className="mt-0.5 text-sm text-secondary">
                  Current milestone: {internship.progress.currentMilestone.title}
                </p>
              )}
              {internship.progress.nextTask && (
                <p className="mt-0.5 text-sm text-secondary">
                  Next task: <span className="font-medium text-ink">{internship.progress.nextTask.title}</span>{' '}
                  (due {formatDate(internship.progress.nextTask.dueDate)})
                </p>
              )}
              {internship.progress.pendingReviewCount > 0 && (
                <p className="mt-0.5 text-sm text-secondary">
                  {internship.progress.pendingReviewCount} submission
                  {internship.progress.pendingReviewCount === 1 ? '' : 's'} awaiting mentor review
                </p>
              )}
              {internship.progress.changesRequestedCount > 0 && (
                <p className="mt-0.5 text-sm text-danger-solid">
                  {internship.progress.changesRequestedCount} task
                  {internship.progress.changesRequestedCount === 1 ? '' : 's'} requiring changes
                </p>
              )}
              {internship.progress.overdueCount > 0 && (
                <p className="mt-0.5 text-sm text-danger-solid">
                  {internship.progress.overdueCount} overdue task
                  {internship.progress.overdueCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Completion</span>
                <span>{internship.progress.approvedPercentage}%</span>
              </div>
              <div className="mt-1">
                <ProgressBar
                  value={internship.progress.approvedPercentage}
                  label="Internship completion"
                  valueText={`${internship.progress.approvedPercentage}% complete`}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Verified weight: {internship.progress.weightApproved}/{internship.progress.weightTotal} · completion threshold {internship.completionThreshold}%
              </p>
            </div>
          </div>
        </Panel>
      )}

      {internship.status === 'PENDING_START' && (
        <div className="mb-6">
          <Alert variant="info" title="Not started yet">
            Your internship begins on {formatDate(internship.startDate)}. Tasks appear once a
            mentor and a project have been assigned and the start date is reached.
          </Alert>
        </div>
      )}

      {(!internship.milestones || internship.milestones.length === 0) &&
        internship.status !== 'PENDING_START' && (
          <Panel className="mb-6">
            <EmptyState
              title="No tasks assigned"
              description="A project has not been assigned to this internship yet. Administrators assign projects before the start date."
            />
          </Panel>
        )}

      {internship.milestones?.map((milestone) => (
        <Panel key={milestone.id} className="mb-6" padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-serif text-base font-semibold text-ink">{milestone.title}</h2>
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {milestone.isRequired ? 'Required' : 'Optional'}
            </span>
          </div>
          <div className="divide-y divide-line">
            {(milestone.tasks ?? []).map((task) => (
              <div key={task.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="font-medium text-ink">{task.title}</p>
                      <StatusBadge tone={TASK_TONE[task.status]}>
                        {TASK_STATUS_LABEL[task.status]}
                      </StatusBadge>
                      {task.overdue && (
                        <StatusBadge tone="danger" dot={false}>
                          Overdue
                        </StatusBadge>
                      )}
                      {task.locked && (
                        <StatusBadge tone="neutral" dot={false}>
                          Locked – prerequisites pending
                        </StatusBadge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-secondary">
                      Due {formatDate(task.dueDate)}
                      {task.evidenceTypes.length > 0 && ` · Evidence: ${task.evidenceTypes.join(', ')}`}
                    </p>
                    {task.acceptanceCriteria && (
                      <p className="mt-1 max-w-2xl text-sm text-muted">{task.acceptanceCriteria}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {task.status === 'NOT_STARTED' && !task.locked && internship.status === 'ACTIVE' && (
                      <Button
                        size="sm"
                        disabled={busy || startingTaskId === task.id}
                        onClick={() => startTask(task)}
                      >
                        {startingTaskId === task.id ? 'Starting…' : 'Start task'}
                      </Button>
                    )}
                    {(task.status === 'IN_PROGRESS' || task.status === 'CHANGES_REQUESTED') &&
                      internship.status === 'ACTIVE' && (
                        <Button size="sm" disabled={busy} onClick={() => setSubmitTask(task)}>
                          {task.status === 'CHANGES_REQUESTED' ? 'Resubmit work' : 'Submit work'}
                        </Button>
                      )}
                  </div>
                </div>

                {(task.submissions?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg bg-surface-subtle p-3">
                    {task.submissions!.map((submission) => (
                      <div key={submission.id} className="text-sm">
                        <p className="font-medium text-ink">
                          Version {submission.versionNumber} ·{' '}
                          {formatDate(submission.submittedAt)}
                          {submission.review ? (
                            <span
                              className={
                                submission.review.decision === 'APPROVED'
                                  ? 'ml-2 text-success-text'
                                  : 'ml-2 text-danger-solid'
                              }
                            >
                              {submission.review.decision === 'APPROVED'
                                ? 'Approved'
                                : 'Changes requested'}
                            </span>
                          ) : (
                            <span className="ml-2 text-muted">Awaiting review</span>
                          )}
                        </p>
                        {submission.review && (
                          <p className="mt-0.5 text-secondary">
                            Mentor feedback: {submission.review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {(milestone.tasks ?? []).length === 0 && (
              <div className="px-5 py-4 text-sm text-muted">No tasks in this milestone.</div>
            )}
          </div>
        </Panel>
      ))}

      <Panel className="mb-6">
        <h2 className="font-serif text-base font-semibold text-ink">Final evaluation</h2>
        {evaluation ? (
          <div className="mt-3 space-y-1.5 text-sm">
            <p>
              <span className="text-secondary">Final score:</span>{' '}
              <span className="font-semibold text-ink">{evaluation.finalScore.toFixed(2)}</span>
            </p>
            <p>
              <span className="text-secondary">Recommendation:</span>{' '}
              <span className="font-medium text-ink">
                {RECOMMENDATION_LABEL[evaluation.recommendation]}
              </span>
            </p>
            {evaluation.remarks && (
              <p>
                <span className="text-secondary">Remarks:</span> {evaluation.remarks}
              </p>
            )}
            <p className="text-muted">Submitted {formatDate(evaluation.submittedAt)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-secondary">
            {internship.status === 'UNDER_EVALUATION'
              ? 'Your mentor is preparing the final evaluation.'
              : 'The final evaluation appears here once your mentor submits it.'}
          </p>
        )}
      </Panel>

      {(internship.activity?.length ?? 0) > 0 && (
        <Panel className="mb-6">
          <h2 className="font-serif text-base font-semibold text-ink">Recent activity</h2>
          <ul className="mt-3 space-y-2.5">
            {internship.activity!.slice(0, 8).map((event, index) => (
              <li key={`${event.kind}-${event.at}-${index}`} className="text-sm">
                <span className="text-secondary">
                  {event.kind === 'submission' && `Submitted version ${event.versionNumber} of "${event.taskTitle}"`}
                  {event.kind === 'review' && `Mentor reviewed "${event.taskTitle}" — ${(event.decision ?? '').toLowerCase().replace(/_/g, ' ')}`}
                  {event.kind === 'status' && `Internship status: ${(event.decision ?? '').toLowerCase().replace(/_/g, ' ')}`}
                </span>
                <span className="ml-2 text-xs text-muted">{formatDate(event.at)}</span>
                {event.comment && <p className="mt-0.5 text-xs text-muted">{event.comment}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {internship.certificate || internship.certificateAvailable ? (
        <Panel>
          <h2 className="font-serif text-base font-semibold text-ink">Certificate</h2>
          {internship.certificate ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium text-ink">
                  {internship.certificate.certificateNumber}
                </p>
                <p className="text-secondary">
                  {internship.certificate.type === 'COMPLETION' ? 'Completion' : 'Appreciation'}{' '}
                  certificate ·{' '}
                  <StatusBadge
                    tone={
                      (internship.certificate.status as CertificateStatus) === 'VALID'
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {CERTIFICATE_STATUS_LABEL[internship.certificate.status as CertificateStatus]}
                  </StatusBadge>
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  window.open(`/api/backend/api/certificates/${internship.certificate!.id}/download`, '_blank')
                }
              >
                Download PDF
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-secondary">
              Congratulations – your internship is complete. Your certificate is being prepared
              by the InternPath administration and will appear here and under My certificates.
            </p>
          )}
        </Panel>
      ) : null}

      {/* Submit-work dialog */}
      {submitTask && (
        <SubmitWorkDialog
          task={submitTask}
          busy={busy}
          onClose={() => setSubmitTask(null)}
          onSubmit={submitWork}
        />
      )}

      {/* Withdraw confirmation with mandatory reason (FR-083) */}
      <ConfirmDialog
        open={withdrawOpen}
        title="Withdraw from internship"
        description={
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              This records your withdrawal with a reason and cannot be undone.
            </p>
            <Field label="Reason (required)" htmlFor="withdraw-reason">
              <TextArea
                id="withdraw-reason"
                rows={3}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Tell us why you are withdrawing"
              />
            </Field>
            {withdrawReason.trim().length < 5 && (
              <p className="text-xs text-muted">At least 5 characters.</p>
            )}
          </div>
        }
        confirmLabel={busy ? 'Withdrawing…' : 'Withdraw'}
        busy={busy}
        confirmDisabled={withdrawReason.trim().length < 5}
        onConfirm={() => {
          void withdraw();
        }}
        onCancel={() => {
          if (!busy) setWithdrawOpen(false);
        }}
      />
    </>
  );
}

function SubmitWorkDialog({
  task,
  busy,
  onClose,
  onSubmit,
}: {
  task: InternTask;
  busy: boolean;
  onClose: () => void;
  onSubmit: (fields: {
    repositoryUrl?: string;
    commitRef?: string;
    documentUrl?: string;
    liveDemoUrl?: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const needsCode = task.evidenceTypes.includes('CODE');
  const needsDocument = task.evidenceTypes.includes('DOCUMENT');
  const needsDemo = task.evidenceTypes.includes('LIVE_DEMO');

  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [commitRef, setCommitRef] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [liveDemoUrl, setLiveDemoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resubmission = task.status === 'CHANGES_REQUESTED';

  return (
    <ConfirmDialog
      open
      title={resubmission ? `Resubmit work – ${task.title}` : `Submit work – ${task.title}`}
      description={
        <div className="space-y-4">
          {resubmission && (
            <Alert variant="info" title="Resubmission">
              {task.resubmissionsRemaining == null
                ? 'Unlimited resubmissions remain for this task.'
                : `${task.resubmissionsRemaining} resubmission(s) remaining for this task.`}
            </Alert>
          )}
          {needsCode && (
            <>
              <Field label="Repository URL (required)" htmlFor="sub-repo">
                <TextInput
                  id="sub-repo"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  placeholder="https://github.com/you/project"
                />
              </Field>
              <Field label="Commit reference (optional)" htmlFor="sub-commit">
                <TextInput
                  id="sub-commit"
                  value={commitRef}
                  onChange={(e) => setCommitRef(e.target.value)}
                  placeholder="commit SHA or tag"
                />
              </Field>
            </>
          )}
          {needsDocument && (
            <Field label="Document URL (required)" htmlFor="sub-doc">
              <TextInput
                id="sub-doc"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://docs.google.com/…"
              />
            </Field>
          )}
          {needsDemo && (
            <Field label="Live demo URL (required)" htmlFor="sub-demo">
              <TextInput
                id="sub-demo"
                value={liveDemoUrl}
                onChange={(e) => setLiveDemoUrl(e.target.value)}
                placeholder="https://your-demo.example"
              />
            </Field>
          )}
          <Field label="Notes for the mentor (optional)" htmlFor="sub-notes">
            <TextArea
              id="sub-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <Checkbox
            checked={declared}
            onChange={(e) => setDeclared(e.target.checked)}
            id="originality-declared"
            label="I declare this work is my own original work (required)"
          />
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      }
      confirmLabel={busy ? 'Submitting…' : 'Submit'}
      onConfirm={() => {
        if (!declared) {
          setError('You must declare the work as your own original work.');
          return;
        }
        if (needsCode && !repositoryUrl.trim()) {
          setError('A repository URL is required for this task.');
          return;
        }
        if (needsDocument && !documentUrl.trim()) {
          setError('A document URL is required for this task.');
          return;
        }
        if (needsDemo && !liveDemoUrl.trim()) {
          setError('A live demo URL is required for this task.');
          return;
        }
        setError(null);
        void onSubmit({
          repositoryUrl: needsCode ? repositoryUrl.trim() : undefined,
          commitRef: commitRef.trim() || undefined,
          documentUrl: needsDocument ? documentUrl.trim() : undefined,
          liveDemoUrl: needsDemo ? liveDemoUrl.trim() : undefined,
          notes: notes.trim() || undefined,
        }).catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'The submission could not be recorded')
        );
      }}
      onCancel={() => {
        if (!busy) onClose();
      }}
    />
  );
}
