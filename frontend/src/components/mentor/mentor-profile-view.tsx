'use client';

// Mentor view of /profile: expertise, capacity and the mentor profile form.

import { useCallback, useEffect, useState } from 'react';
import { useApiErrorHandler } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { MentorProfile } from '@/types';
import { MentorProfileForm } from '@/components/mentor/mentor-profile-form';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from '@/components/ui';

export function MentorProfileView() {
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
