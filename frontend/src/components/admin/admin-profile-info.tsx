'use client';

// Administrator view of /profile: account details (admins have no role profile).

import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { ButtonLink, PageHeader, Panel } from '@/components/ui';

export function AdminProfileInfo() {
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
