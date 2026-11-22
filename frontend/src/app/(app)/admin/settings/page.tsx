'use client';

// Platform settings (Sprint 6 — FR-CAND-107): view and change configurable
// parameters. Every change requires a reason and is audited server-side.

import { useState } from 'react';
import {
  Alert,
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  TextArea,
  TextInput,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { parseApiError } from '@/lib/form-errors';

interface SettingRow {
  key: string;
  value: string | number | boolean | string[];
  description: string;
  temp: boolean;
  /** P2-01: false = no runtime code consumes this key yet (OD-7 pending);
   * the control is rendered disabled so the UI never offers a no-op edit. */
  enforced: boolean;
}

function displayValue(value: SettingRow['value']): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export default function AdminSettingsPage() {
  const { data, error, loading, reload } = useApiLoad<SettingRow[]>(() =>
    api.get<{ data: SettingRow[] }>('/api/admin/settings').then((r) => r.data)
  );

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function save() {
    setActionError(null);
    setMessage(null);
    // P2-01: guard the number conversion — an empty field must never reach
    // the backend as `Number('') === 0` (for sessionInactivityTimeout that
    // value used to expire every session on the next request).
    const invalid: string[] = [];
    const changes = Object.entries(edits)
      .filter(([key, raw]) => isDirty(key, raw))
      .map(([key, raw]) => {
        const original = data?.find((row) => row.key === key);
        let value: string | number | boolean | string[] = raw;
        if (original) {
          if (typeof original.value === 'number') {
            const parsed = Number(raw);
            if (raw.trim() === '' || Number.isNaN(parsed)) {
              invalid.push(key);
              return null;
            }
            value = parsed;
          } else if (typeof original.value === 'boolean') {
            value = raw === 'true';
          } else if (Array.isArray(original.value)) {
            value = raw.split(',').map((item) => item.trim()).filter(Boolean);
          }
        }
        return { key, value, reason: reason.trim() };
      })
      .filter((change): change is { key: string; value: string | number | boolean | string[]; reason: string } => change !== null);
    if (invalid.length > 0) {
      setActionError(
        `Enter a valid value for: ${invalid.join(', ')} (empty fields are sent as nothing, not zero).`
      );
      return;
    }
    if (changes.length === 0) {
      // Every touched field was reverted to its current value.
      setEdits({});
      return;
    }

    setBusy(true);
    try {
      await api.put('/api/admin/settings', { changes });
      setMessage(`${changes.length} setting(s) updated and audited`);
      setEdits({});
      setReason('');
      reload();
    } catch (err) {
      setActionError(parseApiError(err).formError ?? 'The settings could not be saved');
    } finally {
      setBusy(false);
    }
  }

  const changedKeys = Object.entries(edits)
    .filter(([key, raw]) => isDirty(key, raw))
    .map(([key]) => key);

  // A touched field only counts as a change when its value actually differs
  // from the server value — reverting text must not produce an audit entry.
  function isDirty(key: string, raw: string): boolean {
    const original = data?.find((row) => row.key === key);
    if (!original) return true;
    if (typeof original.value === 'number') return Number(raw) !== original.value;
    if (typeof original.value === 'boolean') return (raw === 'true') !== original.value;
    if (Array.isArray(original.value)) {
      const arr = raw.split(',').map((item) => item.trim()).filter(Boolean);
      return arr.join('|') !== original.value.join('|');
    }
    return raw !== String(original.value);
  }

  return (
    <>
      <PageHeader
        title="Platform settings"
        subtitle="Configurable parameters. TEMP values were approved provisionally; every change requires a reason and is written to the audit log."
      />

      {message && (
        <div className="mb-4">
          <Alert variant="success">{message}</Alert>
        </div>
      )}
      {actionError && (
        <div className="mb-4">
          <Alert variant="error" title="Save failed">{actionError}</Alert>
        </div>
      )}

      {loading && <LoadingState label="Loading settings…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <div className="space-y-3">
            {data.map((setting) => (
              <Panel key={setting.key}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-ink">
                      {setting.key}
                      {setting.temp && (
                        <span className="ml-2 rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                          TEMP
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-secondary">{setting.description}</p>
                  </div>
                  <div className="w-full max-w-xs">
                    <TextInput
                      aria-label={`New value for ${setting.key}`}
                      value={edits[setting.key] ?? displayValue(setting.value)}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                      disabled={!setting.enforced}
                    />
                    <p className="mt-1 text-xs text-muted">
                      Current: {displayValue(setting.value)}
                      {!setting.enforced && ' · not yet enforced by the application (owner decision pending) — editing is disabled'}
                    </p>
                  </div>
                </div>
              </Panel>
            ))}
          </div>

          {changedKeys.length > 0 && (
            <Panel className="sticky bottom-4 mt-4 border-l-4 border-l-primary-600">
              <p className="text-sm font-medium text-ink">
                {changedKeys.length} unsaved change{changedKeys.length === 1 ? '' : 's'}
              </p>
              <div className="mt-2">
                <TextArea
                  aria-label="Reason for the changes"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for these changes (required, recorded in the audit log)"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" disabled={busy || reason.trim().length < 5} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEdits({})}>
                  Discard
                </Button>
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
