'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useApiErrorHandler, roleLabels } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type {
  AdminUserListItem,
  AuthUser,
  MentorProfile,
  StudentProfile,
} from '@/types';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import {
  InboxIcon,
} from '@/components/icons';
import { StudentChecklist } from '@/components/profile-checklist';

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
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

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function AccountCard({ user }: { user: AuthUser }) {
  return (
    <Panel title="Account">
      <dl className="divide-y divide-line text-sm">
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted">Email</dt>
          <dd className="truncate font-medium text-ink">{user.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted">Role</dt>
          <dd className="font-medium text-ink">{roleLabels[user.role]}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-muted">Member since</dt>
          <dd className="font-medium text-ink">{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
      <div className="mt-4 pt-4 border-t border-line">
        <ButtonLink href="/change-password" className="text-sm">
          Change password
        </ButtonLink>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Student                                                             */
/* ------------------------------------------------------------------ */

function StudentView({ user }: { user: AuthUser }) {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const res = await api.get<{
      profile: StudentProfile | null;
      complete: boolean;
    }>('/api/profiles/student/me');
    return res;
  });

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const profile = data?.profile ?? null;
  const complete = data?.complete ?? false;

  let description = 'Start by adding your study details.';
  if (profile) {
    if (complete) description = 'Your profile is complete.';
    else {
      const required = ['institution', 'degree', 'yearOfStudy', 'graduationYear', 'declaredSkills'] as const;
      const missing = required.filter((k) => {
        if (k === 'declaredSkills') return profile.declaredSkills.length === 0;
        return !profile[k];
      });
      description = `Your profile is missing ${missing.length} required ${missing.length === 1 ? 'field' : 'fields'}.`;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={description}
        actions={
          // Without a profile the panel's empty state carries the CTA;
          // repeating it in the header is noise, not guidance.
          profile ? (
            <ButtonLink href="/profile">Edit profile</ButtonLink>
          ) : undefined
        }
      />

      <Panel title="Next steps" subtitle="The assessment pathway in four moves.">
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className="rounded-lg border border-neutral-border bg-surface-subtle p-3">
            <Link href="/domains" className="font-medium text-ink underline-offset-2 hover:underline">
              1. Choose a technical domain
            </Link>
            <p className="mt-1 text-muted">See which skills are assessed.</p>
          </li>
          <li className="rounded-lg border border-neutral-border bg-surface-subtle p-3">
            <Link href="/assessment" className="font-medium text-ink underline-offset-2 hover:underline">
              2. Take a timed assessment
            </Link>
            <p className="mt-1 text-muted">Your result level feeds program eligibility.</p>
          </li>
          <li className="rounded-lg border border-neutral-border bg-surface-subtle p-3">
            <Link href="/programs" className="font-medium text-ink underline-offset-2 hover:underline">
              3. Browse open programs
            </Link>
            <p className="mt-1 text-muted">Filter by domain and duration.</p>
          </li>
          <li className="rounded-lg border border-neutral-border bg-surface-subtle p-3">
            <Link href="/applications" className="font-medium text-ink underline-offset-2 hover:underline">
              4. Track your applications
            </Link>
            <p className="mt-1 text-muted">Submit drafts and respond to offers.</p>
          </li>
        </ul>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-4 lg:col-span-2 lg:space-y-6">
          <Panel title="Profile">
            <div className="flex items-center justify-between gap-3">
              <StatusBadge
                tone={
                  !profile
                    ? 'neutral'
                    : complete
                    ? 'success'
                    : 'warning'
                }
                dot={!profile}
              >
                {!profile
                  ? 'Not started'
                  : complete
                  ? 'Complete'
                  : 'Incomplete'}
              </StatusBadge>
            </div>
            {profile ? (
              complete ? (
                // Complete profile: the values themselves are the useful
                // information — the checklist would only repeat "Added"
                // five times next to the same labels.
                <dl className="divide-y divide-line text-sm">
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-muted">Institution</dt>
                    <dd className="truncate font-medium text-ink text-right">
                      {profile.institution}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-muted">Degree</dt>
                    <dd className="truncate font-medium text-ink text-right">
                      {profile.degree}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-muted">Year of study</dt>
                    <dd className="truncate font-medium text-ink text-right">
                      {profile.yearOfStudy}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-muted">Graduation year</dt>
                    <dd className="truncate font-medium text-ink text-right">
                      {profile.graduationYear}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-muted">Skills</dt>
                    <dd className="truncate font-medium text-ink text-right">
                      {profile.declaredSkills.length > 0
                        ? profile.declaredSkills.join(', ')
                        : <span className="text-muted italic">Not provided</span>}
                    </dd>
                  </div>
                </dl>
              ) : (
                // Incomplete profile: the checklist (progress + what is
                // missing) is the actionable view; values live in the edit
                // form one click away.
                <StudentChecklist profile={profile} complete={complete} />
              )
            ) : (
              <EmptyState
                icon={InboxIcon}
                title="No profile yet"
                description="Add your institution, degree, year of study, graduation year and skills."
                action={
                  <ButtonLink href="/profile">Create profile</ButtonLink>
                }
                bordered={false}
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0 lg:col-span-1">
          <AccountCard user={user} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mentor                                                              */
/* ------------------------------------------------------------------ */

function MentorView({ user }: { user: AuthUser }) {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const res = await api.get<{ profile: MentorProfile | null }>(
      '/api/profiles/mentor/me'
    );
    return res;
  });

  if (loading) return <LoadingState label="Loading your dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const profile = data?.profile ?? null;

  const description = profile
    ? 'Your mentor profile is set up.'
    : 'Add a short summary of your expertise and your supervision capacity.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={description}
        actions={
          // Without a profile the panel's empty state carries the CTA;
          // repeating it in the header is noise, not guidance.
          profile ? (
            <ButtonLink href="/profile">Edit profile</ButtonLink>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-4 lg:col-span-2 lg:space-y-6">
          <Panel title="Mentor profile">
            {profile ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-secondary">
                  {profile.summary || 'No summary provided yet.'}
                </p>
                <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="text-muted">Supervision capacity</dt>
                    <dd className="font-medium text-ink">
                      {profile.maxActiveInterns}{' '}
                      {profile.maxActiveInterns === 1 ? 'intern' : 'interns'}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <EmptyState
                icon={InboxIcon}
                title="No mentor profile yet"
                description="Add a summary of your expertise and how many interns you can supervise at once."
                action={
                  <ButtonLink href="/profile">Create profile</ButtonLink>
                }
                bordered={false}
              />
            )}
          </Panel>
        </div>

        <div className="min-w-0 lg:col-span-1">
          <AccountCard user={user} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

interface RoleCounts {
  total: number;
  students: number;
  mentors: number;
  admins: number;
  latest: AdminUserListItem[];
}

function AdminView() {
  const { data, error, loading, reload } = useAsyncLoad(async () => {
    const base = '/api/auth/admin/users?page=1&limit=5';
    const [all, students, mentors, admins] = await Promise.all([
      api.get<{ data: AdminUserListItem[]; meta: { total: number } }>(base),
      api.get<{ meta: { total: number } }>(`${base}&role=STUDENT`),
      api.get<{ meta: { total: number } }>(`${base}&role=MENTOR`),
      api.get<{ meta: { total: number } }>(`${base}&role=ADMIN`),
    ]);
    return {
      total: all.meta.total,
      students: students.meta.total,
      mentors: mentors.meta.total,
      admins: admins.meta.total,
      latest: all.data,
    } satisfies RoleCounts;
  });

  if (loading) return <LoadingState label="Loading platform overview…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const counts = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        subtitle="Accounts on InternPath by role."
        actions={
          <ButtonLink href="/admin/users">Manage users</ButtonLink>
        }
      />

      {counts && (
        <Panel padded={false} className="overflow-hidden">
          {/* Explicit per-cell borders instead of `divide-x`: in a 2-col mobile
              grid divide-x draws a stray line against the panel edge on row 2,
              and at lg it doubles with the cells' own border-r into 2px seams. */}
          <div className="grid grid-cols-2 gap-0 lg:grid-cols-4">
            <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
              <p className="text-sm text-secondary">All accounts</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
                {counts.total}
              </p>
            </div>
            <div className="border-b border-l border-line p-5 lg:border-b-0 lg:border-r">
              <p className="text-sm text-secondary">Students</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
                {counts.students}
              </p>
            </div>
            <div className="border-line p-5 lg:border-r">
              <p className="text-sm text-secondary">Mentors</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
                {counts.mentors}
              </p>
            </div>
            <div className="border-l border-line p-5 lg:border-l-0">
              <p className="text-sm text-secondary">Administrators</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">
                {counts.admins}
              </p>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Newest accounts" actions={<ButtonLink href="/admin/users" variant="ghost" size="sm">View all</ButtonLink>}>
        {!counts || counts.latest.length === 0 ? (
          <EmptyState icon={InboxIcon} title="No accounts yet" bordered={false} />
        ) : (
          <ul className="divide-y divide-line">
            {counts.latest.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {u.fullName}
                  </p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm text-secondary">{roleLabels[u.role]}</span>
                  <StatusBadge
                    tone={u.status === 'ACTIVE' ? 'success' : 'danger'}
                  >
                    {u.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                  </StatusBadge>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {formatDate(u.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
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
  return <AdminView />;
}