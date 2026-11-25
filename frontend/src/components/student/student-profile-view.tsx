'use client';

// Student view of /profile: completion checklist plus the student profile form.

import { useCallback, useEffect, useState } from 'react';
import { useApiErrorHandler } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import type { StudentProfile } from '@/types';
import { StudentProfileForm } from '@/components/student/student-profile-form';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { InboxIcon } from '@/components/icons';
import { StudentChecklist } from '@/components/student/profile-checklist';

export function StudentProfileView() {
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
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
