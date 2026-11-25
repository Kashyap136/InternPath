// Non-destructive importer for the InternPath opportunity content packages.
//
//   npx tsx scripts/content-import-opportunities.ts                       # dry run, 2027 summer package
//   npx tsx scripts/content-import-opportunities.ts --package=portfolio   # dry run, 25-project portfolio package
//   ... --apply                                                           # create missing DRAFT records
//   ... --apply --publish        # also submit → approve → publish each project (students can read the brief)
//   ... --apply --open-programs  # also move DRAFT programs to OPEN (applications start!) — only once
//                                #   real mentors with capacity exist for every domain
//
// Packages: summer (prisma/content/opportunities-2027-summer.ts, default) and
// portfolio (prisma/content/opportunities-2027-portfolio.ts).
// Cohort dates can be overridden for newly created programs with
// INTERNPATH_COHORT_DEADLINE and INTERNPATH_COHORT_START (ISO-8601, UTC).
//
// What it does
//  - Talks ONLY to the InternPath HTTP API (the supported mechanism: the same
//    validators, business rules and audit logging as the admin UI). It never
//    touches the database directly.
//  - Creates Programs (always DRAFT, the API default) and Project drafts with
//    their milestones, tasks and task dependencies.
//  - Idempotent: records are matched by exact title. Existing programs are
//    never modified. An existing project is reconciled (missing milestones,
//    tasks and dependencies added) only while it is still DRAFT; anything
//    beyond DRAFT is left untouched.
//  - Without --publish / --open-programs it NEVER opens a program or
//    submits/approves/publishes a project. It never deletes anything or
//    touches users/applications/internships.
//
// Guards
//  - --apply requires INTERNPATH_CONTENT_IMPORT_CONFIRM=<CONTENT_PACKAGE_ID>.
//  - Refuses when /health reports environment=production unless
//    --allow-production is also passed.
//  - Refuses an @internpath.demo author account unless --allow-demo-author is
//    passed. Real content in a real environment should be authored by a real
//    InternPath administrator account, because the author name is shown on
//    projects.
//  - Credentials come from the environment, never from this file:
//      INTERNPATH_API_URL                (default http://localhost:4000)
//      INTERNPATH_IMPORT_ADMIN_EMAIL
//      INTERNPATH_IMPORT_ADMIN_PASSWORD
//  - Stops immediately on HTTP 429 (rate limit). Re-running resumes safely.
//
// Rollback (manual, owner-approved only): DRAFT programs can be moved to
// ARCHIVED in Admin > Programs. Project drafts stay invisible to students
// while DRAFT. There is deliberately no delete step in this script.

import * as summerPackage from '../prisma/content/opportunities-2027-summer';
import * as portfolioPackage from '../prisma/content/opportunities-2027-portfolio';
import type { OpportunityContent } from '../prisma/content/opportunities-2027-summer';

const PACKAGES = { summer: summerPackage, portfolio: portfolioPackage } as const;

const argv = process.argv.slice(2);
const args = new Set(argv);
const APPLY = args.has('--apply');
const PUBLISH = args.has('--publish');
const OPEN_PROGRAMS = args.has('--open-programs');
const ALLOW_PRODUCTION = args.has('--allow-production');
const ALLOW_DEMO_AUTHOR = args.has('--allow-demo-author');
const PACKAGE_NAME = (argv.find((a) => a.startsWith('--package='))?.split('=')[1] ?? 'summer') as keyof typeof PACKAGES;
if (!(PACKAGE_NAME in PACKAGES)) {
  console.error(`Unknown --package=${PACKAGE_NAME}. Use one of: ${Object.keys(PACKAGES).join(', ')}`);
  process.exit(1);
}
const { CONTENT_PACKAGE_ID, OPPORTUNITIES } = PACKAGES[PACKAGE_NAME];
const COHORT = {
  applicationDeadline: process.env.INTERNPATH_COHORT_DEADLINE ?? PACKAGES[PACKAGE_NAME].COHORT.applicationDeadline,
  startDate: process.env.INTERNPATH_COHORT_START ?? PACKAGES[PACKAGE_NAME].COHORT.startDate,
};
const API = (process.env.INTERNPATH_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
// Delay between requests. Raise it on shared deployments: all browser traffic
// arrives through one proxy and shares the global rate-limit budget.
const PACE_MS = Number(process.env.INTERNPATH_IMPORT_PACE_MS ?? 120);

let cookie = '';
let requestCount = 0;

class StopError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  await sleep(PACE_MS);
  requestCount += 1;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const match = /(?:^|,\s*)session=([^;]+)/.exec(setCookie);
    if (match) cookie = `session=${match[1]}`;
  }
  if (res.status === 429) {
    throw new StopError(`Rate limited (HTTP 429) after ${requestCount} requests on ${method} ${path}. Wait for the window to reset, then re-run; the import resumes idempotently.`);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json: json as T };
}

function expectStatus(r: { status: number; json: unknown }, ok: number[], what: string): void {
  if (!ok.includes(r.status)) {
    const msg = (r.json as { message?: string; error?: string } | null) ?? {};
    throw new StopError(`${what} failed: HTTP ${r.status} ${msg.error ?? ''} ${msg.message ?? ''}`.trim());
  }
}

interface Paged<T> { data: T[]; meta?: { totalPages?: number } }

async function listAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await call<Paged<T>>('GET', `${path}${sep}page=${page}&limit=100`);
    expectStatus(r, [200], `GET ${path}`);
    out.push(...r.json.data);
    if (!r.json.meta?.totalPages || page >= r.json.meta.totalPages) break;
  }
  return out;
}

interface ProjectDetail {
  id: string;
  title: string;
  status: string;
  milestones: Array<{
    id: string;
    title: string;
    tasks: Array<{ id: string; title: string; dependencies: Array<{ prerequisiteTaskId: string }> }>;
  }>;
}

const summary: Array<Record<string, string>> = [];

async function importOpportunity(o: OpportunityContent, domainId: string, existingPrograms: Map<string, { id: string; status: string }>, existingProjects: Map<string, { id: string; status: string }>) {
  const row: Record<string, string> = { key: o.key };

  // ---- Program (DRAFT) ----
  const prog = existingPrograms.get(o.program.title);
  let programRef: { id: string; status: string } | null = prog ?? null;
  if (prog) {
    row.program = `exists ${prog.id} (${prog.status}) — not modified`;
  } else if (!APPLY) {
    row.program = 'would create (DRAFT)';
  } else {
    const r = await call<{ data: { id: string; status: string } }>('POST', '/api/admin/programs', {
      title: o.program.title,
      domainId,
      durationWeeks: o.program.durationWeeks,
      level: o.program.level,
      seats: o.program.seats,
      applicationDeadline: COHORT.applicationDeadline,
      startDate: COHORT.startDate,
    });
    expectStatus(r, [201], `create program "${o.program.title}"`);
    if (r.json.data.status !== 'DRAFT') throw new StopError(`Program ${r.json.data.id} was not created as DRAFT`);
    row.program = `created ${r.json.data.id} (DRAFT)`;
    programRef = { id: r.json.data.id, status: 'DRAFT' };
  }
  if (OPEN_PROGRAMS) row.program += ` · ${await openProgram(programRef)}`;

  // ---- Project (DRAFT) ----
  const existing = existingProjects.get(o.project.title);
  let projectId: string | null = null;
  if (existing) {
    if (existing.status !== 'DRAFT') {
      row.project = `exists ${existing.id} (${existing.status}) — beyond DRAFT, structure not touched`;
      if (PUBLISH) row.publish = await publishProject(existing.id, existing.status);
      summary.push(row);
      return;
    }
    projectId = existing.id;
    row.project = `exists ${existing.id} (DRAFT) — reconciling structure`;
  } else if (!APPLY) {
    const taskCount = o.milestones.reduce((n, m) => n + m.tasks.length, 0);
    row.project = `would create (DRAFT) with ${o.milestones.length} milestones / ${taskCount} tasks`;
    summary.push(row);
    return;
  } else {
    const r = await call<{ data: { id: string; status: string } }>('POST', '/api/projects', { ...o.project, domainId });
    expectStatus(r, [201], `create project "${o.project.title}"`);
    projectId = r.json.data.id;
    row.project = `created ${projectId} (DRAFT)`;
  }

  const detailRes = await call<{ data: ProjectDetail }>('GET', `/api/projects/${projectId}`);
  expectStatus(detailRes, [200], 'read project');
  const detail = detailRes.json.data;

  const taskIdByKey = new Map<string, string>();
  const existingEdges = new Set<string>();
  const created = { milestones: 0, tasks: 0, deps: 0 };

  for (const m of o.milestones) {
    let milestone = detail.milestones.find((x) => x.title === m.title);
    if (!milestone) {
      if (!APPLY) continue;
      const r = await call<{ data: { id: string } }>('POST', `/api/projects/${projectId}/milestones`, {
        title: m.title, description: m.description, order: m.order, isRequired: m.isRequired,
      });
      expectStatus(r, [201], `create milestone "${m.title}"`);
      milestone = { id: r.json.data.id, title: m.title, tasks: [] };
      created.milestones += 1;
    }
    for (const t of m.tasks) {
      const found = milestone.tasks.find((x) => x.title === t.title);
      if (found) {
        taskIdByKey.set(t.key, found.id);
        for (const d of found.dependencies) existingEdges.add(`${found.id}<-${d.prerequisiteTaskId}`);
        continue;
      }
      if (!APPLY) continue;
      const r = await call<{ data: { id: string } }>('POST', `/api/projects/${projectId}/milestones/${milestone.id}/tasks`, {
        title: t.title, description: t.description, acceptanceCriteria: t.acceptanceCriteria,
        isMandatory: t.isMandatory, evidenceTypes: t.evidenceTypes, dueOffsetDays: t.dueOffsetDays, order: t.order,
      });
      expectStatus(r, [201], `create task "${t.title}"`);
      taskIdByKey.set(t.key, r.json.data.id);
      created.tasks += 1;
    }
  }

  if (APPLY) {
    const fresh = await call<{ data: ProjectDetail }>('GET', `/api/projects/${projectId}`);
    expectStatus(fresh, [200], 're-read project');
    for (const m of o.milestones) {
      const milestone = fresh.json.data.milestones.find((x) => x.title === m.title);
      if (!milestone) throw new StopError(`milestone "${m.title}" missing after creation`);
      for (const t of m.tasks) {
        const taskId = taskIdByKey.get(t.key);
        for (const depKey of t.dependsOn ?? []) {
          const prereqId = taskIdByKey.get(depKey);
          if (!taskId || !prereqId) throw new StopError(`dependency ${t.key} -> ${depKey} unresolved`);
          if (existingEdges.has(`${taskId}<-${prereqId}`)) continue;
          const r = await call('POST', `/api/projects/${projectId}/milestones/${milestone.id}/tasks/${taskId}/dependencies`, { prerequisiteTaskId: prereqId });
          expectStatus(r, [201, 409], `add dependency ${t.key} -> ${depKey}`);
          if (r.status === 201) created.deps += 1;
        }
      }
    }
  }
  row.structure = APPLY
    ? `+${created.milestones} milestones, +${created.tasks} tasks, +${created.deps} dependencies`
    : 'existing draft — dry run, no structure changes';
  if (PUBLISH) row.publish = await publishProject(projectId!, 'DRAFT');
  summary.push(row);
}

/** --publish: DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED via the admin API. */
async function publishProject(id: string, status: string): Promise<string> {
  if (status === 'PUBLISHED') return 'already PUBLISHED';
  if (status === 'ARCHIVED') return 'ARCHIVED — left alone';
  if (!APPLY) return `would publish (from ${status})`;
  let current = status;
  if (current === 'DRAFT') {
    const r = await call('POST', `/api/projects/${id}/submit`);
    expectStatus(r, [200, 201], `submit project ${id}`);
    current = 'PENDING_REVIEW';
  }
  if (current === 'PENDING_REVIEW') {
    const r = await call('POST', `/api/admin/projects/${id}/review`, {
      decision: 'APPROVED',
      comments: `Approved on import of content package ${CONTENT_PACKAGE_ID}`,
    });
    expectStatus(r, [200, 201], `approve project ${id}`);
    current = 'APPROVED';
  }
  if (current === 'APPROVED') {
    const r = await call('POST', `/api/admin/projects/${id}/publish`);
    expectStatus(r, [200, 201], `publish project ${id}`);
    return 'PUBLISHED';
  }
  return `left at ${current}`;
}

/** --open-programs: DRAFT → OPEN (applications start). */
async function openProgram(program: { id: string; status: string } | null): Promise<string> {
  if (!program) return 'would open';
  if (program.status !== 'DRAFT') return `left at ${program.status}`;
  if (!APPLY) return 'would open';
  const r = await call('PUT', `/api/admin/programs/${program.id}/status`, { status: 'OPEN' });
  expectStatus(r, [200], `open program ${program.id}`);
  return 'OPEN';
}

async function main(): Promise<void> {
  console.log(`InternPath content import — package ${CONTENT_PACKAGE_ID} — ${APPLY ? 'APPLY' : 'DRY RUN'}${PUBLISH ? ' +publish' : ''}${OPEN_PROGRAMS ? ' +open-programs' : ''} — target ${API}`);
  console.log(`Cohort for new programs: deadline ${COHORT.applicationDeadline}, start ${COHORT.startDate}`);

  if (APPLY && process.env.INTERNPATH_CONTENT_IMPORT_CONFIRM !== CONTENT_PACKAGE_ID) {
    throw new StopError(`--apply requires INTERNPATH_CONTENT_IMPORT_CONFIRM=${CONTENT_PACKAGE_ID}`);
  }
  if (new Date(COHORT.applicationDeadline).getTime() <= Date.now()) {
    throw new StopError('Cohort application deadline is in the past — update the content package dates first.');
  }

  const health = await call<{ status?: string; environment?: string }>('GET', '/health');
  expectStatus(health, [200], 'health check');
  console.log(`Target environment reported by /health: ${health.json.environment ?? 'unknown'}`);
  if ((health.json.environment ?? '').toLowerCase() === 'production' && !ALLOW_PRODUCTION) {
    throw new StopError('Target reports environment=production. Re-run with --allow-production only with explicit owner approval.');
  }

  const email = process.env.INTERNPATH_IMPORT_ADMIN_EMAIL;
  const password = process.env.INTERNPATH_IMPORT_ADMIN_PASSWORD;
  if (!email || !password) throw new StopError('Set INTERNPATH_IMPORT_ADMIN_EMAIL and INTERNPATH_IMPORT_ADMIN_PASSWORD.');
  if (/@internpath\.demo$/i.test(email) && !ALLOW_DEMO_AUTHOR) {
    throw new StopError('Refusing to author real content with a demo account. Use a real administrator account, or pass --allow-demo-author for development verification only.');
  }

  const login = await call<{ user?: { role?: string; mustChangePassword?: boolean } }>('POST', '/api/auth/login', { email, password });
  expectStatus(login, [200], 'admin login');
  if (login.json.user?.role !== 'ADMIN') throw new StopError('The import account is not an ADMIN.');
  if (login.json.user?.mustChangePassword) throw new StopError('The import account must change its password first.');

  try {
    const domains = (await call<{ data: Array<{ id: string; name: string; isActive: boolean }> }>('GET', '/api/domains')).json.data;
    const programs = await listAll<{ id: string; title: string; status: string }>('/api/admin/programs');
    const projects = await listAll<{ id: string; title: string; status: string }>('/api/admin/projects');
    const programMap = new Map(programs.map((p) => [p.title, { id: p.id, status: p.status }]));
    const projectMap = new Map(projects.map((p) => [p.title, { id: p.id, status: p.status }]));

    for (const o of OPPORTUNITIES) {
      const domain = domains.find((d) => d.name === o.domain && d.isActive);
      if (!domain) throw new StopError(`Active domain "${o.domain}" not found — create it in Admin > Domains first.`);
      await importOpportunity(o, domain.id, programMap, projectMap);
    }
  } finally {
    await call('POST', '/api/auth/logout').catch(() => undefined);
  }

  console.table(summary);
  console.log(`Done (${requestCount} HTTP requests).${PUBLISH || OPEN_PROGRAMS ? '' : ' Nothing was opened or published; all imported records are DRAFT.'}`);
}

main().catch((err: unknown) => {
  if (summary.length) console.table(summary);
  console.error(err instanceof StopError ? `STOPPED: ${err.message}` : err);
  process.exit(1);
});
