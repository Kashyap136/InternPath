'use client';

// Admin dashboard — platform overview: decisions waiting, internships,
// catalogue counts and newest accounts. Figures come straight from the API.

import Link from 'next/link';
import { roleLabels } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/format';
import { APPLICATION_STATUS_LABEL } from '@/lib/status';
import type {
  AdminUserListItem,
  Application,
  AuthUser,
  Internship,
  PaginatedResponse,
} from '@/types';
import {
  Avatar,
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
  BuildingOfficeIcon,
  CheckCircleIcon,
  ClipboardCheckIcon,
  GraduationCapIcon,
  InboxIcon,
} from '@/components/icons';
import { firstName, useAsyncLoad } from '@/components/dashboard-shared';

const total = (r: { meta?: { total?: number } } | null | undefined) => r?.meta?.total ?? 0;

export function AdminView({ user }: { user: AuthUser }) {
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

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Applications to review" value={data.awaitingCount} hint="Submitted or under review" href="/admin/applications" icon={InboxIcon} tone="accent" />
        <StatCard label="Active internships" value={data.activeInternships} hint={`${data.pendingStart} waiting to start`} href="/admin/internships" icon={BuildingOfficeIcon} />
        <StatCard label="Open programs" value={data.openPrograms} hint="Accepting applications" href="/admin/programs" icon={GraduationCapIcon} tone="purple" />
        <StatCard label="Published projects" value={data.publishedProjects} hint={data.projectReviews ? `${data.projectReviews} awaiting review` : 'None awaiting review'} href="/admin/projects" icon={ClipboardCheckIcon} tone="wine" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 lg:items-start lg:gap-6">
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
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-surface-subtle focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  >
                    <Avatar name={a.user?.fullName ?? '?'} />
                    <div className="min-w-[9rem] flex-1">
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
