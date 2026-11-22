'use client';

// Admin project lifecycle (Sprint 3 — FR-CAND-041/042): review pending
// projects (approve / reject with mandatory comments), publish approved
// projects, archive published ones. TEMP: an admin reviewing their own
// project is permitted and audited server-side.

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
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import {
  DIFFICULTY_LABEL,
  PROJECT_SOURCE_LABEL,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
} from '@/lib/status';
import type { Project } from '@/types';

const STATUS_TONE = PROJECT_STATUS_TONE;

export default function AdminProjectsPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const { data, error, loading, reload } = useApiLoad<Project[]>(
    () => {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      return api.get<{ data: Project[] }>(`/api/admin/projects?${params.toString()}`).then((r) => r.data);
    },
    [statusFilter]
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewProject, setReviewProject] = useState<Project | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewComments, setReviewComments] = useState('');
  const [archiveProject, setArchiveProject] = useState<Project | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide() {
    if (!reviewProject) return;
    setBusyId(reviewProject.id);
    setMessage(null);
    setActionError(null);
    try {
      await api.post(`/api/admin/projects/${reviewProject.id}/review`, {
        decision: reviewDecision,
        comments: reviewComments.trim() || undefined,
      });
      setMessage(reviewDecision === 'APPROVED' ? 'Project approved' : 'Project returned to draft');
      setReviewProject(null);
      setReviewComments('');
      reload();
    } catch (err) {
      // Failures must never reuse the success banner — they get their own
      // error Alert (and the dialog stays open so the comment survives).
      setActionError(apiErrorMessage(parseApiError(err), 'The review could not be recorded'));
    } finally {
      setBusyId(null);
    }
  }

  async function publish(project: Project) {
    setBusyId(project.id);
    setMessage(null);
    setActionError(null);
    try {
      await api.post(`/api/admin/projects/${project.id}/publish`, {});
      setMessage('Project published');
      reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'The project could not be published'));
    } finally {
      setBusyId(null);
    }
  }

  async function archive() {
    if (!archiveProject) return;
    setBusyId(archiveProject.id);
    setMessage(null);
    setActionError(null);
    try {
      await api.post(`/api/admin/projects/${archiveProject.id}/archive`, {
        reason: archiveReason.trim(),
      });
      setMessage('Project archived');
      setArchiveProject(null);
      setArchiveReason('');
      reload();
    } catch (err) {
      setActionError(apiErrorMessage(parseApiError(err), 'The project could not be archived'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Review submitted projects, publish approved ones and archive projects that must no longer be assigned."
        actions={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PENDING_REVIEW">Pending review</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert variant="success">{message}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <Alert variant="error" title="Action failed">
            {actionError}
          </Alert>
        </div>
      )}

      {loading && <LoadingState label="Loading projects…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState title="No projects in this view" description="Adjust the status filter." />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((project) => (
            <Panel key={project.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
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
                    {PROJECT_SOURCE_LABEL[project.sourceType]} · by{' '}
                    {project.author?.fullName ?? 'unknown'}
                  </p>
                  {project.status === 'PENDING_REVIEW' && (
                    <details className="mt-2 max-w-3xl text-sm">
                      <summary className="cursor-pointer text-primary-700">View definition</summary>
                      <p className="mt-2 whitespace-pre-line text-body">{project.problemStatement}</p>
                      {project.objectives && (
                        <p className="mt-2 whitespace-pre-line text-secondary">{project.objectives}</p>
                      )}
                      {project.requirements && (
                        <p className="mt-2 whitespace-pre-line text-secondary">{project.requirements}</p>
                      )}
                      {project.expectedDeliverables && (
                        <p className="mt-2 whitespace-pre-line text-secondary">
                          {project.expectedDeliverables}
                        </p>
                      )}
                      {project.evaluationCriteria && (
                        <p className="mt-2 whitespace-pre-line text-secondary">
                          {project.evaluationCriteria}
                        </p>
                      )}
                      {project.submissionGuidelines && (
                        <p className="mt-2 whitespace-pre-line text-secondary">
                          {project.submissionGuidelines}
                        </p>
                      )}
                    </details>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {project.status === 'PENDING_REVIEW' && (
                    <Button
                      size="sm"
                      disabled={busyId === project.id}
                      onClick={() => {
                        setReviewProject(project);
                        setReviewDecision('APPROVED');
                        setReviewComments('');
                      }}
                    >
                      Review
                    </Button>
                  )}
                  {project.status === 'APPROVED' && (
                    <Button
                      size="sm"
                      disabled={busyId === project.id}
                      onClick={() => void publish(project)}
                    >
                      Publish
                    </Button>
                  )}
                  {(project.status === 'PUBLISHED' || project.status === 'APPROVED') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setArchiveProject(project);
                        setArchiveReason('');
                      }}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {reviewProject && (
        <ConfirmDialog
          open
          title={`Review — ${reviewProject.title}`}
          confirmLabel={busyId === reviewProject.id ? 'Saving…' : 'Record decision'}
          busy={busyId === reviewProject.id}
          confirmDisabled={reviewDecision === 'REJECTED' && reviewComments.trim().length === 0}
          onConfirm={() => void decide()}
          onCancel={() => {
            if (busyId !== reviewProject.id) setReviewProject(null);
          }}
        >
          <div className="space-y-4">
            <Field label="Decision" htmlFor="project-review-decision">
              <Select
                id="project-review-decision"
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value as 'APPROVED' | 'REJECTED')}
              >
                <option value="APPROVED">Approve</option>
                <option value="REJECTED">Reject (returns to draft)</option>
              </Select>
            </Field>
            <Field
              label={reviewDecision === 'REJECTED' ? 'Comments (required)' : 'Comments (optional)'}
              htmlFor="project-review-comments"
              hint={
                reviewDecision === 'REJECTED'
                  ? 'The author sees these comments when the project returns to draft.'
                  : undefined
              }
            >
              <TextArea
                id="project-review-comments"
                rows={3}
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
              />
            </Field>
          </div>
        </ConfirmDialog>
      )}

      {archiveProject && (
        <ConfirmDialog
          open
          title={`Archive — ${archiveProject.title}`}
          description="Archived projects can no longer be assigned to new internships. Internships already using the project are unaffected."
          confirmLabel={busyId === archiveProject.id ? 'Archiving…' : 'Archive'}
          confirmVariant="danger"
          busy={busyId === archiveProject.id}
          confirmDisabled={archiveReason.trim().length < 5}
          onConfirm={() => void archive()}
          onCancel={() => {
            if (busyId !== archiveProject.id) setArchiveProject(null);
          }}
        >
          <Field label="Reason (required)" htmlFor="archive-reason">
            <TextArea
              id="archive-reason"
              rows={2}
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
