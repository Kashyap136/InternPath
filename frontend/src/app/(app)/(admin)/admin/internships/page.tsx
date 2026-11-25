'use client';

// Admin internships (Sprint 3/4): list with lifecycle management — assign
// mentor (from the eligible list, FR-047), assign project (published, domain
// match per DEC-011, FR-048/049), activate (FR-080), extend once (FR-082),
// terminate (FR-084) and complete after the BR-CAND-029 checklist. Re-evaluation
// approval (FR-076) is also here.

import { useState } from 'react';
import {
  Alert,
  Button,
  ButtonLink,
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
import { formatDate } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import {
  DIFFICULTY_LABEL,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE as STATUS_TONE,
  RECOMMENDATION_LABEL,
} from '@/lib/status';
import type { Internship, Project } from '@/types';

interface EligibleMentor {
  id: string;
  fullName: string;
  hasCapacity: boolean;
  currentAssignments: number;
  maxActiveInterns: number;
}

type Dialog =
  | { kind: 'mentor'; internship: Internship; mentors: EligibleMentor[] }
  | { kind: 'project'; internship: Internship }
  | { kind: 'extend'; internship: Internship }
  | { kind: 'terminate'; internship: Internship }
  | { kind: 'complete'; internship: Internship }
  | null;

export default function AdminInternshipsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, error, loading, reload } = useApiLoad<Internship[]>(
    () => {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      return api
        .get<{ data: Internship[] }>(`/api/admin/internships?${params.toString()}`)
        .then((r) => r.data);
    },
    [statusFilter]
  );

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Dialog form state
  const [mentorId, setMentorId] = useState('');
  const [mentorReason, setMentorReason] = useState('');

  const [extendDays, setExtendDays] = useState('7');
  const [extendReason, setExtendReason] = useState('');
  const [terminateReason, setTerminateReason] = useState('');
  const [reEvalReason, setReEvalReason] = useState('');
  const [reEvalTarget, setReEvalTarget] = useState<string | null>(null);
  const [reEvalBusy, setReEvalBusy] = useState(false);

  async function run(action: () => Promise<unknown>, internshipId: string, successMessage: string) {
    setActionError(null);
    setMessage(null);
    setBusyId(internshipId);
    try {
      await action();
      setMessage(successMessage);
      setDialog(null);
      reload();
      return true;
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The action could not be completed');
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function approveReEvaluation() {
    if (!reEvalTarget) return;
    setReEvalBusy(true);
    setActionError(null);
    setMessage(null);
    try {
      await api.post(`/api/admin/internships/${reEvalTarget}/re-evaluation`, {
        reason: reEvalReason.trim(),
      });
      setMessage('Re-evaluation approved');
      setReEvalTarget(null);
      setReEvalReason('');
      reload();
    } catch (err) {
      // The dialog stays open so the reason text survives a failed submit.
      setActionError(parseApiError(err).formError ?? 'The re-evaluation could not be approved');
    } finally {
      setReEvalBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Internships"
        subtitle="Assign mentors and projects, manage the lifecycle, verify the completion checklist and approve re-evaluations."
        actions={
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.entries(INTERNSHIP_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      {message && <Alert variant="success">{message}</Alert>}
      {actionError && <Alert variant="error" title="Action failed">{actionError}</Alert>}

      {loading && <LoadingState label="Loading internships…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState title="No internships" description="Internships are created when students accept approved offers." />
        </Panel>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((internship) => (
            <Panel key={internship.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-serif text-base font-semibold text-ink">
                      {internship.program?.title ?? 'Internship'}
                    </h2>
                    <StatusBadge tone={STATUS_TONE[internship.status]}>
                      {INTERNSHIP_STATUS_LABEL[internship.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-secondary">
                    {internship.user ? `${internship.user.fullName} · ` : ''}
                    {formatDate(internship.startDate)} – {formatDate(internship.endDate)} · Mentor:{' '}
                    {internship.mentor?.fullName ?? 'unassigned'} · Project:{' '}
                    {internship.project?.title ?? 'unassigned'}
                  </p>
                  {internship.evaluation && (
                    <p className="mt-0.5 text-sm text-muted">
                      Evaluation: score {internship.evaluation.finalScore.toFixed(2)},{' '}
                      {RECOMMENDATION_LABEL[internship.evaluation.recommendation]}
                      {internship.evaluation.locked ? ' (locked)' : ' (unlocked)'}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {internship.mentorId && internship.status !== 'PENDING_START' && (
                    // Same workspace mentors use: review submissions, reopen
                    // tasks, change due dates and record the final evaluation.
                    <ButtonLink size="sm" variant="secondary" href={`/mentor/internships/${internship.id}`}>
                      Review tasks
                    </ButtonLink>
                  )}
                  {!internship.mentorId && !['COMPLETED', 'WITHDRAWN', 'TERMINATED'].includes(internship.status) && (
                    <AssignMentorButton
                      internship={internship}
                      busy={busyId === internship.id}
                      onOpen={(mentors) => setDialog({ kind: 'mentor', internship, mentors })}
                    />
                  )}
                  {internship.mentorId && !internship.projectId && internship.status === 'PENDING_START' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDialog({ kind: 'project', internship })}
                    >
                      Assign project
                    </Button>
                  )}
                  {internship.status === 'PENDING_START' && internship.mentorId && internship.projectId && (
                    <Button
                      size="sm"
                      disabled={busyId === internship.id}
                      onClick={() =>
                        void run(
                          () => api.post(`/api/admin/internships/${internship.id}/activate`, {}),
                          internship.id,
                          'Internship activated'
                        )
                      }
                    >
                      Activate
                    </Button>
                  )}
                  {['ACTIVE', 'UNDER_EVALUATION'].includes(internship.status) && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ kind: 'extend', internship })}
                      >
                        Extend
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDialog({ kind: 'terminate', internship })}
                      >
                        Terminate
                      </Button>
                    </>
                  )}
                  {internship.status === 'UNDER_EVALUATION' && (
                    <Button
                      size="sm"
                      onClick={() => setDialog({ kind: 'complete', internship })}
                    >
                      Complete checklist
                    </Button>
                  )}
                  {internship.evaluation?.locked && ['UNDER_EVALUATION'].includes(internship.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReEvalTarget(internship.id);
                        setReEvalReason('');
                      }}
                    >
                      Approve re-evaluation
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* Assign mentor dialog (FR-047/050) */}
      {dialog?.kind === 'mentor' && (
        <ConfirmDialog
          open
          title={`Assign mentor — ${dialog.internship.program?.title ?? ''}`}
          confirmLabel={busyId === dialog.internship.id ? 'Assigning…' : 'Assign'}
          busy={busyId === dialog.internship.id}
          confirmDisabled={!mentorId}
          onConfirm={() => {
            void run(
              () =>
                api.post(`/api/admin/internships/${dialog.internship.id}/assign-mentor`, {
                  mentorId,
                  reason: mentorReason.trim() || undefined,
                }),
              dialog.internship.id,
              'Mentor assigned'
            );
          }}
          onCancel={() => {
            if (busyId !== dialog.internship.id) setDialog(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Eligible mentors (expertise + capacity)" htmlFor="assign-mentor">
              <Select
                id="assign-mentor"
                value={mentorId}
                onChange={(e) => setMentorId(e.target.value)}
              >
                <option value="">Select…</option>
                {dialog.mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.fullName} — {mentor.currentAssignments}/{mentor.maxActiveInterns} active
                    {mentor.hasCapacity ? '' : ' (at capacity)'}
                  </option>
                ))}
              </Select>
            </Field>
            {dialog.internship.mentorId && (
              <Field label="Reassignment reason (required)" htmlFor="mentor-reason">
                <TextArea
                  id="mentor-reason"
                  rows={2}
                  value={mentorReason}
                  onChange={(e) => setMentorReason(e.target.value)}
                />
              </Field>
            )}
          </div>
        </ConfirmDialog>
      )}

      {/* Assign project dialog (FR-048/049) */}
      {dialog?.kind === 'project' && (
        <ProjectAssignDialog
          internship={dialog.internship}
          busy={busyId === dialog.internship.id}
          onConfirm={(selectedProjectId: string) =>
            void run(
              () =>
                api.post(`/api/admin/internships/${dialog.internship.id}/assign-project`, {
                  projectId: selectedProjectId,
                }),
              dialog.internship.id,
              'Project assigned — milestone and task instances created'
            )
          }
          onCancel={() => {
            if (busyId !== dialog.internship.id) setDialog(null);
          }}
        />
      )}

      {/* Extend dialog (FR-082) */}
      {dialog?.kind === 'extend' && (
        <ConfirmDialog
          open
          title="Extend internship"
          confirmLabel={busyId === dialog.internship.id ? 'Extending…' : 'Extend'}
          busy={busyId === dialog.internship.id}
          confirmDisabled={extendReason.trim().length < 5}
          onConfirm={() => {
            void run(
              () =>
                api.post(`/api/admin/internships/${dialog.internship.id}/extend`, {
                  days: Number(extendDays),
                  reason: extendReason.trim(),
                }),
              dialog.internship.id,
              'Internship extended'
            );
          }}
          onCancel={() => {
            if (busyId !== dialog.internship.id) setDialog(null);
          }}
        >
          <div className="space-y-3">
            <Field label="Days (≤ configured maximum)" htmlFor="extend-days">
              <TextInput
                id="extend-days"
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              />
            </Field>
            <Field label="Documented reason (required)" htmlFor="extend-reason" hint="At least 5 characters.">
              <TextArea
                id="extend-reason"
                rows={2}
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted">An internship can be extended only once.</p>
          </div>
        </ConfirmDialog>
      )}

      {/* Terminate dialog (FR-084) */}
      {dialog?.kind === 'terminate' && (
        <ConfirmDialog
          open
          title="Terminate internship"
          confirmLabel={busyId === dialog.internship.id ? 'Terminating…' : 'Terminate'}
          confirmVariant="danger"
          busy={busyId === dialog.internship.id}
          confirmDisabled={terminateReason.trim().length < 5}
          onConfirm={() => {
            void run(
              () =>
                api.post(`/api/admin/internships/${dialog.internship.id}/terminate`, {
                  reason: terminateReason.trim(),
                }),
              dialog.internship.id,
              'Internship terminated'
            );
          }}
          onCancel={() => {
            if (busyId !== dialog.internship.id) setDialog(null);
          }}
        >
          <Field label="Reason (mandatory)" htmlFor="terminate-reason">
            <TextArea
              id="terminate-reason"
              rows={3}
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}

      {/* Completion checklist (FR-081 / BR-CAND-029) */}
      {dialog?.kind === 'complete' && (
        <ConfirmDialog
          open
          title="Verify completion checklist"
          description="The server re-verifies every condition: (a) all mandatory tasks APPROVED, (b) required milestones complete, (c) evaluation submitted, (d) score ≥ frozen threshold, (e) mentor recommends completion. Your confirmation is condition (f)."
          confirmLabel={busyId === dialog.internship.id ? 'Verifying…' : 'Mark COMPLETED'}
          confirmVariant="secondary"
          busy={busyId === dialog.internship.id}
          onConfirm={() => {
            void run(
              () =>
                api.post(`/api/admin/internships/${dialog.internship.id}/complete`, {
                  checklistConfirmed: true,
                }),
              dialog.internship.id,
              'Internship marked COMPLETED'
            );
          }}
          onCancel={() => {
            if (busyId !== dialog.internship.id) setDialog(null);
          }}
        >
          <p className="text-sm text-secondary">
            If any condition fails, the server lists exactly which ones — fix those first.
          </p>
        </ConfirmDialog>
      )}

      {/* Re-evaluation approval (FR-076) */}
      {reEvalTarget && (
        <ConfirmDialog
          open
          title="Approve re-evaluation"
          description="This unlocks the submitted evaluation so the mentor can submit corrected values. Previous values are preserved in the record."
          confirmLabel={reEvalBusy ? 'Approving…' : 'Approve'}
          confirmVariant="secondary"
          busy={reEvalBusy}
          confirmDisabled={reEvalReason.trim().length < 10}
          onConfirm={() => void approveReEvaluation()}
          onCancel={() => {
            if (!reEvalBusy) setReEvalTarget(null);
          }}
        >
          <Field label="Reason (min 10 characters)" htmlFor="re-eval-reason">
            <TextArea
              id="re-eval-reason"
              rows={2}
              value={reEvalReason}
              onChange={(e) => setReEvalReason(e.target.value)}
            />
          </Field>
        </ConfirmDialog>
      )}
    </div>
  );
}

function AssignMentorButton({
  internship,
  busy,
  onOpen,
}: {
  internship: Internship;
  busy: boolean;
  onOpen: (mentors: EligibleMentor[]) => void;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      disabled={busy || loading}
      onClick={() => {
        void (async () => {
          setLoading(true);
          try {
            const result = await api
              .get<{ data: EligibleMentor[] }>(`/api/admin/internships/${internship.id}/eligible-mentors`);
            onOpen(result.data);
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      {loading ? 'Loading mentors…' : 'Assign mentor'}
    </Button>
  );
}

function ProjectAssignDialog({
  internship,
  busy,
  onConfirm,
  onCancel,
}: {
  internship: Internship;
  busy: boolean;
  onConfirm: (projectId: string) => void;
  onCancel: () => void;
}) {

  const [projectId, setProjectId] = useState('');
  const domainId = internship.program?.domainId;

  const { data, error, loading } = useApiLoad<Project[]>(
    () =>
      api
        .get<{ data: Project[] }>(
          `/api/projects?status=PUBLISHED&domainId=${domainId ?? ''}&limit=100`
        )
        .then((r) => r.data),
    [domainId ?? '']
  );

  return (
    <ConfirmDialog
      open
      title={`Assign project — ${internship.program?.title ?? ''}`}
      description="Only PUBLISHED projects whose domain matches the internship domain can be assigned (DEC-011). Milestone and task instances are created from the project definition."
      confirmLabel={busy ? 'Assigning…' : 'Assign'}
      busy={busy}
      confirmDisabled={!projectId}
      onConfirm={() => {
        onConfirm(projectId);
      }}
      onCancel={() => {
        if (!busy) onCancel();
      }}
    >
      {loading && <p className="text-sm text-muted">Loading published projects…</p>}
      {error && <Alert variant="error">Projects could not be loaded.</Alert>}
      {!loading && !error && data && data.length === 0 && (
        <Alert variant="warning" title="No eligible projects">
          There are no published projects in this internship domain yet. Publish one under
          Projects first.
        </Alert>
      )}
      {!loading && data && data.length > 0 && (
        <Field label="Published project" htmlFor="assign-project">
          <Select
            id="assign-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Select…</option>
            {data.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title} ({project.durationWeeks} weeks, {DIFFICULTY_LABEL[project.difficulty]})
              </option>
            ))}
          </Select>
        </Field>
      )}
    </ConfirmDialog>
  );
}
