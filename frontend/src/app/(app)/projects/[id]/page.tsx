'use client';

// Project detail (Sprint 3 — FR-CAND-043): full definition view with the
// source-type label; milestones and tasks with dependencies.

import { use } from 'react';
import Link from 'next/link';
import {
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/components/ui';
import { useApiLoad } from '@/lib/use-async';
import { api } from '@/lib/api';
import { DIFFICULTY_LABEL, PROJECT_SOURCE_LABEL } from '@/lib/status';
import type { Project } from '@/types';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading, reload } = useApiLoad<Project>(() =>
    api.get<{ data: Project }>(`/api/projects/${id}`).then((r) => r.data)
  );

  if (loading) return <LoadingState label="Loading project…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const project = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-muted underline-offset-2 hover:underline">
          ← Project repository
        </Link>
      </div>
      <PageHeader
        title={project.title}
        subtitle={`${project.domain ? `${project.domain.name} · ` : ''}${DIFFICULTY_LABEL[project.difficulty]} · ${project.durationWeeks} weeks`}
        actions={
          <StatusBadge tone="neutral" dot={false}>
            {PROJECT_SOURCE_LABEL[project.sourceType]}
          </StatusBadge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="font-serif text-base font-semibold text-ink">Problem statement</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">
            {project.problemStatement}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-ink">Objectives</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-body">{project.objectives}</p>
          <h3 className="mt-4 text-sm font-semibold text-ink">Required skills</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {project.requiredSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-medium text-secondary"
              >
                {skill}
              </span>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-serif text-base font-semibold text-ink">Requirements</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-body">
            {project.requirements}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-ink">Expected deliverables</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-body">
            {project.expectedDeliverables}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-ink">Evaluation criteria</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-body">
            {project.evaluationCriteria}
          </p>
          <h3 className="mt-4 text-sm font-semibold text-ink">Submission guidelines</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-body">
            {project.submissionGuidelines}
          </p>
          {project.organizationName && (
            <p className="mt-4 text-sm text-secondary">
              Organization: {project.organizationName}
            </p>
          )}
        </Panel>
      </div>

      <h2 className="mb-3 mt-8 font-serif text-lg font-semibold text-ink">
        Milestones & tasks
      </h2>
      {(project.milestones ?? []).length === 0 && (
        <Panel>
          <p className="text-sm text-secondary">No milestones defined yet.</p>
        </Panel>
      )}
      <div className="space-y-4">
        {(project.milestones ?? []).map((milestone) => (
          <Panel key={milestone.id} padded={false}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h3 className="font-medium text-ink">
                {milestone.order}. {milestone.title}
              </h3>
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {milestone.isRequired ? 'Required' : 'Optional'}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {(milestone.tasks ?? []).map((task) => (
                <li key={task.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink">{task.title}</span>
                    <span className="text-xs text-muted">
                      due day {task.dueOffsetDays} ·{' '}
                      {task.isMandatory ? 'mandatory' : 'optional'} ·{' '}
                      {task.evidenceTypes.join(', ')}
                    </span>
                  </div>
                  {task.acceptanceCriteria && (
                    <p className="mt-1 text-secondary">{task.acceptanceCriteria}</p>
                  )}
                  {(task.dependencies?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-muted">
                      Prerequisites:{' '}
                      {task
                        .dependencies!.map((dep) => {
                          const all = (project.milestones ?? []).flatMap((m) => m.tasks ?? []);
                          const found = all.find((t) => t.id === dep.prerequisiteTaskId);
                          return found?.title ?? 'unknown task';
                        })
                        .join(', ')}
                    </p>
                  )}
                </li>
              ))}
              {(milestone.tasks ?? []).length === 0 && (
                <li className="px-5 py-3 text-sm text-muted">No tasks in this milestone.</li>
              )}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
