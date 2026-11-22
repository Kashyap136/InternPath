'use client';

// Admin user management — only reachable/meaningful for ADMIN accounts.
// The server enforces authorization (requireRole('ADMIN')); this client-side
// role check is purely for navigation UX.
//
// All sensitive actions (suspend/reactivate, role change, password reset) go
// through a confirmation dialog with focus management, and the dialog stays
// open with an inline error if the action fails (spec §17, §12.16).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, useApiErrorHandler } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { parseApiError, type FieldErrors } from '@/lib/form-errors';
import type { AdminUserListItem, UserRole } from '@/types';
import {
  Alert,
  Button,
  ButtonLink,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Pagination,
  Panel,
  Select,
  StatusBadge,
  Td,
  TextArea,
  TextInput,
  Th,
  Table,
} from '@/components/ui';
import { KeyIcon, MailIcon, SearchIcon, UserPlusIcon } from '@/components/icons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleLabel(role: UserRole): string {
  return role === 'ADMIN'
    ? 'Administrator'
    : role === 'MENTOR'
      ? 'Mentor'
      : 'Student';
}

interface ListResponse {
  data: AdminUserListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface SecretResult {
  title: string;
  email: string;
  temporaryPassword: string;
  expiresAt?: string;
}

type PendingAction =
  | { kind: 'suspend'; row: AdminUserListItem }
  | { kind: 'reactivate'; row: AdminUserListItem }
  | { kind: 'reset'; row: AdminUserListItem }
  | { kind: 'role'; row: AdminUserListItem; role: UserRole };

function CopyButtonWithFeedback({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
      window.setTimeout(() => setState('idle'), 3000);
    }
  }

  if (state === 'copied') {
    return (
      <Button variant="secondary" size="sm" disabled className="text-success-text">
        Copied
      </Button>
    );
  }
  if (state === 'failed') {
    return (
      <span className="text-sm text-danger-text">
        Couldn&apos;t copy. Select the password and copy it manually.
      </span>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()}>
      Copy
    </Button>
  );
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const handleApiError = useApiErrorHandler();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

  const [secret, setSecret] = useState<SecretResult | null>(null);

  // Confirmation dialog
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // P2-05: set when the backend refused a suspend/demote because the mentor
  // still has active internships; the dialog then offers an explicit
  // "apply anyway" retry (force), pending owner decision OD-8.
  const [guardMessage, setGuardMessage] = useState<string | null>(null);
  const [forceRetry, setForceRetry] = useState(false);

  // Create-user panel
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('MENTOR');
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createSummaryRef = useRef<HTMLDivElement>(null);

  const resultsRef = useRef<HTMLParagraphElement>(null);
  const firstRender = useRef(true);

  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (roleFilter !== 'ALL') params.set('role', roleFilter);
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get<ListResponse>(
        `/api/auth/admin/users?${params.toString()}`
      );
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      handleApiError(err);
      setError(err instanceof ApiError ? err.message : 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search, handleApiError]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [load, isAdmin]);

  // After paginating, move focus to the results summary so keyboard and screen
  // reader users are not left at the bottom of the list (spec §20.3).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!loading) resultsRef.current?.focus();
  }, [page, loading]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col bg-canvas">
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink text-balance sm:text-3xl">
            You don&apos;t have access to this page
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary">
            User management is available to administrators only.
          </p>
          <ButtonLink href="/dashboard" className="mt-6">
            Go to dashboard
          </ButtonLink>
        </main>
      </div>
    );
  }

  function isSelf(id: string) {
    return user?.id === id;
  }

  async function confirmAction() {
    if (!pending) return;
    setConfirmError(null);

    if (pending.kind === 'suspend' && !suspendReason.trim()) {
      setConfirmError('Enter a reason for suspending this account.');
      return;
    }

    setConfirmBusy(true);
    setBusyId(pending.row.id);
    try {
      if (pending.kind === 'suspend' || pending.kind === 'reactivate') {
        await api.put(`/api/auth/admin/users/${pending.row.id}/suspend`, {
          reason: suspendReason.trim() || 'Reactivated by administrator',
          force: forceRetry || undefined,
        });
      } else if (pending.kind === 'role') {
        await api.put(`/api/auth/admin/users/${pending.row.id}/role`, {
          role: pending.role,
          force: forceRetry || undefined,
        });
      } else if (pending.kind === 'reset') {
        const res = await api.post<{
          temporaryPassword: string;
          expiresAt: string;
          message: string;
        }>('/api/auth/admin/reset-password', { email: pending.row.email });
        setSecret({
          title: 'Temporary password generated',
          email: pending.row.email,
          temporaryPassword: res.temporaryPassword,
          expiresAt: res.expiresAt,
        });
      }
      await load();
      setPending(null);
      setPendingRole(null);
      setSuspendReason('');
      setBusyId(null);
    } catch (err) {
      handleApiError(err);
      const message = err instanceof ApiError ? err.message : 'The action failed. Try again.';
      if (err instanceof ApiError && err.code === 'MENTOR_ACTIVE_INTERNSHIPS') {
        setGuardMessage(message);
      }
      setConfirmError(message);
    } finally {
      setConfirmBusy(false);
    }
  }

  function validateCreate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!newName.trim()) errors.newName = 'Enter the person’s full name.';
    if (!newEmail.trim()) errors.newEmail = 'Enter their email address.';
    else if (!EMAIL_PATTERN.test(newEmail.trim()))
      errors.newEmail = 'Enter a valid email address.';
    return errors;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreateError(null);

    const clientErrors = validateCreate();
    if (Object.keys(clientErrors).length > 0) {
      setCreateErrors(clientErrors);
      if (Object.keys(clientErrors).length >= 2) {
        window.requestAnimationFrame(() => createSummaryRef.current?.focus());
      } else {
        const id = Object.keys(clientErrors)[0]!;
        window.requestAnimationFrame(() =>
          document.getElementById(id)?.focus()
        );
      }
      return;
    }

    setCreateErrors({});
    setCreating(true);
    try {
      const res = await api.post<{
        temporaryPassword: string;
        user: { email: string };
        message: string;
      }>('/api/auth/admin/users', {
        fullName: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
      });
      setSecret({
        title: 'Temporary password generated',
        email: res.user.email,
        temporaryPassword: res.temporaryPassword,
      });
      setNewName('');
      setNewEmail('');
      setShowCreate(false);
      await load();
    } catch (err) {
      handleApiError(err);
      const parsed = parseApiError(err);
      const hasFieldErrors = Object.keys(parsed.fieldErrors).length > 0;
      if (hasFieldErrors) setCreateErrors(parsed.fieldErrors);
      const formLevel = parsed.formError ?? parsed.summaryErrors.join(' ');
      if (formLevel) setCreateError(formLevel);
    } finally {
      setCreating(false);
    }
  }

  const pendingRow = pending?.row ?? null;

  function roleControl(row: AdminUserListItem) {
    if (isSelf(row.id)) {
      return (
        <StatusBadge tone="neutral" dot={false}>
          {roleLabel(row.role)}
        </StatusBadge>
      );
    }
    const isPendingRole = pending?.kind === 'role' && pending.row.id === row.id;
    const displayRole = isPendingRole && pendingRole ? pendingRole : row.role;
    const isBusy = busyId === row.id || confirmBusy;
    return (
      <Select
        aria-label={`Change role for ${row.email}`}
        disabled={isBusy}
        value={displayRole}
        size="sm"
        onChange={(e) => {
          const role = e.target.value as UserRole;
          if (role !== row.role) {
            setPendingRole(role);
            setPending({ kind: 'role', row, role });
          }
        }}
        className="w-32"
      >
        <option value="STUDENT">Student</option>
        <option value="MENTOR">Mentor</option>
        <option value="ADMIN">Administrator</option>
      </Select>
    );
  }

  function actionButtons(row: AdminUserListItem) {
    const isActive = row.status === 'ACTIVE';
    const isBusy = busyId === row.id || confirmBusy;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isActive ? 'danger' : 'secondary'}
          size="sm"
          disabled={isBusy}
          onClick={() => {
            setBusyId(row.id);
            setPending({
              kind: isActive ? 'suspend' : 'reactivate',
              row,
            });
          }}
        >
          {isActive ? 'Suspend' : 'Reactivate'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() => {
            setBusyId(row.id);
            setPending({ kind: 'reset', row });
          }}
        >
          Reset password
        </Button>
      </div>
    );
  }

  const confirmTitle =
    pending?.kind === 'suspend'
      ? 'Suspend this account?'
      : pending?.kind === 'reactivate'
        ? 'Reactivate this account?'
        : pending?.kind === 'reset'
          ? 'Reset this password?'
          : 'Change this role?';

  const confirmLabel =
    pending?.kind === 'suspend'
      ? 'Suspend account'
      : pending?.kind === 'reactivate'
        ? 'Reactivate account'
        : pending?.kind === 'reset'
          ? 'Reset password'
          : 'Change role';

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        subtitle="Create accounts, adjust roles, and manage access. Every action is recorded in the audit log."
        actions={
          <Button onClick={() => setShowCreate((v) => !v)}>
            <UserPlusIcon className="h-4 w-4" />
            {showCreate ? 'Close' : 'Create user'}
          </Button>
        }
      />

      {secret && (
        <div
          className="rounded-xl border border-warning-border bg-warning-bg p-5"
          role="status"
          tabIndex={-1}
          ref={(el) => {
            if (el) el.focus();
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-warning-text">{secret.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-secondary">
                <MailIcon className="h-4 w-4 text-muted" />
                {secret.email}
              </p>
              <p className="mt-1 text-xs text-secondary">
                Share it with the user through a secure channel. It works for one sign-in
                {secret.expiresAt ? `, until ${formatDate(secret.expiresAt)}` : ''}. After signing in, they must set a new password.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-warning-border bg-warning-bg px-2.5 py-1.5 font-mono text-sm font-semibold text-warning-text">
                {secret.temporaryPassword}
              </code>
              <CopyButtonWithFeedback text={secret.temporaryPassword} />
              <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <Panel
          title="Create a mentor or administrator"
          subtitle="Accounts are created with a single-use temporary password."
        >
          <form className="space-y-5" onSubmit={(e) => void handleCreate(e)} noValidate>
            {createError && (
              <Alert variant="error" title="Could not create user">
                {createError}
              </Alert>
            )}
            {Object.keys(createErrors).length >= 2 && (
              <div ref={createSummaryRef} tabIndex={-1} className="focus:outline-hidden">
                <Alert variant="error" title="Fix the following:">
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {Object.entries(createErrors).map(([key, message]) => (
                      <li key={key}>
                        <a
                          href={`#${key}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {key === 'newName'
                            ? 'Full name'
                            : key === 'newEmail'
                              ? 'Email'
                              : key}
                        </a>
                        : {message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field
                label="Full name"
                htmlFor="newName"
                error={createErrors.newName}
              >
                <TextInput
                  id="newName"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jordan Lee"
                  readOnly={creating}
                  invalid={Boolean(createErrors.newName)}
                />
              </Field>
              <Field
                label="Email"
                htmlFor="newEmail"
                error={createErrors.newEmail}
              >
                <TextInput
                  id="newEmail"
                  type="email"
                  inputMode="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="jordan@example.com"
                  readOnly={creating}
                  invalid={Boolean(createErrors.newEmail)}
                />
              </Field>
              <Field label="Role" htmlFor="newRole">
                <Select
                  id="newRole"
                  value={newRole}
                  disabled={creating}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value="MENTOR">Mentor</option>
                  <option value="ADMIN">Administrator</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={creating}>
                {creating ? 'Creating…' : 'Create account'}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <Panel
        padded={false}
        title="Users"
        subtitle={
          meta
            ? `${meta.total} account${meta.total === 1 ? '' : 's'}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <TextInput
                  aria-label="Search by name or email"
                  placeholder="Search…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-40 sm:w-56 pl-9"
                />
              </div>
              <Button variant="secondary" type="submit" size="sm">
                Search
              </Button>
            </form>
            <Select
              aria-label="Filter by role"
              value={roleFilter}
              size="sm"
              onChange={(e) => {
                setRoleFilter(e.target.value as 'ALL' | UserRole);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="ALL">All roles</option>
              <option value="STUDENT">Students</option>
              <option value="MENTOR">Mentors</option>
              <option value="ADMIN">Administrators</option>
            </Select>
            <p className="self-center text-[13px] text-muted" aria-live="polite">
              {meta ? `${meta.total} accounts` : '0 accounts'}
            </p>
          </div>
        }
      >
        <p
          ref={resultsRef}
          tabIndex={-1}
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-40 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-panel"
        >
          {meta
            ? `Showing ${users.length} of ${meta.total} accounts.`
            : 'User list'}
        </p>

        {loading ? (
          <div className="p-5">
            <LoadingState label="Loading users…" />
          </div>
        ) : error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={() => void load()} />
          </div>
        ) : users.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={KeyIcon}
              title="No users match"
              description="Try a different search or filter."
            />
          </div>
        ) : (
          <>
            {/* Table — 768px and up */}
            <div className="hidden overflow-x-auto md:block">
              <Table caption="Accounts">
                <thead>
                  <tr className="border-y border-line">
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Created</Th>
                    <Th className="text-right" srOnly>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map((row) => {
                    const isActive = row.status === 'ACTIVE';
                    return (
                      <tr key={row.id} className="hover:bg-surface-subtle">
                        <Td>
                          <p className="font-medium text-ink">{row.fullName}</p>
                          <p className="truncate text-xs text-secondary">{row.email}</p>
                          {isSelf(row.id) && (
                            <span className="ml-1 text-xs text-muted">(you)</span>
                          )}
                        </Td>
                        <Td>{roleControl(row)}</Td>
                        <Td>
                          <StatusBadge tone={isActive ? 'success' : 'danger'}>
                            {isActive ? 'Active' : 'Suspended'}
                          </StatusBadge>
                        </Td>
                        <Td className="whitespace-nowrap text-muted">
                          {formatDate(row.createdAt)}
                        </Td>
                        <Td className="text-right">
                          {isSelf(row.id) ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <div className="flex justify-end">
                              {actionButtons(row)}
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Stacked cards — below 768px */}
            <ul className="divide-y divide-line md:hidden">
              {users.map((row) => {
                const isActive = row.status === 'ACTIVE';
                return (
                  <li key={row.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {row.fullName}
                          {isSelf(row.id) && (
                            <span className="ml-1 text-xs text-muted">(you)</span>
                          )}
                        </p>
                        <p className="truncate text-[13px] text-secondary">
                          {row.email}
                        </p>
                      </div>
                      <StatusBadge tone={isActive ? 'success' : 'danger'}>
                        {isActive ? 'Active' : 'Suspended'}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-muted">
                        {formatDate(row.createdAt)}
                      </span>
                      {roleControl(row)}
                    </div>
                    {!isSelf(row.id) && (
                      <div className="pt-1">{actionButtons(row)}</div>
                    )}
                  </li>
                );
              })}
            </ul>

            {meta && (
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                noun="accounts"
                disabled={loading}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            )}
          </>
        )}
      </Panel>

      {/* Sensitive-action confirmation */}
      <ConfirmDialog
        open={Boolean(pending && pendingRow)}
        title={confirmTitle}
        description={
          pendingRow ? (
            <>
              <strong className="font-medium text-ink">
                {pendingRow.fullName}
              </strong>{' '}
              ({pendingRow.email})
              {pending?.kind === 'suspend' &&
                ' will be suspended — they will be signed out and unable to sign in again.'}
              {pending?.kind === 'reactivate' &&
                ' will be reactivated and able to sign in again.'}
              {pending?.kind === 'reset' &&
                ' will be signed out everywhere and must set a new password at next sign-in.'}
              {pending?.kind === 'role' &&
                ` will be changed to ${roleLabel(pending.role)}.`}
            </>
          ) : undefined
        }
        confirmLabel={confirmLabel}
        confirmVariant={pending?.kind === 'suspend' ? 'danger' : 'primary'}
        busy={confirmBusy}
        error={confirmError}
        confirmDisabled={
          pending?.kind === 'suspend' && !suspendReason.trim()
        }
        onConfirm={() => void confirmAction()}
        onCancel={() => {
          setPending(null);
          setPendingRole(null);
          setSuspendReason('');
          setConfirmError(null);
          setGuardMessage(null);
          setForceRetry(false);
          setBusyId(null);
        }}
      >
        {pending?.kind === 'suspend' && (
          <Field
            label="Reason for suspension"
            htmlFor="suspendReason"
            hint="Recorded in the audit log. The user does not see it."
          >
            <TextArea
              id="suspendReason"
              rows={3}
              maxLength={500}
              required
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Repeated policy violations"
            />
          </Field>
        )}
        {guardMessage && (
          <div className="mt-3 rounded-lg border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
            <p>{guardMessage}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={confirmBusy}
              onClick={() => {
                setForceRetry(true);
                setGuardMessage(null);
                void confirmAction();
              }}
            >
              Apply anyway
            </Button>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
