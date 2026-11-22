'use client';

// Admin: program management (SRS FR-CAND-018/019/020).
// Create OPEN/DRAFT programs, walk the DRAFT→OPEN→CLOSED→ARCHIVED states,
// and enforce deadline-first rules — every mutation is re-validated server-side.

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Select,
  StatusBadge,
  TextInput,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { formatDate } from '@/lib/format';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import { PROGRAM_STATUS_LABEL, PROGRAM_STATUS_TONE } from '@/lib/status';
import type { Domain, PaginatedResponse, Program, ProgramStatus } from '@/types';

const STATUS_TONE = PROGRAM_STATUS_TONE;

// Legal status moves (server-enforced; mirrored here for affordances only).
// Phase 7 audit fix: mirror corrected to match program.service changeStatus —
// DRAFT can only OPEN or ARCHIVE; CLOSED can only ARCHIVE (the previous mirror
// offered DRAFT→CLOSED and CLOSED→OPEN, which the server always rejects).
const NEXT_STATUSES: Record<ProgramStatus, ProgramStatus[]> = {
  DRAFT: ['OPEN', 'ARCHIVED'],
  OPEN: ['CLOSED', 'ARCHIVED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

export default function AdminProgramsPage() {
  const domains = useApiLoad<Domain[]>(() =>
    api.get<{ data: Domain[] }>('/api/admin/domains').then((r) => r.data)
  );
  const programs = useApiLoad<PaginatedResponse<Program>>(() =>
    api.get<PaginatedResponse<Program>>('/api/admin/programs?limit=50')
  );

  const [form, setForm] = useState({
    title: '',
    domainId: '',
    durationWeeks: '4',
    level: 'BEGINNER',
    requiredLevel: '',
    seats: '2',
    applicationDeadline: '',
    startDate: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const createProgram = async () => {
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);
    // Client-side validation: the dates are parsed synchronously below, so an
    // unfilled form must fail with concrete guidance — never a thrown
    // RangeError that parseApiError would mislabel as a connectivity problem.
    let validationError: string | null =
      !form.title.trim() ? 'Program title is required.' : null;
    if (!validationError && !form.domainId) {
      validationError = 'Choose the domain this program belongs to.';
    }
    if (!validationError) {
      const deadline = new Date(form.applicationDeadline);
      const start = new Date(form.startDate);
      if (Number.isNaN(deadline.getTime()) || form.applicationDeadline === '') {
        validationError = 'Application deadline is required (must be a future date).';
      } else if (Number.isNaN(start.getTime()) || form.startDate === '') {
        validationError = 'Start date is required.';
      } else if (deadline.getTime() > start.getTime()) {
        validationError = 'The deadline must be before the start date.';
      }
    }
    if (validationError) {
      setFormError(validationError);
      setCreating(false);
      return;
    }
    try {
      await api.post('/api/admin/programs', {
        title: form.title.trim(),
        domainId: form.domainId,
        durationWeeks: Number(form.durationWeeks),
        level: form.level.trim(),
        requiredLevel: form.requiredLevel.trim() ? form.requiredLevel.trim() : undefined,
        seats: Number(form.seats),
        applicationDeadline: new Date(form.applicationDeadline).toISOString(),
        startDate: new Date(form.startDate).toISOString(),
      });
      setFormSuccess('Program created. Set it to OPEN when it should accept applications.');
      setForm((f) => ({ ...f, title: '' }));
      programs.reload();
    } catch (err) {
      setFormError(apiErrorMessage(parseApiError(err), 'Cannot create the program.'));
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (program: Program, status: ProgramStatus) => {
    setBusyId(program.id);
    setRowError(null);
    try {
      await api.put(`/api/admin/programs/${program.id}/status`, { status });
      programs.reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setRowError(
        parsed.formError ?? (err instanceof Error ? err.message : 'Cannot change the status.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const domainError = domains.error ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        subtitle="Create and manage internship programs and their lifecycle state."
      />

      <Panel title="Create a program" subtitle="Deadline must be in the future and before the start date.">
        {formSuccess ? (
          <Alert variant="success" title="Created">
            {formSuccess}
          </Alert>
        ) : null}
        {formError ? (
          <Alert variant="error" title="Cannot create">
            {formError}
          </Alert>
        ) : null}
        {domainError ? (
          <Alert variant="warning" title="Domains unavailable">
            Load a domain list first —{domainError}
          </Alert>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void createProgram();
          }}
          className="grid gap-4 sm:grid-cols-2"
          noValidate
        >
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="p-title">
              <TextInput
                id="p-title"
                value={form.title}
                maxLength={200}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Frontend Internship — Winter cohort"
                required
              />
            </Field>
          </div>
          <Field label="Domain" htmlFor="p-domain">
            <Select
              id="p-domain"
              value={form.domainId}
              onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value }))}
              required
            >
              <option value="">Select a domain…</option>
              {(domains.data ?? [])
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Duration" htmlFor="p-duration">
            <Select
              id="p-duration"
              value={form.durationWeeks}
              onChange={(e) => setForm((f) => ({ ...f, durationWeeks: e.target.value }))}
            >
              {[2, 4, 6, 8].map((w) => (
                <option key={w} value={String(w)}>
                  {w} weeks
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level (target cohort)" htmlFor="p-level">
            <Select
              id="p-level"
              value={form.level}
              onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
            </Select>
          </Field>
          <Field label="Required level (optional)" htmlFor="p-required" hint="Defaults to the target level.">
            <Select
              id="p-required"
              value={form.requiredLevel}
              onChange={(e) => setForm((f) => ({ ...f, requiredLevel: e.target.value }))}
            >
              <option value="">Same as level</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
            </Select>
          </Field>
          <Field label="Seats" htmlFor="p-seats">
            <TextInput
              id="p-seats"
              type="number"
              min={1}
              step={1}
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: e.target.value }))}
              required
            />
          </Field>
          <Field label="Application deadline" htmlFor="p-deadline">
            <TextInput
              id="p-deadline"
              type="datetime-local"
              value={form.applicationDeadline}
              onChange={(e) => setForm((f) => ({ ...f, applicationDeadline: e.target.value }))}
              required
            />
          </Field>
          <Field label="Start date" htmlFor="p-start">
            <TextInput
              id="p-start"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create program'}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="All programs">
        {programs.loading ? (
          <LoadingState label="Loading programs…" />
        ) : programs.error ? (
          <ErrorState message={programs.error} onRetry={programs.reload} />
        ) : (programs.data?.data ?? []).length === 0 ? (
          <EmptyState bordered={false} title="No programs yet" description="Create the first program above." />
        ) : (
          <>
            {rowError ? (
              <Alert variant="error" title="Status change failed">
                {rowError}
              </Alert>
            ) : null}
            <ul className="divide-y divide-neutral-border">
              {programs.data?.data.map((program) => (
                <li key={program.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* DRAFT programs are hidden from the public detail
                          endpoint (BE-11), so only published states link
                          there; drafts are managed from this list. */}
                      {program.status === 'DRAFT' ? (
                        <span className="font-medium text-ink">{program.title}</span>
                      ) : (
                        <Link
                          href={`/programs/${program.id}`}
                          className="font-medium text-ink underline-offset-2 hover:underline"
                        >
                          {program.title}
                        </Link>
                      )}
                      <StatusBadge tone={STATUS_TONE[program.status]}>
                        {PROGRAM_STATUS_LABEL[program.status]}
                      </StatusBadge>
                    </div>
                    <div className="text-sm text-muted">
                      {program.domain?.name} · {program.durationWeeks} weeks ·{' '}
                      {program.seats} seats · apply by {formatDate(program.applicationDeadline)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {NEXT_STATUSES[program.status].map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={status === 'ARCHIVED' ? 'danger' : 'secondary'}
                        disabled={busyId === program.id}
                        onClick={() => void changeStatus(program, status)}
                      >
                        {busyId === program.id ? '…' : `Mark ${status.toLowerCase()}`}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}