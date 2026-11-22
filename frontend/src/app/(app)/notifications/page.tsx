'use client';

// Notification centre (Sprint 6 — FR-CAND-099): list, unread count,
// mark-one and mark-all read.

import Link from 'next/link';
import { useState } from 'react';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDateTime } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import type { AppNotification } from '@/types';

interface NotificationsPayload {
  data: AppNotification[];
  unreadCount: number;
}

export default function NotificationsPage() {
  const { data, error, loading, reload } = useApiLoad<NotificationsPayload>(() =>
    api.get<NotificationsPayload>('/api/notifications?limit=50')
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function markRead(notification: AppNotification) {
    setBusyId(notification.id);
    setMessage(null);
    try {
      await api.post(`/api/notifications/${notification.id}/read`, {});
      reload();
    } catch (err) {
      setMessage(apiErrorMessage(parseApiError(err), 'Could not update the notification.'));
    } finally {
      setBusyId(null);
    }
  }

  async function markAllRead() {
    setBusyId('all');
    setMessage(null);
    try {
      await api.post('/api/notifications/read-all', {});
      reload();
    } catch (err) {
      setMessage(apiErrorMessage(parseApiError(err), 'Could not update notifications.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={
          data && data.unreadCount > 0
            ? `${data.unreadCount} unread notification${data.unreadCount === 1 ? '' : 's'}`
            : 'Updates about your applications, tasks and certificates'
        }
        actions={
          data && data.unreadCount > 0 ? (
            <Button variant="secondary" size="sm" disabled={busyId === 'all'} onClick={() => { void markAllRead(); }}>
              {busyId === 'all' ? 'Marking…' : 'Mark all read'}
            </Button>
          ) : undefined
        }
      />

      {message && <Alert variant="error">{message}</Alert>}

      {loading && !data && <LoadingState label="Loading notifications…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.data.length === 0) && (
        <Panel>
          <EmptyState
            title="No notifications"
            description="Updates about your applications, tasks, evaluations and certificates will appear here."
          />
        </Panel>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((notification) => (
            <Panel key={notification.id} className={notification.isRead ? '' : 'border-l-4 border-l-primary-600'}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {notification.title}
                    {!notification.isRead && (
                      <>
                        <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-primary-600" aria-hidden="true" />
                        <span className="sr-only">(unread)</span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-secondary">{notification.message}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(notification.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      Open
                    </Link>
                  )}
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === notification.id}
                      onClick={() => { void markRead(notification); }}
                    >
                      {busyId === notification.id ? 'Marking…' : 'Mark read'}
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
