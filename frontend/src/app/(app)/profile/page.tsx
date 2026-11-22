'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth, useApiErrorHandler } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { MentorProfile, StudentProfile } from '@/types';
import {
  MentorProfileForm,
  StudentProfileForm,
} from '@/components/profile-forms';
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { InboxIcon } from '@/components/icons';
import { StudentChecklist } from '@/components/profile-checklist';

function StudentProfileView() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handleApiError = useApiErrorHandler();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        profile: StudentProfile | null;
        complete: boolean;
      }>('/api/profiles/student/me');
      setProfile(res.profile);
      setComplete(res.complete);
    } catch (err) {
      handleApiError(err);
      setError(err instanceof ApiError ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback(async (p: StudentProfile) => {
    setProfile(p);
    try {
      const res = await api.get<{ complete: boolean }>(
        '/api/profiles/student/me/complete'
      );
      setComplete(res.complete);
    } catch {
      // Keep the previous completeness value if the check fails.
    }
  }, []);

  if (loading) return <LoadingState label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="Required fields are needed for a complete profile."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
        {/* Form column */}
        <div className="lg:col-span-1">
          <StudentProfileForm
            initial={profile}
            onSaved={(p) => void handleSaved(p)}
          />
        </div>

        {/* Summary rail */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Panel title="Completeness">
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
                <StudentChecklist profile={profile} complete={complete} />
              ) : (
                <EmptyState
                  icon={InboxIcon}
                  title="No profile yet"
                  description="Create your student profile to get started."
                  bordered={false}
                />
              )}
            </Panel>
          </div>
        </aside>
      </div>

      {/* Mobile status strip */}
      <div className="lg:hidden">
        <Panel title="Completeness">
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
            <StudentChecklist profile={profile} complete={complete} />
          ) : (
            <EmptyState
              icon={InboxIcon}
              title="No profile yet"
              description="Create your student profile to get started."
              bordered={false}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}

function MentorProfileView() {
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const handleApiError = useApiErrorHandler();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ profile: MentorProfile | null }>(
        '/api/profiles/mentor/me'
      );
      setProfile(res.profile);
    } catch (err) {
      handleApiError(err);
      setError(err instanceof ApiError ? err.message : 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your profile"
        subtitle="This summary and capacity are used when administrators assign interns."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
        {/* Form column */}
        <div className="lg:col-span-1">
          <MentorProfileForm initial={profile} onSaved={setProfile} />
        </div>

        {/* Summary rail (≥ 1024 only) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <Panel title="At a glance">
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">Summary</span>
                  <span
                    className={`truncate font-medium ${
                      profile?.summary ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {profile?.summary ? 'Added' : 'Not added'}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">Capacity</span>
                  <span className="font-medium text-ink">
                    {profile?.maxActiveInterns ?? '—'}{' '}
                    {profile?.maxActiveInterns === 1 ? 'intern' : 'interns'}
                  </span>
                </li>
              </ul>
            </Panel>
          </div>
        </aside>
      </div>

      {/* Mobile status strip — mirrors the desktop rail (1024px+) so the
          mentor summary/capacity state is never lost below lg. */}
      <div className="lg:hidden">
        <Panel title="At a glance">
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted">Summary</span>
              <span
                className={`truncate font-medium ${
                  profile?.summary ? 'text-ink' : 'text-muted'
                }`}
              >
                {profile?.summary ? 'Added' : 'Not added'}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted">Capacity</span>
              <span className="font-medium text-ink">
                {profile?.maxActiveInterns ?? '—'}{' '}
                {profile?.maxActiveInterns === 1 ? 'intern' : 'interns'}
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function AdminProfileInfo() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="My account"
        subtitle="Administrator accounts don't have a profile."
      />
      <Panel title="Account">
        <dl className="divide-y divide-line text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Name</dt>
            <dd className="truncate font-medium text-ink">{user?.fullName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Email</dt>
            <dd className="truncate font-medium text-ink">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Role</dt>
            <dd className="font-medium text-ink">Administrator</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">Member since</dt>
            <dd className="font-medium text-ink">
  {user?.createdAt ? formatDate(user.createdAt) : '—'}
</dd>
          </div>
        </dl>
        <div className="mt-4 pt-4 border-t border-line">
          <ButtonLink href="/change-password">Change password</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      {user.role === 'STUDENT' && <StudentProfileView />}
      {user.role === 'MENTOR' && <MentorProfileView />}
      {user.role === 'ADMIN' && <AdminProfileInfo />}
    </div>
  );
}