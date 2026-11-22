'use client';

// Audit log view (Sprint 6 — FR-CAND-105): read-only, filterable. There is
// deliberately no modify/delete function anywhere in the product.

import { useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Table,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types';

interface AuditFilters {
  action: string;
  entityType: string;
  actorId: string;
}

export default function AdminAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ action: '', entityType: '', actorId: '' });
  const [applied, setApplied] = useState<AuditFilters>({ action: '', entityType: '', actorId: '' });

  const { data, error, loading, reload } = useApiLoad<AuditLog[]>(
    () => {
      const params = new URLSearchParams({ limit: '50' });
      if (applied.action) params.set('action', applied.action);
      if (applied.entityType) params.set('entityType', applied.entityType);
      if (applied.actorId) params.set('actorId', applied.actorId);
      return api.get<{ data: AuditLog[] }>(`/api/admin/audit?${params.toString()}`).then((r) => r.data);
    },
    [applied.action, applied.entityType, applied.actorId]
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Read-only record of sensitive actions. Entries cannot be modified or deleted from anywhere in the product."
      />

      <Panel className="mb-6">
        <form
          className="grid gap-3 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(filters);
          }}
        >
          <Field label="Action contains" htmlFor="audit-action">
            <TextInput
              id="audit-action"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
              placeholder="e.g. CERTIFICATE"
            />
          </Field>
          <Field label="Entity type contains" htmlFor="audit-entity">
            <TextInput
              id="audit-entity"
              value={filters.entityType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))}
              placeholder="e.g. Internship"
            />
          </Field>
          <Field label="Actor ID" htmlFor="audit-actor">
            <TextInput
              id="audit-actor"
              value={filters.actorId}
              onChange={(e) => setFilters((prev) => ({ ...prev, actorId: e.target.value }))}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Apply
            </Button>
          </div>
        </form>
      </Panel>

      {loading && <LoadingState label="Loading audit entries…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (!data || data.length === 0) && (
        <Panel>
          <EmptyState title="No audit entries match" description="Adjust the filters." />
        </Panel>
      )}

      {data && data.length > 0 && (
        <Panel padded={false}>
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Reason / details</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <Td>{formatDateTime(entry.createdAt)}</Td>
                  <Td>{entry.actor?.fullName ?? 'system'}</Td>
                  <Td>
                    <span className="font-mono text-xs font-medium text-ink">{entry.action}</span>
                  </Td>
                  <Td className="text-xs text-secondary">
                    {entry.entityType}
                    <br />
                    <span className="text-muted">{entry.entityId}</span>
                  </Td>
                  <Td className="max-w-xs text-xs text-secondary">
                    {entry.reason ?? '—'}
                    {entry.newValue && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-primary-700">details</summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-subtle p-2 text-[11px] text-muted">
                          {entry.newValue}
                        </pre>
                      </details>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </>
  );
}
