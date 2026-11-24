'use client';

// Student dashboard — current internship, offers, pathway steps, recent
// applications and profile status. Figures come straight from the API.

import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import { APPLICATION_STATUS_LABEL, INTERNSHIP_STATUS_LABEL } from '@/lib/status';
import type {
  Application,
  ApplicationStatus,
  AuthUser,
  Internship,
  StudentProfile,
} from '@/types';
import {
  Alert,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
} from '@/components/ui';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClipboardCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  InboxIcon,
} from '@/components/icons';
import { StudentChecklist } from '@/components/student/profile-checklist';
import { AccountCard, firstName, greeting, useAsyncLoad } from '@/components/dashboard-shared';

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

export function StudentView({ user }: { user: AuthUser }) {
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
