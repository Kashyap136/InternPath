'use client';

// Admin: domain-scoped question bank (SRS FR-CAND-022, DEC-008).
// Each question is tagged with exactly one skill of its domain and stores its
// answer key server-side. The list endpoint returns questions WITHOUT
// grading internals beyond what administrators manage (correctOption is
// admin-managed data and stays out of student surfaces — BE-02).

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import type { AssessmentQuestion, Domain, Skill } from '@/types';

const OPTION_COUNT = 3;

function AdminQuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const domainId = searchParams.get('domainId') ?? '';

  const domains = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/admin/domains').then((r) => r.data)
  );

  const questions = useApiLoad<AssessmentQuestion[]>(
    () =>
      domainId
        ? api
            .get<{ data: AssessmentQuestion[] }>(
              `/api/admin/domains/${encodeURIComponent(domainId)}/questions`
            )
            .then((r) => r.data)
        : Promise.resolve([]),
    [domainId]
  );

  const [text, setText] = useState('');
  const [skillId, setSkillId] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '']);
  const [correctOption, setCorrectOption] = useState('0');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AssessmentQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const skills = (domains.data ?? []).find((d): d is Domain & { skills: Skill[] } => d.id === domainId)?.skills;

  const createQuestion = async () => {
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const trimmed = options.map((o) => o.trim());
      // Phase 7 audit fix: filtering out empty options re-indexes the array and
      // silently corrupts the recorded answer key (correctOption keeps its
      // original index). Require every option to be filled instead.
      if (trimmed.some((o) => o.length === 0)) {
        setCreateError('Every option must be filled in — empty options cannot be skipped.');
        return;
      }
      await api.post(`/api/admin/domains/${encodeURIComponent(domainId)}/questions`, {
        text: text.trim(),
        options: trimmed,
        correctOption: Number(correctOption),
        skillId: skillId || undefined,
      });
      setText('');
      setOptions(['', '', '']);
      setCreateSuccess('Question added to the bank.');
      questions.reload();
    } catch (err) {
      setCreateError(apiErrorMessage(parseApiError(err), 'Cannot create the question.'));
    } finally {
      setCreating(false);
    }
  };

  const deleteQuestion = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    setRowError(null);
    try {
      await api.delete(`/api/admin/questions/${pendingDelete.id}`);
      setPendingDelete(null);
      questions.reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setRowError(
        parsed.formError ?? (err instanceof Error ? err.message : 'Cannot delete the question.')
      );
    } finally {
      setBusy(false);
    }
  };

  const activeDomain = (domains.data ?? []).find((d) => d.id === domainId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question bank"
        subtitle="Domain-scoped assessment questions. Every question is tagged with exactly one skill."
        actions={
          <Link href="/admin/domains" className="text-sm text-muted underline-offset-2 hover:underline">
            ← Domains
          </Link>
        }
      />

      <Panel title="Choose a domain">
        <Field label="Domain" htmlFor="q-domain">
          <Select
            id="q-domain"
            value={domainId}
            onChange={(e) => {
              const next = e.target.value;
              router.replace(next ? `/admin/questions?domainId=${encodeURIComponent(next)}` : '/admin/questions');
            }}
          >
            <option value="">Select a domain…</option>
            {(domains.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.isActive ? '' : ' (deactivated)'}
              </option>
            ))}
          </Select>
        </Field>
        <Alert variant="info" title="Note">
          Questions are loaded per domain; switching domains above reloads the list. Questions can only
          be added while the domain has at least one skill.
        </Alert>
      </Panel>

      {domainId && activeDomain ? (
        <>
          <Panel
            title={`Add a question — ${activeDomain.name}`}
            subtitle="Provide the options and mark which option is correct. Students never see the key."
          >
            {createSuccess ? (
              <Alert variant="success" title="Added">
                {createSuccess}
              </Alert>
            ) : null}
            {createError ? (
              <Alert variant="error" title="Cannot create">
                {createError}
              </Alert>
            ) : null}
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void createQuestion();
              }}
              noValidate
            >
              <Field label="Question text" htmlFor="q-text">
                <TextArea
                  id="q-text"
                  value={text}
                  rows={3}
                  maxLength={1000}
                  onChange={(e) => setText(e.target.value)}
                  required
                />
              </Field>
              <Field label="Skill" htmlFor="q-skill" hint="Exactly one skill per question.">
                <Select id="q-skill" value={skillId} onChange={(e) => setSkillId(e.target.value)}>
                  <option value="">Unassigned (optional)</option>
                  {(skills ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                {options.map((option, index) => (
                  <Field key={`opt-${index}`} label={`Option ${index + 1}`} htmlFor={`q-opt-${index}`}>
                    <input
                      id={`q-opt-${index}`}
                      className="w-full rounded-lg border border-neutral-border px-3 py-2 text-sm"
                      value={option}
                      maxLength={200}
                      onChange={(e) =>
                        setOptions((prev) => prev.map((p, i) => (i === index ? e.target.value : p)))
                      }
                      required={index < OPTION_COUNT}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Correct option" htmlFor="q-correct">
                <Select
                  id="q-correct"
                  value={correctOption}
                  onChange={(e) => setCorrectOption(e.target.value)}
                >
                  {options.map((option, index) => (
                    <option key={`cr-${index}`} value={String(index)} disabled={option.trim().length === 0}>
                      Option {index + 1}: {option || '(empty)'}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Saving…' : 'Add question'}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel title={`Questions (${(questions.data ?? []).length})`}>
            {rowError ? (
              <Alert variant="error" title="Action failed">
                {rowError}
              </Alert>
            ) : null}
            {questions.loading ? (
              <LoadingState label="Loading questions…" />
            ) : questions.error ? (
              <ErrorState message={questions.error} onRetry={questions.reload} />
            ) : (questions.data ?? []).length === 0 ? (
              <EmptyState
                bordered={false}
                title="No questions yet"
                description="Add the first question above. Assessments need active questions to start."
              />
            ) : (
              <ul className="divide-y divide-neutral-border">
                {(questions.data ?? []).map((question, index) => (
                  <li key={question.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">
                        {index + 1}. {question.text}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {question.skill ? <span>Skill: {question.skill.name}</span> : <span>No skill</span>}
                        <StatusBadge tone={question.isActive ? 'success' : 'neutral'}>
                          {question.isActive ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => setPendingDelete(question)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this question?"
        description="Deletion is permanent for the question bank. Assessments that already used it keep their recorded answers."
        confirmLabel="Delete question"
        confirmVariant="danger"
        busy={busy}
        onConfirm={() => void deleteQuestion()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default function AdminQuestionsPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading question bank…" />}>
      <AdminQuestionsContent />
    </Suspense>
  );
}