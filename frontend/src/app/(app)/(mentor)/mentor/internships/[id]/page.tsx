'use client';

// Mentor internship detail (Sprint 4 — FR-CAND-059/067-074): review task
// instances (approve / request changes with mandatory feedback), adjust due
// dates with a reason, and submit the final evaluation while
// UNDER_EVALUATION. The internship is 404-guarded server-side to assignment.

import { use, useState } from 'react';
import {
  Alert,
  Button,
  ConfirmDialog,
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
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate, formatDateTime } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import {
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE as INTERNSHIP_TONE,
  RECOMMENDATION_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TONE as TASK_TONE,
} from '@/lib/status';
import type { Internship, InternTask, RubricCriterion } from '@/types';

export default function MentorInternshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, loading, reload } = useApiLoad<Internship>(() =>
    api.get<{ data: Internship }>(`/api/mentor/internships/${id}`).then((r) => r.data)
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [reviewTask, setReviewTask] = useState<InternTask | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED'>('APPROVED');
  const [reviewComment, setReviewComment] = useState('');
  const [dueDateTask, setDueDateTask] = useState<InternTask | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [dueDateReason, setDueDateReason] = useState('');
  // P2-10 (comprehensive audit 2026-11-15): "reopen approved task" existed
  // only in the API — expose it in the mentor workspace with a mandatory,
  // audited reason.
  const [reopenTask, setReopenTask] = useState<InternTask | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<
    'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE'
  >('COMPLETE');
  const [remarks, setRemarks] = useState('');

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setActionError(null);
    setActionMessage(null);
    setBusy(true);
    try {
      await action();
      setActionMessage(successMessage);
      reload();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The action could not be completed');
    } finally {
      setBusy(false);
    }
  }

  async function decide() {
    if (!reviewTask) return;
    await runAction(
      () =>
        api.post(`/api/mentor/tasks/${reviewTask.id}/review`, {
          decision: reviewDecision,
          comment: reviewComment.trim(),
        }),
      reviewDecision === 'APPROVED'
        ? 'Submission approved'
        : 'Changes requested — the intern has been notified'
    );
    setReviewTask(null);
    setReviewComment('');
  }

  async function changeDueDate() {
    if (!dueDateTask) return;
    await runAction(
      () =>
        api.post(`/api/mentor/tasks/${dueDateTask.id}/due-date`, {
          dueDate: new Date(newDueDate).toISOString(),
          reason: dueDateReason.trim(),
        }),
      'Due date updated'
    );
    setDueDateTask(null);
  }

  async function submitEvaluation() {
    const criterionScores = Object.entries(scores).map(([criterionId, value]) => ({
      criterionId,
      score: Number(value),
    }));
    await runAction(
      () =>
        api.post(`/api/mentor/internships/${id}/evaluation`, {
          criterionScores,
          recommendation,
          remarks: remarks.trim() || undefined,
        }),
      'Final evaluation submitted — administrators have been notified'
    );
    setEvaluationOpen(false);
  }

  if (loading) return <LoadingState label="Loading internship…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const internship = data;
  const canReview = internship.status === 'ACTIVE';
  // Reopen is legal while the internship is ACTIVE or UNDER_EVALUATION
  // (backend guarded; demotes UNDER_EVALUATION back to ACTIVE and
  // invalidates any submitted evaluation — P1-05).
  const canManage = ['ACTIVE', 'UNDER_EVALUATION'].includes(internship.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={internship.program?.title ?? 'Internship'}
        subtitle={`${internship.intern ? `Intern: ${internship.intern.fullName} · ` : ''}${formatDate(
          internship.startDate
        )} – ${formatDate(internship.endDate)}${internship.project ? ` · ${internship.project.title}` : ''}`}
        actions={
          <StatusBadge tone={INTERNSHIP_TONE[internship.status]}>
            {INTERNSHIP_STATUS_LABEL[internship.status]}
          </StatusBadge>
        }
      />

      {actionError && (
        <Alert variant="error" title="Action failed">{actionError}</Alert>
      )}
      {actionMessage && (
        <Alert variant="success" title="Done">{actionMessage}</Alert>
      )}

      {internship.status === 'UNDER_EVALUATION' && (
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-base font-semibold text-ink">Final evaluation</h2>
              {internship.evaluation ? (
                <p className="mt-1 text-sm text-secondary">
                  Submitted {formatDateTime(internship.evaluation.submittedAt)} · score{' '}
                  {internship.evaluation.finalScore.toFixed(2)} ·{' '}
                  {RECOMMENDATION_LABEL[internship.evaluation.recommendation]}
                </p>
              ) : (
                <p className="mt-1 text-sm text-secondary">
                  All mandatory tasks are approved. Submit the final evaluation to move this
                  internship towards completion.
                </p>
              )}
            </div>
            {!internship.evaluation && (
              <Button size="sm" onClick={() => setEvaluationOpen(true)}>
                Submit evaluation
              </Button>
            )}
          </div>
        </Panel>
      )}

      {(!internship.milestones || internship.milestones.length === 0) && (
        <Panel>
          <p className="text-sm text-secondary">
            No task instances yet — a project has not been assigned to this internship.
          </p>
        </Panel>
      )}

      {internship.milestones?.map((milestone) => (
        <Panel key={milestone.id} padded={false}>
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="font-serif text-base font-semibold text-ink">{milestone.title}</h2>
          </div>
          <div className="divide-y divide-line">
            {(milestone.tasks ?? []).map((task) => {
              const hasPendingSubmission =
                ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(task.status) &&
                (task.submissions?.length ?? 0) > 0;
              const latest = task.submissions?.[0];
              return (
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
                      </div>
                      <p className="mt-1 text-sm text-secondary">Due {formatDate(task.dueDate)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {canReview && hasPendingSubmission && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setReviewTask(task);
                            setReviewDecision('APPROVED');
                            setReviewComment('');
                          }}
                        >
                          Review submission
                        </Button>
                      )}
                      {canManage && task.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReopenTask(task);
                            setReopenReason('');
                          }}
                        >
                          Reopen task
                        </Button>
                      )}
                      {canReview && task.status !== 'APPROVED' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setDueDateTask(task);
                            setNewDueDate(task.dueDate.slice(0, 10));
                            setDueDateReason('');
                          }}
                        >
                          Change due date
                        </Button>
                      )}
                    </div>
                  </div>

                  {latest && (
                    <div className="mt-3 rounded-lg bg-surface-subtle p-3 text-sm">
                      <p className="font-medium text-ink">
                        Latest submission: version {latest.versionNumber} ·{' '}
                        {formatDateTime(latest.submittedAt)}
                      </p>
                      {latest.repositoryUrl && (
                        <p className="mt-0.5 break-all text-secondary">
                          Repository: {latest.repositoryUrl}
                        </p>
                      )}
                      {latest.documentUrl && (
                        <p className="mt-0.5 break-all text-secondary">Document: {latest.documentUrl}</p>
                      )}
                      {latest.liveDemoUrl && (
                        <p className="mt-0.5 break-all text-secondary">Live demo: {latest.liveDemoUrl}</p>
                      )}
                      {latest.notes && <p className="mt-0.5 text-secondary">Notes: {latest.notes}</p>}
                      {latest.review && (
                        <p className="mt-1 text-secondary">
                          Previous decision:{' '}
                          {latest.review.decision === 'APPROVED' ? 'approved' : 'changes requested'} —{' '}
                          {latest.review.comment}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ))}

      {/* Review decision dialog (FR-068/069) */}
      {reviewTask && (
        <ConfirmDialog
          open
          title={`Review — ${reviewTask.title}`}
          confirmLabel={busy ? 'Saving…' : 'Record decision'}
          busy={busy}
          onConfirm={() => {
            if (reviewComment.trim().length >= 5) void decide();
          }}
          onCancel={() => {
            if (!busy) setReviewTask(null);
          }}
        >
          <div className="space-y-4">
            <Field label="Decision" htmlFor="review-decision">
              <Select
                id="review-decision"
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as 'APPROVED' | 'CHANGES_REQUESTED')}
              >
                <option value="APPROVED">Approve submission</option>
                <option value="CHANGES_REQUESTED">Request changes</option>
              </Select>
            </Field>
            <Field
              label={reviewDecision === 'CHANGES_REQUESTED' ? 'Feedback (required)' : 'Feedback'}
              htmlFor="review-comment"
              hint={
                reviewDecision === 'CHANGES_REQUESTED'
                  ? 'Explain what needs to change — the intern sees this verbatim.'
                  : 'Optional appreciation or notes for the intern.'
              }
            >
              <TextArea
                id="review-comment"
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </Field>
            {reviewComment.trim().length < 5 && (
              <p className="text-xs text-muted">At least 5 characters.</p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {/* Reopen dialog (P2-10 — FR-CAND-074/Phase 12 §3.3) */}
      {reopenTask && (
        <ConfirmDialog
          open
          title={`Reopen "${reopenTask.title}"?`}
          description="The task returns to CHANGES_REQUESTED and the intern is notified. If the internship was UNDER_EVALUATION it returns to ACTIVE and any submitted evaluation is invalidated — a fresh evaluation is required after the reworked work is approved. The reason is recorded in the audit log."
          confirmLabel={busy ? 'Reopening…' : 'Reopen task'}
          confirmVariant="secondary"
          busy={busy}
          confirmDisabled={reopenReason.trim().length < 5}
          onConfirm={() => {
            void runAction(
              () =>
                api.post(`/api/mentor/tasks/${reopenTask.id}/reopen`, {
                  reason: reopenReason.trim(),
                }),
              'Task reopened — the intern has been notified'
            );
            setReopenTask(null);
          }}
          onCancel={() => {
            if (!busy) setReopenTask(null);
          }}
        >
          <Field label="Justification (required)" htmlFor="reopen-reason" hint="At least 5 characters.">
            <TextArea
              id="reopen-reason"
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Why does this task need rework?"
            />
          </Field>
        </ConfirmDialog>
      )}

      {/* Due-date dialog (FR-059) */}
      {dueDateTask && (
        <ConfirmDialog
          open
          title={`Change due date — ${dueDateTask.title}`}
          confirmLabel={busy ? 'Saving…' : 'Update due date'}
          confirmVariant="secondary"
          busy={busy}
          onConfirm={() => {
            if (newDueDate && dueDateReason.trim().length >= 5) void changeDueDate();
          }}
          onCancel={() => {
            if (!busy) setDueDateTask(null);
          }}
        >
          <div className="space-y-4">
            <Field label="New due date" htmlFor="due-date">
              <TextInput
                id="due-date"
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </Field>
            <Field label="Reason (required)" htmlFor="due-date-reason">
              <TextArea
                id="due-date-reason"
                rows={2}
                value={dueDateReason}
                onChange={(e) => setDueDateReason(e.target.value)}
              />
            </Field>
            {dueDateReason.trim().length < 5 && (
              <p className="text-xs text-muted">At least 5 characters.</p>
            )}
          </div>
        </ConfirmDialog>
      )}

      {/* Final evaluation dialog (FR-074) */}
      {evaluationOpen && (
        <ConfirmDialog
          open
          title="Submit final evaluation"
          confirmLabel={busy ? 'Submitting…' : 'Submit evaluation'}
          busy={busy}
          onConfirm={() => void submitEvaluation()}
          onCancel={() => {
            if (!busy) setEvaluationOpen(false);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              Score every criterion from 0 to 10. The weighted final score is calculated from the
              rubric frozen on this internship (version {internship.rubricVersion}).
            </p>
            <RubricScoreInputs
              criteria={internship.rubric?.criteria ?? []}
              scores={scores}
              onChange={(criterionId, value) => setScores((prev) => ({ ...prev, [criterionId]: value }))}
            />
            <Field label="Recommendation" htmlFor="eval-recommendation">
              <Select
                id="eval-recommendation"
                value={recommendation}
                onChange={(e) =>
                  setRecommendation(
                    e.target.value as 'COMPLETE' | 'COMPLETE_WITH_APPRECIATION' | 'NOT_COMPLETE'
                  )
                }
              >
                <option value="COMPLETE">{RECOMMENDATION_LABEL.COMPLETE}</option>
                <option value="COMPLETE_WITH_APPRECIATION">
                  {RECOMMENDATION_LABEL.COMPLETE_WITH_APPRECIATION}
                </option>
                <option value="NOT_COMPLETE">{RECOMMENDATION_LABEL.NOT_COMPLETE}</option>
              </Select>
            </Field>
            <Field label="Remarks (optional)" htmlFor="eval-remarks">
              <TextArea
                id="eval-remarks"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </Field>
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}

/**
 * Rubric scoring inputs for the FINAL evaluation dialog. Phase 12 fix for
 * Phase 11 finding F-05: the criteria come from the internship's FROZEN
 * rubric version (served with the mentor internship detail), never from the
 * platform's currently active rubric.
 */
function RubricScoreInputs({
  criteria,
  scores,
  onChange,
}: {
  criteria: RubricCriterion[];
  scores: Record<string, string>;
  onChange: (criterionId: string, value: string) => void;
}) {
  if (criteria.length === 0) {
    return <Alert variant="error">The frozen rubric has no criteria — contact an administrator.</Alert>;
  }

  return (
    <div className="space-y-3">
      {criteria.map((criterion) => (
        <div key={criterion.id} className="flex items-center justify-between gap-4">
          <label htmlFor={`score-${criterion.id}`} className="text-sm text-body">
            {criterion.name} <span className="text-muted">(weight {criterion.weight})</span>
          </label>
          <TextInput
            id={`score-${criterion.id}`}
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={scores[criterion.id] ?? ''}
            onChange={(e) => onChange(criterion.id, e.target.value)}
            className="w-24"
          />
        </div>
      ))}
    </div>
  );
}
