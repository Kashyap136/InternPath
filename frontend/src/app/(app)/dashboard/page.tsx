'use client';

// Role dashboards — each one leads with the work that is happening on the
// platform (internship progress, review queue, intake), with profile and
// account details as secondary context. All figures come from the existing
// API endpoints; nothing is computed or invented client-side beyond simple
// counts of what the API returned.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useApiErrorHandler, roleLabels } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import {
  APPLICATION_STATUS_LABEL,
  INTERNSHIP_STATUS_LABEL,
  INTERNSHIP_STATUS_TONE,
} from '@/lib/status';
import type {
  AdminUserListItem,
  Application,
  ApplicationStatus,
  AuthUser,
  Internship,
  MentorProfile,
  PaginatedResponse,
  StudentProfile,
} from '@/types';
import {
  Alert,
  Avatar,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  ProgressBar,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import {
  ArrowRightIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClipboardCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  InboxIcon,
  UsersIcon,
} from '@/components/icons';
import { StudentChecklist } from '@/components/profile-checklist';

/* ------------------------------------------------------------------ */
/* Hooks & helpers                                                     */
/* ------------------------------------------------------------------ */

function useAsyncLoad<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const handleApiError = useApiErrorHandler();

  const reload = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        handleApiError(err);
        if (active)
          setError(
            err instanceof ApiError ? err.message : 'Failed to load data'
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handleApiError]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  return { data, error, loading, reload };
}

/** First name for greetings, ignoring bracketed suffixes such as "(Demo)". */
function firstName(fullName: string): string {
  return fullName.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/)[0] ?? fullName;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const APPLICATION_TONE: Record<ApplicationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  DECLINED: 'neutral',
  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
};

const CURRENT_INTERNSHIP: Internship['status'][] = ['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION'];

function AccountCard({ user }: { user: AuthUser }) {
  return (
    <Panel title="Account">
      <div className="flex items-center gap-3">
        <Avatar name={user.fullName} className="h-10 w-10 text-sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
          <p className="truncate text-[13px] text-muted">{user.email}</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-line border-t border-line text-sm">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Role</dt>
          <dd className="font-medium text-ink">{roleLabels[user.role]}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2.5">
          <dt className="text-muted">Member since</dt>
          <dd className="font-medium text-ink">{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink href="/profile" variant="secondary" size="sm">
          Edit profile
        </ButtonLink>
        <ButtonLink href="/change-password" variant="ghost" size="sm">
          Change password
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Student                                                             */
/* ------------------------------------------------------------------ */

function CurrentInternshipCard({ internship }: { internship: Internship }) {
  const p = internship.progress;
  const pct = Math.round(p?.approvedPercentage ?? 0);
  return (
    <section
      aria-labelledby="current-internship"
      className="bg-evergreen rise-in relative overflow-hidden rounded-[24px] text-white shadow-panel"
    >
      <div className="relative p-6 sm:p-8">
        {/* Decorative texture + growth rings */}
        <div aria-hidden="true" className="bg-dot-grid-light pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_left,black,transparent_60%)]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 h-40 w-40 rounded-full border border-white/10" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-100 ring-1 ring-inset ring-white/15">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              Your internship · {INTERNSHIP_STATUS_LABEL[internship.status]}
            </p>
            <h2 id="current-internship" className="mt-3 font-serif text-[1.75rem] font-bold leading-tight tracking-[-0.03em] text-balance">
              {internship.program?.title ?? 'Internship'}
            </h2>
            <p className="mt-1.5 text-sm text-primary-100">
              {internship.project ? <>Project: <span className="font-medium text-white">{internship.project.title}</span></> : 'Project assignment pending'}
              {internship.mentor ? <> · Mentor: <span className="font-medium text-white">{internship.mentor.fullName}</span></> : null}
            </p>
          </div>
          <Link
            href={`/internships/${internship.id}`}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-accent-400 px-5 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_8px_20px_-8px_rgb(245_170_47/0.6)] transition-colors hover:bg-accent-300 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-800"
          >
            Open workspace
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        {p && (
          <div className="relative mt-6">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm text-primary-100">
                {p.approvedMandatoryTasks} of {p.mandatoryTasks} mandatory tasks approved
              </p>
              <p className="font-serif text-[2.5rem] font-bold leading-none tracking-[-0.04em] tabular-nums">
                {pct}
                <span className="text-xl text-primary-200">%</span>
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="Internship completion"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/15"
            >
              <div className="h-full rounded-full bg-linear-to-r from-accent-300 to-accent-400 shadow-[0_0_12px_rgb(245_170_47/0.6)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.08] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <dt className="text-[12px] font-medium text-primary-200">Next task</dt>
                <dd className="mt-1 truncate font-semibold">{p.nextTask?.title ?? 'All caught up'}</dd>
                {p.nextTask && <dd className="text-xs text-primary-200">Due {formatDate(p.nextTask.dueDate)}</dd>}
              </div>
              <div className="rounded-2xl bg-white/[0.08] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <dt className="text-[12px] font-medium text-primary-200">Waiting for review</dt>
                <dd className="mt-1 font-serif text-2xl font-bold tabular-nums">{p.pendingReviewCount}</dd>
              </div>
              <div className="rounded-2xl bg-white/[0.08] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <dt className="text-[12px] font-medium text-primary-200">Timeline</dt>
                <dd className="mt-1 font-semibold">{formatDate(internship.startDate)} – {formatDate(internship.endDate)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function PathwaySteps({ profileComplete, hasApplication }: { profileComplete: boolean; hasApplication: boolean }) {
  const steps = [
    { href: '/profile', title: 'Complete your profile', body: 'Institution, degree and skills.', done: profileComplete },
    { href: '/assessment', title: 'Take a domain assessment', body: 'Your level unlocks matching programs.', done: false },
    { href: '/programs', title: 'Apply to an open program', body: 'Write a short statement of interest.', done: hasApplication },
    { href: '/applications', title: 'Accept your offer', body: 'Then a mentor and project are assigned.', done: false },
  ];
  return (
    <Panel title="Your pathway" subtitle="Four steps from sign-up to your first mentored project.">
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full items-start gap-3 rounded-xl border border-line bg-surface-subtle p-4 transition-colors hover:border-primary-200 hover:bg-primary-50/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done ? 'bg-primary-700 text-white' : 'border border-line-input bg-white text-secondary'
                }`}
              >
                {s.done ? <CheckCircleIcon className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink group-hover:text-primary-800">{s.title}</span>
                <span className="mt-0.5 block text-[13px] text-secondary">{s.body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function StudentView({ user }: { user: AuthUser }) {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const [profileRes, internships, applications] = await Promise.all([
      api.get<{ profile: StudentProfile | null; complete: boolean }>('/api/profiles/student/me'),
      api.get<{ data: Internship[] }>('/api/internships').then((r) => r.data).catch(() => [] as Internship[]),
      api.get<{ data: Application[] }>('/api/applications').then((r) => r.data).catch(() => [] as Application[]),
    ]);
    return { ...profileRes, internships, applications };
  });

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const profile = data?.profile ?? null;
  const complete = data?.complete ?? false;
  const internships = data?.internships ?? [];
  const applications = data?.applications ?? [];
  const current = internships.find((i) => CURRENT_INTERNSHIP.includes(i.status));
  const offers = applications.filter((a) => a.status === 'APPROVED');
  const openApps = applications.filter((a) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DRAFT'].includes(a.status));
  const completed = internships.filter((i) => i.status === 'COMPLETED').length;

  const subtitle = current
    ? `You're ${Math.round(current.progress?.approvedPercentage ?? 0)}% through ${current.program?.title ?? 'your internship'}.`
    : offers.length > 0
    ? 'You have an offer waiting for your response.'
    : !complete
    ? 'Finish your profile to start applying to programs.'
    : 'Browse open programs and apply when you are ready.';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student workspace"
        title={`${greeting()}, ${firstName(user.fullName)}`}
        subtitle={subtitle}
        actions={<ButtonLink href="/programs" variant="secondary">Browse programs</ButtonLink>}
      />

      {offers.map((a) => (
        <Alert key={a.id} variant="success" title="You have an internship offer">
          {a.program?.title ?? 'A program'} approved your application.
          {a.acceptanceDeadline ? ` Respond by ${formatDate(a.acceptanceDeadline)}.` : ''}{' '}
          <Link href={`/applications/${a.id}`} className="font-semibold underline underline-offset-2">
            Review offer
          </Link>
        </Alert>
      ))}

      {current && <CurrentInternshipCard internship={current} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Open applications" value={openApps.length} hint={`${applications.length} in total`} href="/applications" icon={InboxIcon} />
        <StatCard label="Waiting for review" value={current?.progress?.pendingReviewCount ?? 0} hint="Submitted tasks" href={current ? `/internships/${current.id}` : '/internships'} icon={ClockIcon} tone="accent" />
        <StatCard label="Changes requested" value={current?.progress?.changesRequestedCount ?? 0} hint="Feedback to act on" href={current ? `/internships/${current.id}` : '/internships'} icon={ClipboardCheckIcon} tone="wine" />
        <StatCard label="Completed internships" value={completed} hint="With certificates" href="/certificates" icon={GraduationCapIcon} tone="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4 lg:col-span-2 lg:space-y-6">
          {!current && <PathwaySteps profileComplete={complete} hasApplication={applications.length > 0} />}

          <Panel
            title="Recent applications"
            actions={<ButtonLink href="/applications" variant="ghost" size="sm">View all</ButtonLink>}
            padded={applications.length === 0}
          >
            {applications.length === 0 ? (
              <EmptyState
                icon={InboxIcon}
                title="No applications yet"
                description="Find a program that matches your assessed level and apply in a few minutes."
                action={<ButtonLink href="/programs">Explore programs</ButtonLink>}
                bordered={false}
                className="items-center text-center"
              />
            ) : (
              <ul className="divide-y divide-line">
                {applications.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/applications/${a.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{a.program?.title ?? 'Program'}</p>
                        <p className="text-xs text-muted">Updated {formatRelative(a.updatedAt)}</p>
                      </div>
                      <StatusBadge tone={APPLICATION_TONE[a.status]}>{APPLICATION_STATUS_LABEL[a.status]}</StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-4 lg:space-y-6">
          <Panel title="Profile" actions={<StatusBadge tone={!profile ? 'neutral' : complete ? 'success' : 'warning'}>{!profile ? 'Not started' : complete ? 'Complete' : 'Incomplete'}</StatusBadge>}>
            {profile ? (
              complete ? (
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Studying</dt>
                    <dd className="font-medium text-ink">{profile.degree}</dd>
                    <dd className="text-[13px] text-secondary">{profile.institution} · Year {profile.yearOfStudy} · Class of {profile.graduationYear}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Skills</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {profile.declaredSkills.map((s) => (
                        <span key={s} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800">{s}</span>
                      ))}
                    </dd>
                  </div>
                </dl>
              ) : (
                <StudentChecklist profile={profile} complete={complete} />
              )
            ) : (
              <EmptyState
                icon={InboxIcon}
                title="No profile yet"
                description="Add your institution, degree, year of study, graduation year and skills."
                action={<ButtonLink href="/profile">Create profile</ButtonLink>}
                bordered={false}
              />
            )}
          </Panel>
          <AccountCard user={user} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mentor                                                              */
/* ------------------------------------------------------------------ */

interface QueueItem {
  submissionId: string;
  versionNumber: number;
  task: { id: string; title: string; status: string };
  intern: { id: string; fullName: string };
  program: { title: string };
  internshipId: string;
  submittedAt: string;
  waitingHours: number;
  reviewPeriodBreached: boolean;
}

function MentorView({ user }: { user: AuthUser }) {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const [profileRes, internships, queue] = await Promise.all([
      api.get<{ profile: (MentorProfile & { domains?: { id: string; name: string }[] }) | null }>('/api/profiles/mentor/me'),
      api.get<{ data: Internship[] }>('/api/mentor/internships').then((r) => r.data).catch(() => [] as Internship[]),
      api.get<{ data: QueueItem[] }>('/api/mentor/review-queue').then((r) => r.data).catch(() => [] as QueueItem[]),
    ]);
    return { profile: profileRes.profile, internships, queue };
  });

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const profile = data?.profile ?? null;
  const internships = data?.internships ?? [];
  const queue = data?.queue ?? [];
  const active = internships.filter((i) => i.status === 'ACTIVE');
  const overdue = queue.filter((q) => q.reviewPeriodBreached).length;
  const capacity = profile?.maxActiveInterns ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mentor workspace"
        title={`${greeting()}, ${firstName(user.fullName)}`}
        subtitle={
          queue.length > 0
            ? `${queue.length} ${queue.length === 1 ? 'submission is' : 'submissions are'} waiting for your review.`
            : 'Your review queue is clear.'
        }
        actions={<ButtonLink href="/mentor/review-queue">Open review queue</ButtonLink>}
      />

      {!profile && (
        <Alert variant="warning" title="Set up your mentor profile">
          Add your expertise domains and capacity so administrators can assign interns to you.{' '}
          <Link href="/profile" className="font-semibold underline underline-offset-2">Create profile</Link>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Awaiting review" value={queue.length} hint={overdue ? `${overdue} past review target` : 'All within target'} href="/mentor/review-queue" icon={ClockIcon} tone="accent" />
        <StatCard label="Active interns" value={active.length} hint={capacity ? `Capacity ${active.length}/${capacity}` : undefined} href="/mentor/internships" icon={UsersIcon} />
        <StatCard label="All assignments" value={internships.length} hint="Including upcoming and finished" href="/mentor/internships" icon={BuildingOfficeIcon} tone="purple" />
        <StatCard label="Expertise domains" value={profile?.domains?.length ?? 0} hint="Used for eligibility" href="/profile" icon={GraduationCapIcon} tone="wine" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <Panel
          title="Review queue"
          subtitle="Oldest first"
          className="lg:col-span-3"
          padded={queue.length === 0}
          actions={<ButtonLink href="/mentor/review-queue" variant="ghost" size="sm">View all</ButtonLink>}
        >
          {queue.length === 0 ? (
            <EmptyState icon={CheckCircleIcon} title="Nothing to review" description="New submissions from your interns will appear here." bordered={false} className="items-center text-center" />
          ) : (
            <ul className="divide-y divide-line">
              {queue.slice(0, 6).map((q) => (
                <li key={q.submissionId}>
                  <Link
                    href={`/mentor/internships/${q.internshipId}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <Avatar name={q.intern.fullName} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{q.task.title}</p>
                      <p className="truncate text-xs text-muted">
                        {q.intern.fullName} · {q.program.title}{q.versionNumber > 1 ? ` · v${q.versionNumber}` : ''}
                      </p>
                    </div>
                    <StatusBadge tone={q.reviewPeriodBreached ? 'danger' : 'warning'}>
                      {q.waitingHours < 1 ? 'Just now' : q.waitingHours < 48 ? `${Math.round(q.waitingHours)}h waiting` : `${Math.round(q.waitingHours / 24)}d waiting`}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your interns" className="lg:col-span-2" padded={internships.length === 0}>
          {internships.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No interns assigned yet" description="Administrators assign interns that match your expertise." bordered={false} className="items-center text-center" />
          ) : (
            <ul className="divide-y divide-line">
              {internships.slice(0, 6).map((i) => {
                const pct = Math.round(i.progress?.approvedPercentage ?? 0);
                const name = i.user?.fullName ?? i.intern?.fullName ?? 'Intern';
                return (
                  <li key={i.id}>
                    <Link
                      href={`/mentor/internships/${i.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-medium text-ink">{name}</p>
                        <StatusBadge tone={INTERNSHIP_STATUS_TONE[i.status]} dot={false}>{INTERNSHIP_STATUS_LABEL[i.status]}</StatusBadge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{i.project?.title ?? i.program?.title}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={pct} label={`${name} progress`} />
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-secondary">{pct}%</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
        <Panel title="Mentor profile" className="lg:col-span-2">
          {profile ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-secondary">{profile.summary || 'No summary provided yet.'}</p>
              {profile.domains && profile.domains.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.domains.map((d) => (
                    <span key={d.id} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-800">{d.name}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState icon={InboxIcon} title="No mentor profile yet" description="Add a summary of your expertise and how many interns you can supervise at once." action={<ButtonLink href="/profile">Create profile</ButtonLink>} bordered={false} />
          )}
        </Panel>
        <AccountCard user={user} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

const total = (r: { meta?: { total?: number } } | null | undefined) => r?.meta?.total ?? 0;

function AdminView({ user }: { user: AuthUser }) {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const users = '/api/auth/admin/users?page=1&limit=5';
    const safe = <T,>(p: Promise<T>) => p.catch(() => null);
    const [all, students, mentors, submitted, underReview, active, pending, open, published, projectReview] = await Promise.all([
      api.get<{ data: AdminUserListItem[]; meta: { total: number } }>(users),
      api.get<{ meta: { total: number } }>(`${users}&role=STUDENT`),
      api.get<{ meta: { total: number } }>(`${users}&role=MENTOR`),
      safe(api.get<PaginatedResponse<Application>>('/api/admin/applications?status=SUBMITTED&limit=5')),
      safe(api.get<PaginatedResponse<Application>>('/api/admin/applications?status=UNDER_REVIEW&limit=5')),
      safe(api.get<PaginatedResponse<Internship>>('/api/admin/internships?status=ACTIVE&limit=1')),
      safe(api.get<PaginatedResponse<Internship>>('/api/admin/internships?status=PENDING_START&limit=1')),
      safe(api.get<PaginatedResponse<unknown>>('/api/admin/programs?status=OPEN&limit=1')),
      safe(api.get<PaginatedResponse<unknown>>('/api/admin/projects?status=PUBLISHED&limit=1')),
      safe(api.get<PaginatedResponse<unknown>>('/api/admin/projects?status=PENDING_REVIEW&limit=1')),
    ]);
    return {
      accounts: total(all),
      students: total(students),
      mentors: total(mentors),
      latest: all.data,
      awaiting: [...(underReview?.data ?? []), ...(submitted?.data ?? [])].slice(0, 5),
      awaitingCount: total(submitted) + total(underReview),
      activeInternships: total(active),
      pendingStart: total(pending),
      openPrograms: total(open),
      publishedProjects: total(published),
      projectReviews: total(projectReview),
    };
  });

  if (loading) return <LoadingState label="Loading platform overview…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const attention = data.awaitingCount + data.pendingStart + data.projectReviews;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        subtitle={
          attention > 0
            ? `${attention} ${attention === 1 ? 'item needs' : 'items need'} your attention.`
            : `Welcome back, ${firstName(user.fullName)}. Nothing is waiting on you.`
        }
        actions={
          <>
            <ButtonLink href="/admin/users" variant="secondary">Manage users</ButtonLink>
            <ButtonLink href="/admin/programs">Programs</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Applications to review" value={data.awaitingCount} hint="Submitted or under review" href="/admin/applications" icon={InboxIcon} tone="accent" />
        <StatCard label="Active internships" value={data.activeInternships} hint={`${data.pendingStart} waiting to start`} href="/admin/internships" icon={BuildingOfficeIcon} />
        <StatCard label="Open programs" value={data.openPrograms} hint="Accepting applications" href="/admin/programs" icon={GraduationCapIcon} tone="purple" />
        <StatCard label="Published projects" value={data.publishedProjects} hint={data.projectReviews ? `${data.projectReviews} awaiting review` : 'None awaiting review'} href="/admin/projects" icon={ClipboardCheckIcon} tone="wine" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
        <Panel
          title="Needs a decision"
          subtitle="Applications waiting for review"
          className="lg:col-span-3"
          padded={data.awaiting.length === 0}
          actions={<ButtonLink href="/admin/applications" variant="ghost" size="sm">Review all</ButtonLink>}
        >
          {data.awaiting.length === 0 ? (
            <EmptyState icon={CheckCircleIcon} title="No applications waiting" description="New submissions will appear here." bordered={false} className="items-center text-center" />
          ) : (
            <ul className="divide-y divide-line">
              {data.awaiting.map((a) => (
                <li key={a.id}>
                  <Link
                    href="/admin/applications"
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <Avatar name={a.user?.fullName ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{a.user?.fullName ?? 'Applicant'}</p>
                      <p className="truncate text-xs text-muted">{a.program?.title ?? 'Program'} · {formatRelative(a.updatedAt)}</p>
                    </div>
                    <StatusBadge tone="warning">{APPLICATION_STATUS_LABEL[a.status]}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="People" className="lg:col-span-2">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Accounts', value: data.accounts },
              { label: 'Students', value: data.students },
              { label: 'Mentors', value: data.mentors },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-surface-subtle px-2 py-3">
                <dd className="font-serif text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
                <dt className="text-xs text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.06em] text-muted">Newest accounts</p>
          <ul className="mt-2 divide-y divide-line">
            {data.latest.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={u.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{u.fullName}</p>
                  <p className="truncate text-xs text-muted">{roleLabels[u.role]} · {formatDate(u.createdAt)}</p>
                </div>
                {u.status !== 'ACTIVE' && <StatusBadge tone="danger">Suspended</StatusBadge>}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <ButtonLink href="/admin/users" variant="ghost" size="sm">View all users</ButtonLink>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === 'STUDENT') return <StudentView user={user} />;
  if (user.role === 'MENTOR') return <MentorView user={user} />;
  return <AdminView user={user} />;
}
