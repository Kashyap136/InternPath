'use client';

// Admin: domain + skill + question-bank management (SRS FR-CAND-017/022).
// Deactivating a domain keeps linked records intact (FR-CAND-017), matching
// the backend's deactivate endpoint. Question editing lives on
// /admin/questions which selects a domain first (the question bank is
// domain-scoped with one skill per question).

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  TextInput,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useApiLoad } from '@/lib/use-async';
import { apiErrorMessage, parseApiError } from '@/lib/form-errors';
import type { Domain, Skill } from '@/types';

type DomainWithSkills = Domain & { skills: Skill[] };

interface Draft {
  kind: 'domain' | 'skill';
  domainId?: string;
  domain?: Domain;
  skill?: Skill;
}

export default function AdminDomainsPage() {
  const domains = useApiLoad<DomainWithSkills[]>(() =>
    api
      .get<{ data: DomainWithSkills[] }>('/api/admin/domains')
      .then((r) => r.data)
  );

  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDescription, setNewDomainDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [skillDrafts, setSkillDrafts] = useState<Record<string, { name: string; description: string }>>({});
  const [skillError, setSkillError] = useState<string | null>(null);
  const [busySkillDomain, setBusySkillDomain] = useState<string | null>(null);

  const [pending, setPending] = useState<Draft | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const createDomain = async () => {
    if (newDomainName.trim().length === 0) {
      setCreateError('A domain name is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/api/admin/domains', {
        name: newDomainName.trim(),
        description: newDomainDescription.trim() || undefined,
      });
      setNewDomainName('');
      setNewDomainDescription('');
      domains.reload();
    } catch (err) {
      setCreateError(apiErrorMessage(parseApiError(err), 'Cannot create the domain.'));
    } finally {
      setCreating(false);
    }
  };

  const createSkill = async (domainId: string) => {
    const draft = skillDrafts[domainId];
    if (!draft || draft.name.trim().length === 0) {
      setSkillError('A skill name is required.');
      return;
    }
    setBusySkillDomain(domainId);
    setSkillError(null);
    try {
      await api.post(`/api/admin/domains/${domainId}/skills`, {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
      });
      setSkillDrafts((d) => ({ ...d, [domainId]: { name: '', description: '' } }));
      domains.reload();
    } catch (err) {
      setSkillError(apiErrorMessage(parseApiError(err), 'Cannot create the skill.'));
    } finally {
      setBusySkillDomain(null);
    }
  };

  const confirmPending = async () => {
    if (!pending) return;
    setPendingBusy(true);
    setPendingError(null);
    try {
      if (pending.kind === 'domain' && pending.domain) {
        await api.put(`/api/admin/domains/${pending.domain.id}/deactivate`, {});
      } else if (pending.kind === 'skill' && pending.skill) {
        await api.delete(`/api/admin/skills/${pending.skill.id}`);
      }
      setPending(null);
      domains.reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setPendingError(
        parsed.formError ?? (err instanceof Error ? err.message : 'The action failed.')
      );
    } finally {
      setPendingBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Domains & skills"
        subtitle="Manage technical domains, their skills and the assessment question bank."
      />

      <Panel title="Create a domain">
        {createError ? (
          <Alert variant="error" title="Cannot create">
            {createError}
          </Alert>
        ) : null}
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void createDomain();
          }}
          noValidate
        >
          <Field label="Name" htmlFor="d-name">
            <TextInput
              id="d-name"
              value={newDomainName}
              maxLength={100}
              onChange={(e) => setNewDomainName(e.target.value)}
              placeholder="e.g. Frontend Development"
              required
            />
          </Field>
          <Field label="Description" htmlFor="d-desc">
            <TextInput
              id="d-desc"
              value={newDomainDescription}
              maxLength={500}
              onChange={(e) => setNewDomainDescription(e.target.value)}
              placeholder="What this domain covers"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create domain'}
            </Button>
          </div>
        </form>
      </Panel>

      {domains.loading ? (
        <LoadingState label="Loading domains…" />
      ) : domains.error ? (
        <ErrorState message={domains.error} onRetry={domains.reload} />
      ) : (domains.data ?? []).length === 0 ? (
        <EmptyState title="No domains" description="Create the first domain above." />
      ) : (
        <div className="space-y-4">
          {domains.data?.map((domain) => {
            const draft = skillDrafts[domain.id] ?? { name: '', description: '' };
            return (
              <Panel
                key={domain.id}
                title={domain.name}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={domain.isActive ? 'success' : 'neutral'}>
                      {domain.isActive ? 'Active' : 'Deactivated'}
                    </StatusBadge>
                    <Link
                      href={`/admin/questions?domainId=${domain.id}`}
                      className="text-sm font-medium text-primary-600 underline-offset-2 hover:underline"
                    >
                      Question bank →
                    </Link>
                    {domain.isActive ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setPendingError(null);
                          setPending({ kind: 'domain', domain });
                        }}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                }
              >
                {domain.description ? (
                  <p className="text-sm text-muted">{domain.description}</p>
                ) : null}

                <div className="mt-3">
                  <h3 className="text-sm font-medium text-ink">Skills</h3>
                  {domain.skills.length === 0 ? (
                    <p className="text-sm text-muted">No skills yet.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-neutral-border rounded-lg border border-neutral-border">
                      {domain.skills.map((skill) => (
                        <li key={skill.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink">{skill.name}</div>
                            {skill.description ? (
                              <div className="text-xs text-muted">{skill.description}</div>
                            ) : null}
                          </div>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setPendingError(null);
                              setPending({ kind: 'skill', skill, domainId: domain.id });
                            }}
                          >
                            Delete
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {skillError ? (
                    <Alert variant="warning" title="Skill action failed">
                      {skillError}
                    </Alert>
                  ) : null}
                  {domain.isActive ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <TextInput
                        value={draft.name}
                        placeholder="New skill name"
                        maxLength={100}
                        onChange={(e) =>
                          setSkillDrafts((d) => ({
                            ...d,
                            [domain.id]: { ...draft, name: e.target.value },
                          }))
                        }
                        aria-label={`New skill name for ${domain.name}`}
                      />
                      <TextInput
                        value={draft.description}
                        placeholder="Description (optional)"
                        maxLength={500}
                        onChange={(e) =>
                          setSkillDrafts((d) => ({
                            ...d,
                            [domain.id]: { ...draft, description: e.target.value },
                          }))
                        }
                        aria-label={`New skill description for ${domain.name}`}
                      />
                      <Button
                        size="sm"
                        disabled={busySkillDomain === domain.id}
                        onClick={() => void createSkill(domain.id)}
                        className="shrink-0"
                      >
                        {busySkillDomain === domain.id ? 'Adding…' : 'Add skill'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending
            ? pending.kind === 'domain'
              ? `Deactivate "${pending.domain?.name}"?`
              : `Delete skill "${pending.skill?.name}"?`
            : ''
        }
        description={
          pending?.kind === 'domain'
            ? 'Deactivated domains stop being selectable for new programs and new assessments. Existing records stay intact.'
            : 'Deleting a skill removes it from the domain\u2019s assessment structure. Questions referencing it may block the deletion \u2014 the server will explain why if so.'
        }
        confirmLabel={pending?.kind === 'domain' ? 'Deactivate' : 'Delete skill'}
        confirmVariant="danger"
        busy={pendingBusy}
        error={pendingError ?? undefined}
        onConfirm={() => void confirmPending()}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}