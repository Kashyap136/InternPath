'use client';

// Program detail + application entry (SRS FR-CAND-018 read model,
// FR-CAND-021/028/029). "Start application" creates a DRAFT via
// POST /api/applications; completion (statement of interest) and submission
// happen on /applications — matching the server's draft→submit transition.
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { parseApiError } from '@/lib/form-errors';
import { DIFFICULTY_LABEL, PROGRAM_STATUS_LABEL, programApplicationWindow } from '@/lib/status';
import type { Application, Program, Project } from '@/types';

function applicationEnterGotcha(message: string): string {
  // Translate the authoritative backend business outcomes (FR-CAND-029).
  if (/APPLICATION_EXISTS/i.test(message)) {
    return 'You already have an application for this program. Open it from My applications.';
  }
  if (/ACTIVE_INTERNSHIP_EXISTS/i.test(message)) {
    return 'You already have an active or pending internship. Only one internship can run at a time.';
  }
  if (/PROFILE_INCOMPLETE/i.test(message)) {
    return 'Your student profile must be complete before applying. Finish it on the Profile page.';
  }
  if (/DEADLINE_PASSED/i.test(message)) {
    return 'The application deadline for this program has passed.';
  }
  if (/ELIGIBILITY|NOT_ELIGIBLE|LEVEL/i.test(message)) {
    return 'You do not currently meet this program’s eligibility rule.';
  }
  return message;
}

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data, error, loading, reload } = useApiLoad<Program | null>(() =>
    api
      .get<{ data: Program | null }>(`/api/programs/${encodeURIComponent(id)}`)
      .then((r) => r.data)
  );

  // P3 fix (staging remediation 2026-11-21): students must understand what
  // they are applying for BEFORE submitting. Published project briefs in the
  // program's domain are fetched once the program (and its domain) is known —
  // the projects API already enforces PUBLISHED-only visibility for students,
  // so drafts and other authors' private data are never exposed here.
  const domainId = data?.domain?.id ?? '';
  const briefs = useApiLoad<Project[]>(
    () =>
      domainId
        ? api
            .get<{ data: Project[] }>(
              `/api/projects?domainId=${encodeURIComponent(domainId)}&status=PUBLISHED&limit=10`
            )
            .then((r) => r.data)
        : Promise.resolve([]),
    [domainId]
  );

  const [enterError, setEnterError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  const startApplication = async () => {
    setEntering(true);
    setEnterError(null);
    try {
      const created = await api.post<{ data: Application }>('/api/applications', {
        programId: id,
      });
      // Submitting requires a complete statement of interest and profile;
      // the applications page carries the draft into the submission flow.
      router.push(`/applications/${created.data.id}`);
    } catch (err) {
      const parsed = parseApiError(err);
      setEnterError(
        applicationEnterGotcha(parsed.formError ?? (err instanceof Error ? err.message : ''))
      );
    } finally {
      setEntering(false);
    }
  };

  if (loading) return <LoadingState label="Loading program…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) {
    // getPublicById returns null for unknown ids and for DRAFT programs
    // (BE-11) — show an explicit state instead of a blank page.
    return (
      <div className="space-y-6">
        <div>
          <Link href="/programs" className="text-sm text-muted underline-offset-2 hover:underline">
            ← All programs
          </Link>
        </div>
        <EmptyState
          title="Program not available"
          description="This program does not exist or is not published yet. It may still be in preparation by the administrators."
          action={<ButtonLink href="/programs">Browse programs</ButtonLink>}
        />
      </div>
    );
  }

  const program = data;
  const { open: windowOpen, reason } = programApplicationWindow(program, new Date());
  const seatsLeft = Math.max(0, program.seats - (program._count?.applications ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/programs" className="text-sm text-muted underline-offset-2 hover:underline">
          ← All programs
        </Link>
      </div>

      {/* Program header — serif headline, status + domain pills. */}
      <section className="rounded-[20px] border border-line bg-white p-5 shadow-card lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-bold leading-[1.08] tracking-tight text-ink sm:text-3xl">
              {program.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone={program.status === 'OPEN' ? 'success' : 'neutral'}>
                {PROGRAM_STATUS_LABEL[program.status]}
              </StatusBadge>
              {program.domain ? <StatusBadge tone="neutral">{program.domain.name}</StatusBadge> : null}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-secondary text-balance">
              {DIFFICULTY_LABEL[program.level as 'BEGINNER' | 'INTERMEDIATE'] ?? program.level} ·{' '}
              {program.durationWeeks}-week internship ·{' '}
              {seatsLeft} of {program.seats} seats available
            </p>
          </div>
          <div>
            {windowOpen ? (
              <Button onClick={() => void startApplication()} disabled={entering}>
                {entering ? 'Creating draft…' : 'Start application'}
              </Button>
            ) : (
              <StatusBadge tone="neutral">
                {reason === 'DEADLINE_PASSED' ? 'Deadline passed' : 'Not accepting applications'}
              </StatusBadge>
            )}
          </div>
        </div>
      </section>

      {enterError ? (
        <Alert variant="warning" title="Cannot start application">
          {enterError}{' '}
          <Link href="/applications" className="font-medium underline underline-offset-2">
            My applications
          </Link>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <dl className="rounded-xl border border-neutral-border bg-white p-5">
          {/* grid-cols-[auto_1fr] — underscores, not commas: Tailwind arbitrary
              values pass through verbatim and a comma produces invalid CSS. */}
          <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">Duration</dt>
            <dd className="text-ink">{program.durationWeeks} weeks</dd>
            <dt className="text-muted">Level</dt>
            <dd className="text-ink">
              {DIFFICULTY_LABEL[program.level as 'BEGINNER' | 'INTERMEDIATE'] ?? program.level}
            </dd>
            {program.requiredLevel ? (
              <>
                <dt className="text-muted">Eligibility level</dt>
                <dd className="text-ink">
                  {DIFFICULTY_LABEL[program.requiredLevel as 'BEGINNER' | 'INTERMEDIATE'] ??
                    program.requiredLevel}
                </dd>
              </>
            ) : null}
            <dt className="text-muted">Seats</dt>
            <dd className="text-ink">
              {seatsLeft} available of {program.seats} (
              {(program._count?.applications ?? 0) === 1
                ? '1 applicant'
                : `${program._count?.applications ?? 0} applicants`}
              )
            </dd>
            <dt className="text-muted">Apply before</dt>
            <dd className="text-ink">{formatDate(program.applicationDeadline)}</dd>
            <dt className="text-muted">Starts</dt>
            <dd className="text-ink">{formatDate(program.startDate)}</dd>
          </div>
        </dl>

        {briefs.data && briefs.data.length > 0 && (
          <section className="mt-6 rounded-[20px] border border-line bg-white p-5 shadow-card lg:p-6">
            <h2 className="text-base font-semibold text-ink">What the work looks like</h2>
            <p className="mt-1 text-sm text-secondary">
              Published project briefs for this program&apos;s domain. The exact
              project is confirmed by administrators when your internship is set
              up; its full brief — objectives, deliverables, milestone structure
              and evaluation criteria — is always visible before you commit to
              any task.
            </p>
            <ul className="mt-4 space-y-3">
              {briefs.data.map((project) => (
                <li key={project.id} className="rounded-lg border border-line p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-primary-700 hover:underline"
                    >
                      {project.title}
                    </Link>
                    <StatusBadge tone="neutral">
                      {DIFFICULTY_LABEL[project.difficulty] ?? project.difficulty}
                    </StatusBadge>
                    <span className="text-xs text-muted">{project.durationWeeks} weeks</span>
                  </div>
                  {project.requiredSkills && project.requiredSkills.length > 0 && (
                    <p className="mt-1.5 text-xs text-muted">
                      Skills: {project.requiredSkills.join(', ')}
                    </p>
                  )}
                  <p className="mt-2 line-clamp-3 text-sm text-secondary">
                    {project.problemStatement}
                  </p>
                  <Link
                    href={`/projects/${project.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-danger-solid hover:underline"
                  >
                    Read the full brief (objectives, deliverables, milestones, evaluation
                    criteria) →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="rounded-xl border border-neutral-border bg-surface-subtle p-5 text-sm text-muted">
          <h2 className="font-medium text-ink">How applications work</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Start a draft application — your statement of interest stays editable.</li>
            <li>Complete your student profile and pass this domain’s skills assessment at the required level.</li>
            <li>
              Press <strong>Submit for review</strong> before the deadline — a draft is not sent. Mentors in
              this domain and administrators then review and decide.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
