'use client';

// My projects (Sprint 3 — FR-CAND-037-041): the mentor/admin authoring
// workspace. Draft creation, milestone/task authoring with prerequisites
// (cycle-rejected server-side per FR-055) and submission for review.

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
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import { DIFFICULTY_LABEL, PROJECT_SOURCE_LABEL, PROJECT_STATUS_LABEL } from '@/lib/status';
import type { Domain, Project, ProjectSourceType } from '@/types';

const STATUS_TONE = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
} as const;

type Dialog =
  | { kind: 'create-draft' }
  | { kind: 'milestone'; projectId: string }
  | { kind: 'task'; projectId: string; milestoneId: string }
  | { kind: 'dependency'; projectId: string; milestoneId: string; taskId: string; taskTitle: string }
  | null;

export default function MentorProjectsPage() {
  const { data, error, loading, reload } = useApiLoad<Project[]>(() =>
    api.get<{ data: Project[] }>('/api/projects?mine=true&limit=50').then((r) => r.data)
  );
  const { data: domains } = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/domains?limit=100').then((r) => r.data)
  );

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Page-level error for actions launched outside a dialog (submit for
  // review, draft deletions): without it a failed request would be invisible.
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'milestone' | 'task';
    projectId: string;
    milestoneId: string;
    taskId?: string;
    title: string;
  } | null>(null);

  // Draft form state
  const [title, setTitle] = useState('');
  const [sourceType, setSourceType] = useState<ProjectSourceType>('MENTOR_CREATED');
  const [domainId, setDomainId] = useState('');
  const [difficulty, setDifficulty] = useState<'BEGINNER' | 'INTERMEDIATE'>('BEGINNER');
  const [durationWeeks, setDurationWeeks] = useState('6');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [objectives, setObjectives] = useState('');
  const [requirements, setRequirements] = useState('');
  const [expectedDeliverables, setExpectedDeliverables] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [submissionGuidelines, setSubmissionGuidelines] = useState('');

  // Milestone/task forms
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneOrder, setMilestoneOrder] = useState('1');
  const [milestoneRequired, setMilestoneRequired] = useState(true);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCriteria, setTaskCriteria] = useState('');
  const [taskMandatory, setTaskMandatory] = useState(true);
  const [taskEvidence, setTaskEvidence] = useState('CODE');
  const [taskDueOffset, setTaskDueOffset] = useState('7');
  const [taskOrder, setTaskOrder] = useState('1');
  const [prerequisiteTaskId, setPrerequisiteTaskId] = useState('');

  async function run(action: () => Promise<unknown>, closeDialog = true) {
    setFormError(null);
    setActionError(null);
    setBusy(true);
    try {
      await action();
      if (closeDialog) setDialog(null);
      reload();
      return true;
    } catch (err) {
      const message = apiErrorMessage(parseApiError(err), 'The action could not be completed.');
      if (closeDialog) setFormError(message);
      else setActionError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    const ok = await run(() =>
      api.post('/api/projects', {
        title: title.trim(),
        sourceType,
        domainId,
        difficulty,
        durationWeeks: Number(durationWeeks),
        requiredSkills: requiredSkills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        problemStatement: problemStatement.trim(),
        objectives: objectives.trim(),
        requirements: requirements.trim(),
        expectedDeliverables: expectedDeliverables.trim(),
        evaluationCriteria: evaluationCriteria.trim(),
        submissionGuidelines: submissionGuidelines.trim(),
      })
    );
    if (ok) {
      setTitle('');
      setProblemStatement('');
      setObjectives('');
      setRequirements('');
      setExpectedDeliverables('');
      setEvaluationCriteria('');
      setSubmissionGuidelines('');
      setRequiredSkills('');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My projects"
        subtitle="Author project drafts, structure them with milestones and tasks, then submit them for administrator review (FR-CAND-037-041)."
        actions={
          <Button size="sm" onClick={() => setDialog({ kind: 'create-draft' })}>
            New project draft
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}
      {actionError && (
        <Alert variant="error" title="Action failed">
          {actionError}
        </Alert>
      )}
      {loading && <LoadingState label="Loading your projects…" />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState
            title="No project drafts yet"
            description="Create your first project draft. It stays private until you submit it for review and an administrator publishes it."
          />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((project) => (
            <Panel key={project.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-serif text-base font-semibold text-ink">{project.title}</h2>
                    <StatusBadge tone={STATUS_TONE[project.status]}>
                      {PROJECT_STATUS_LABEL[project.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {project.domain ? `${project.domain.name} · ` : ''}
                    {DIFFICULTY_LABEL[project.difficulty]} ·{' '}
                    {project.durationWeeks} weeks ·{' '}
                    {PROJECT_SOURCE_LABEL[project.sourceType]}
                  </p>
                  {project.reviewComments && (
                    <p className="mt-1.5 max-w-2xl rounded-lg bg-surface-subtle px-3 py-2 text-sm text-body">
                      Reviewer: {project.reviewComments}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {project.status === 'DRAFT' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ kind: 'milestone', projectId: project.id })}
                      >
                        Add milestone
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          void run(() => api.post(`/api/projects/${project.id}/submit`, {}), false)
                        }
                      >
                        Submit for review
                      </Button>
                    </>
                  )}
                  {project.status === 'APPROVED' && (
                    <StatusBadge tone="success" dot={false}>
                      Approved — an administrator can publish it
                    </StatusBadge>
                  )}
                </div>
              </div>

              {/* Draft structure with authoring controls */}
              {project.status === 'DRAFT' && (
                <div className="mt-4 space-y-3 rounded-lg bg-surface-subtle p-4">
                  {(project.milestones ?? []).length === 0 && (
                    <p className="text-sm text-muted">
                      No milestones yet — add at least one milestone with one task before
                      submitting for review.
                    </p>
                  )}
                  {(project.milestones ?? []).map((milestone) => (
                    <div key={milestone.id} className="rounded-lg border border-line bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {milestone.order}. {milestone.title}{' '}
                          <span className="text-xs font-normal text-muted">
                            ({milestone.isRequired ? 'required' : 'optional'})
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setDialog({
                                kind: 'task',
                                projectId: project.id,
                                milestoneId: milestone.id,
                              })
                            }
                          >
                            Add task
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setConfirmDelete({
                                kind: 'milestone',
                                projectId: project.id,
                                milestoneId: milestone.id,
                                title: milestone.title,
                              })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1.5">
                        {(milestone.tasks ?? []).map((task) => (
                          <li
                            key={task.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span className="text-body">
                              {task.title}{' '}
                              <span className="text-xs text-muted">
                                (day {task.dueOffsetDays}, {task.isMandatory ? 'mandatory' : 'optional'},{' '}
                                {task.evidenceTypes.join('/')})
                              </span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setDialog({
                                    kind: 'dependency',
                                    projectId: project.id,
                                    milestoneId: milestone.id,
                                    taskId: task.id,
                                    taskTitle: task.title,
                                  })
                                }
                              >
                                Prerequisite
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setConfirmDelete({
                                    kind: 'task',
                                    projectId: project.id,
                                    milestoneId: milestone.id,
                                    taskId: task.id,
                                    title: task.title,
                                  })
                                }
                              >
                                Delete
                              </Button>
                            </span>
                          </li>
                        ))}
                        {(milestone.tasks ?? []).length === 0 && (
                          <li className="text-sm text-muted">No tasks yet.</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* Create-draft dialog */}
      {dialog?.kind === 'create-draft' && (
        <ConfirmDialog
          open
          title="New project draft"
          confirmLabel={busy ? 'Creating…' : 'Create draft'}
          busy={busy}
          onConfirm={() => {
            if (title.trim().length >= 5 && domainId && problemStatement.trim().length >= 30) {
              void createDraft();
            }
          }}
          onCancel={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            <Field label="Title (min 5 characters)" htmlFor="draft-title">
              <TextInput id="draft-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Source type" htmlFor="draft-source">
                <Select
                  id="draft-source"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as ProjectSourceType)}
                >
                  {Object.entries(PROJECT_SOURCE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Domain" htmlFor="draft-domain">
                <Select id="draft-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
                  <option value="">Select…</option>
                  {(domains ?? []).map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Difficulty" htmlFor="draft-difficulty">
                <Select
                  id="draft-difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'BEGINNER' | 'INTERMEDIATE')}
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                </Select>
              </Field>
              <Field label="Duration (weeks, 2-26)" htmlFor="draft-duration">
                <TextInput
                  id="draft-duration"
                  type="number"
                  min={2}
                  max={26}
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Required skills (comma-separated)" htmlFor="draft-skills">
              <TextInput
                id="draft-skills"
                value={requiredSkills}
                onChange={(e) => setRequiredSkills(e.target.value)}
                placeholder="React, PostgreSQL, testing"
              />
            </Field>
            <Field label="Problem statement (min 30 characters)" htmlFor="draft-problem">
              <TextArea
                id="draft-problem"
                rows={3}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
              />
            </Field>
            <Field label="Objectives" htmlFor="draft-objectives">
              <TextArea id="draft-objectives" rows={2} value={objectives} onChange={(e) => setObjectives(e.target.value)} />
            </Field>
            <Field label="Requirements" htmlFor="draft-requirements">
              <TextArea id="draft-requirements" rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
            </Field>
            <Field label="Expected deliverables" htmlFor="draft-deliverables">
              <TextArea
                id="draft-deliverables"
                rows={2}
                value={expectedDeliverables}
                onChange={(e) => setExpectedDeliverables(e.target.value)}
              />
            </Field>
            <Field label="Evaluation criteria" htmlFor="draft-criteria">
              <TextArea
                id="draft-criteria"
                rows={2}
                value={evaluationCriteria}
                onChange={(e) => setEvaluationCriteria(e.target.value)}
              />
            </Field>
            <Field label="Submission guidelines" htmlFor="draft-guidelines">
              <TextArea
                id="draft-guidelines"
                rows={2}
                value={submissionGuidelines}
                onChange={(e) => setSubmissionGuidelines(e.target.value)}
              />
            </Field>
            {formError && <Alert variant="error">{formError}</Alert>}
          </div>
        </ConfirmDialog>
      )}

      {/* Add-milestone dialog */}
      {dialog?.kind === 'milestone' && (
        <ConfirmDialog
          open
          title="Add milestone"
          confirmLabel={busy ? 'Adding…' : 'Add'}
          busy={busy}
          onConfirm={() => {
            void run(() =>
              api.post(`/api/projects/${dialog.projectId}/milestones`, {
                title: milestoneTitle.trim(),
                order: Number(milestoneOrder),
                isRequired: milestoneRequired,
              })
            );
          }}
          onCancel={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Title" htmlFor="ms-title">
              <TextInput id="ms-title" value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Order" htmlFor="ms-order">
                <TextInput
                  id="ms-order"
                  type="number"
                  min={1}
                  value={milestoneOrder}
                  onChange={(e) => setMilestoneOrder(e.target.value)}
                />
              </Field>
              <Field label="Requirement" htmlFor="ms-required">
                <Select
                  id="ms-required"
                  value={milestoneRequired ? 'required' : 'optional'}
                  onChange={(e) => setMilestoneRequired(e.target.value === 'required')}
                >
                  <option value="required">Required</option>
                  <option value="optional">Optional</option>
                </Select>
              </Field>
            </div>
            {formError && <Alert variant="error">{formError}</Alert>}
          </div>
        </ConfirmDialog>
      )}

      {/* Add-task dialog */}
      {dialog?.kind === 'task' && (
        <ConfirmDialog
          open
          title="Add task"
          confirmLabel={busy ? 'Adding…' : 'Add'}
          busy={busy}
          onConfirm={() => {
            void run(() =>
              api.post(`/api/projects/${dialog.projectId}/milestones/${dialog.milestoneId}/tasks`, {
                title: taskTitle.trim(),
                acceptanceCriteria: taskCriteria.trim() || undefined,
                isMandatory: taskMandatory,
                evidenceTypes: taskEvidence.split(',') as ('CODE' | 'DOCUMENT' | 'LIVE_DEMO')[],
                dueOffsetDays: Number(taskDueOffset),
                order: Number(taskOrder),
              })
            );
          }}
          onCancel={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Title" htmlFor="task-title">
              <TextInput id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </Field>
            <Field label="Acceptance criteria" htmlFor="task-criteria">
              <TextArea
                id="task-criteria"
                rows={2}
                value={taskCriteria}
                onChange={(e) => setTaskCriteria(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Evidence types" htmlFor="task-evidence">
                <Select id="task-evidence" value={taskEvidence} onChange={(e) => setTaskEvidence(e.target.value)}>
                  <option value="CODE">Code</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="LIVE_DEMO">Live demo</option>
                  <option value="CODE,DOCUMENT">Code + document</option>
                  <option value="CODE,LIVE_DEMO">Code + live demo</option>
                </Select>
              </Field>
              <Field label="Due day offset" htmlFor="task-offset">
                <TextInput
                  id="task-offset"
                  type="number"
                  min={1}
                  value={taskDueOffset}
                  onChange={(e) => setTaskDueOffset(e.target.value)}
                />
              </Field>
              <Field label="Order" htmlFor="task-order">
                <TextInput
                  id="task-order"
                  type="number"
                  min={1}
                  value={taskOrder}
                  onChange={(e) => setTaskOrder(e.target.value)}
                />
              </Field>
              <Field label="Requirement" htmlFor="task-mandatory">
                <Select
                  id="task-mandatory"
                  value={taskMandatory ? 'mandatory' : 'optional'}
                  onChange={(e) => setTaskMandatory(e.target.value === 'mandatory')}
                >
                  <option value="mandatory">Mandatory</option>
                  <option value="optional">Optional</option>
                </Select>
              </Field>
            </div>
            {formError && <Alert variant="error">{formError}</Alert>}
          </div>
        </ConfirmDialog>
      )}

      {/* Add-prerequisite dialog (FR-054/055) */}
      {dialog?.kind === 'dependency' && (
        <ConfirmDialog
          open
          title={`Add prerequisite — ${dialog.taskTitle}`}
          confirmLabel={busy ? 'Adding…' : 'Add prerequisite'}
          confirmDisabled={!prerequisiteTaskId}
          busy={busy}
          onConfirm={() => {
            if (prerequisiteTaskId) {
              void run(() =>
                api.post(
                  `/api/projects/${dialog.projectId}/milestones/${dialog.milestoneId}/tasks/${dialog.taskId}/dependencies`,
                  { prerequisiteTaskId }
                )
              );
            }
          }}
          onCancel={() => {
            if (!busy) setDialog(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Prerequisite task" htmlFor="dep-task">
              <Select
                id="dep-task"
                value={prerequisiteTaskId}
                onChange={(e) => setPrerequisiteTaskId(e.target.value)}
              >
                <option value="">Select…</option>
                {(data ?? [])
                  .find((p) => p.id === dialog.projectId)
                  ?.milestones?.flatMap((m) => m.tasks ?? [])
                  .filter((task) => task.id !== dialog.taskId)
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">
              The intern cannot start this task until every prerequisite task instance is approved.
              Cyclic dependencies are rejected by the server (FR-CAND-055).
            </p>
            {formError && <Alert variant="error">{formError}</Alert>}
          </div>
        </ConfirmDialog>
      )}

      {/* Draft deletion confirm (milestone or task) — destructive but
          draft-scoped, so the consequence text stays short. */}
      {confirmDelete && (
        <ConfirmDialog
          open
          title={
            confirmDelete.kind === 'milestone'
              ? `Delete milestone "${confirmDelete.title}"?`
              : `Delete task "${confirmDelete.title}"?`
          }
          description={
            confirmDelete.kind === 'milestone'
              ? 'The milestone and its tasks are removed from the draft. This cannot be undone.'
              : 'The task is removed from the milestone. This cannot be undone.'
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          busy={busy}
          onConfirm={() => {
            const target = confirmDelete;
            setConfirmDelete(null);
            void run(
              () =>
                target.kind === 'milestone'
                  ? api.delete(
                      `/api/projects/${target.projectId}/milestones/${target.milestoneId}`
                    )
                  : api.delete(
                      `/api/projects/${target.projectId}/milestones/${target.milestoneId}/tasks/${target.taskId}`
                    ),
              false
            );
          }}
          onCancel={() => {
            if (!busy) setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}
