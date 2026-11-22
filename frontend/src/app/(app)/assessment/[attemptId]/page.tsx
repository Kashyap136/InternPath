'use client';

// Assessment attempt runner (SRS FR-CAND-023/024/025).
//
// Safety rules reflected here:
//  - The answer payload is ONLY `{ questionId, selectedOption }` — grading
//    happens server-side and no correctness data is ever displayed before
//    submission (BE-02; NFR-DRV-001).
//  - The deadline displayed is the server-provided `deadlineAt`; the server
//    independently rejects late answers and late submissions (BE-03), so a
//    countdown hit zero and a rejected call both lead to the same outcome
//    ("time expired" UI state).
//  - Submitting is a final, non-repeatable action → ConfirmDialog guard.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Alert,
  Button,
  ErrorState,
  LoadingState,
  Panel,
  ProgressBar,
  StatusBadge,
  ConfirmDialog,
  PageHeader,
} from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDateTime } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import {
  assessmentSecondsRemaining,
  formatCountdown,
} from '@/lib/status';
import type { AssessmentResultLevel } from '@/types';

interface AttemptDetail {
  attempt: {
    id: string;
    domainId: string;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
    perSkillScores: Record<string, number> | null;
    resultLevel: AssessmentResultLevel | null;
    timeRemainingMs?: number;
    isExpired?: boolean;
    /** Projected own selections for UI rehydration (never correctness data). */
    answers?: Array<{ questionId: string; selectedOption: number }>;
  };
  questions: Array<{ id: string; text: string; options: string[]; skillId: string; skill?: { name: string } }>;
  timeLimitMinutes?: number;
}

interface AttemptStats {
  answered: Map<string, number>;
}

const LEVEL_LABEL: Record<AssessmentResultLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  NOT_ELIGIBLE: 'Not eligible',
};

export default function AttemptRunnerPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = typeof params?.attemptId === 'string' ? params.attemptId : '';
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';

  const { data, error, loading, reload } = useApiLoad<AttemptDetail | null>(
    () =>
      isStudent
        ? api
            .get<{ data: AttemptDetail | null }>(
              `/api/assessment/attempt/${encodeURIComponent(attemptId)}`
            )
            .then((r) => r.data)
        : Promise.resolve(null),
    [isStudent, attemptId]
  );

  const [selections, setSelections] = useState<AttemptStats>({ answered: new Map() });
  const [rehydrated, setRehydrated] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Rehydrate recorded selections the first time the server responds
  // (server-authoritative — local optimistic state only overlays it).
  useEffect(() => {
    if (!data || rehydrated || !data.attempt.answers) return;
    setSelections({ answered: new Map(data.attempt.answers.map((a) => [a.questionId, a.selectedOption])) });
    setRehydrated(true);
  }, [data, rehydrated]);

  // Countdown: 1s tick only while an unsubmitted attempt is on screen.
  useEffect(() => {
    if (!data || data.attempt.submittedAt) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [data]);

  const secondsLeft = useMemo(
    () => (data ? assessmentSecondsRemaining(data.attempt.deadlineAt, now) : 0),
    [data, now]
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post<{ data: AttemptDetail['attempt'] }>(
        `/api/assessment/attempt/${encodeURIComponent(attemptId)}/submit`,
        {}
      );
      setConfirmingSubmit(false);
      setSubmitting(false);
      // Refetch to render the server-authoritative result view.
      void reload();
      return res;
    } catch (err) {
      setSubmitting(false);
      setConfirmingSubmit(false);
      setSubmitError(apiErrorMessage(parseApiError(err), 'Cannot submit the assessment.'));
    }
  }, [attemptId, reload]);

  const saveAnswer = useCallback(
    async (questionId: string, selectedOption: number) => {
      setSavingQuestionId(questionId);
      setSaveError(null);
      const previous = selections.answered;
      setSelections((s) => {
        const next = new Map(s.answered);
        next.set(questionId, selectedOption);
        return { answered: next };
      });
      try {
        await api.post(`/api/assessment/attempt/${encodeURIComponent(attemptId)}/answer`, {
          questionId,
          selectedOption,
        });
      } catch (err) {
        // Roll back the optimistic selection only on authoritative rejection
        // (e.g. ASSESSMENT_EXPIRED); a network error keeps the selection and
        // surfaces a message so the student can retry before submitting.
        const message = err instanceof Error ? err.message : '';
        if (/expired|ASSESSMENT_EXPIRED/i.test(message)) {
          setSelections({ answered: new Map(previous) });
        }
        setSaveError(apiErrorMessage(parseApiError(err), 'Could not save this answer.'));
      } finally {
        setSavingQuestionId(null);
      }
    },
    [attemptId, selections]
  );

  if (user && !isStudent) {
    return (
      <Panel>
        <p className="text-sm text-secondary">
          Assessment attempts belong to student accounts. Mentor and
          administrator accounts are not assessed.
        </p>
      </Panel>
    );
  }

  if (loading) return <LoadingState label="Loading attempt…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { attempt, questions } = data;
  const answeredCount = questions.filter((q) => selections.answered.has(q.id)).length;

  // Server does not persist the limit; derive from startedAt/deadlineAt.
  const limitMinutes = Math.max(
    1,
    Math.round(
      (new Date(attempt.deadlineAt).getTime() - new Date(attempt.startedAt).getTime()) / 60000
    )
  );

  if (attempt.submittedAt) {
    // Result view — the approved disclosures only (FR-CAND-025):
    // per-skill scores and the overall level. No per-answer keys.
    const skillNames = new Map<string, string>();
    for (const q of questions) skillNames.set(q.skillId, q.skill?.name ?? 'Skill');
    return (
      <div className="space-y-6">
        <PageHeader
          title="Assessment result"
          subtitle="Recorded at submission. Per-skill scores feed program eligibility."
          actions={
            <Link
              href="/assessment"
              className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
            >
              ← Back to assessment
            </Link>
          }
        />
        <Panel title="Overall result">
          <StatusBadge tone={attempt.resultLevel === 'NOT_ELIGIBLE' ? 'neutral' : 'success'}>
            {attempt.resultLevel ? LEVEL_LABEL[attempt.resultLevel] : 'Pending'}
          </StatusBadge>
          <p className="mt-2 text-sm text-muted">
            Submitted {formatDateTime(attempt.submittedAt)}.
          </p>
        </Panel>
        {attempt.perSkillScores && Object.keys(attempt.perSkillScores).length > 0 ? (
          <Panel title="Per-skill scores">
            <ul className="space-y-3">
              {Object.entries(attempt.perSkillScores).map(([skillId, score]) => (
                <li key={skillId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      {skillNames.get(skillId) ?? 'Retired skill'}
                    </span>
                    <span className="text-muted">{score} / 10</span>
                  </div>
                  <ProgressBar value={Math.max(0, Math.min(100, score * 10))} className="mt-1" />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    );
  }

  if (secondsLeft === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Time expired" />
        <Alert variant="warning" title="Attempt closed">
          The assessment deadline has passed. This attempt stays unsubmitted; you can start a fresh
          attempt when the retake interval allows it.
        </Alert>
        <div className="flex gap-3">
          <Link href="/assessment" className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline">
            ← Back to assessment
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <Link href="/assessment" className="text-sm text-muted underline-offset-2 hover:underline">
            ← Back to assessment
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-ink">Attempt in progress</h1>
          <p className="text-sm text-muted">
            {answeredCount} of {questions.length} questions answered · time limit {limitMinutes}{' '}
            minutes
          </p>
        </div>
        <div
          className="rounded-lg border border-neutral-border bg-surface-subtle px-4 py-2 text-right"
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
        >
          <span className="block text-xs text-muted">Time remaining</span>
          <span className={`text-xl font-semibold ${secondsLeft <= 60 ? 'text-danger-text' : 'text-ink'}`}>
            {formatCountdown(secondsLeft)}
          </span>
        </div>
      </div>

      <ProgressBar
        value={questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}
        label="Questions answered"
        valueText={`${answeredCount} of ${questions.length}`}
      />

      {saveError ? (
        <Alert variant="warning" title="Answer not saved">
          {saveError}
        </Alert>
      ) : null}
      {submitError ? (
        <Alert variant="error" title="Submission failed">
          {submitError}
        </Alert>
      ) : null}

      <div className="space-y-4">
        {questions.map((question, index) => {
          const selected = selections.answered.get(question.id);
          return (
            <Panel key={question.id}>
              <fieldset className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <legend className="font-medium text-ink">
                    {index + 1}. {question.text}
                    {question.skill ? (
                      <span className="ml-2 text-xs text-muted">({question.skill.name})</span>
                    ) : null}
                  </legend>
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-[10px] font-bold text-secondary">
                    {index + 1}
                  </span>
                </div>
                <div className="mt-2 grid gap-2">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={`${question.id}-${optionIndex}`}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors focus-within:outline-hidden focus-within:ring-2 focus-within:ring-primary-500 ${
                        selected === optionIndex
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-neutral-border hover:border-primary-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optionIndex}
                        checked={selected === optionIndex}
                        onChange={() => void saveAnswer(question.id, optionIndex)}
                        className="h-4 w-4 text-primary-600 focus-visible:outline-hidden"
                        disabled={savingQuestionId === question.id && selected === undefined}
                        aria-label={option}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </Panel>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => setConfirmingSubmit(true)}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit assessment'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingSubmit}
        title="Submit assessment?"
        description="Submission is final. You cannot change answers afterwards, and per-skill scores are calculated immediately."
        confirmLabel={submitting ? 'Submitting…' : 'Submit final answers'}
        confirmVariant="primary"
        busy={submitting}
        onConfirm={() => void submit()}
        onCancel={() => setConfirmingSubmit(false)}
      />
    </div>
  );
}
