'use client';

// Mentor dashboard — review queue, assigned interns with progress, and the
// mentor profile. Figures come straight from the API.

import Link from 'next/link';
import { api } from '@/lib/api';
import { INTERNSHIP_STATUS_LABEL, INTERNSHIP_STATUS_TONE } from '@/lib/status';
import type { AuthUser, Internship, MentorProfile } from '@/types';
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
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClockIcon,
  GraduationCapIcon,
  InboxIcon,
  UsersIcon,
} from '@/components/icons';
import { AccountCard, firstName, greeting, useAsyncLoad } from '@/components/dashboard-shared';

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

export function MentorView({ user }: { user: AuthUser }) {
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

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Awaiting review" value={queue.length} hint={overdue ? `${overdue} past review target` : 'All within target'} href="/mentor/review-queue" icon={ClockIcon} tone="accent" />
        <StatCard label="Active interns" value={active.length} hint={capacity ? `Capacity ${active.length}/${capacity}` : undefined} href="/mentor/internships" icon={UsersIcon} />
        <StatCard label="All assignments" value={internships.length} hint="Including upcoming and finished" href="/mentor/internships" icon={BuildingOfficeIcon} tone="purple" />
        <StatCard label="Expertise domains" value={profile?.domains?.length ?? 0} hint="Used for eligibility" href="/profile" icon={GraduationCapIcon} tone="wine" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
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
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <Avatar name={q.intern.fullName} />
                    <div className="min-w-[9rem] flex-1">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
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
