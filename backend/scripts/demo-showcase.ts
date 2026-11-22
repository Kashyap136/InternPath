// InternPath demonstration showcase — publishes the opportunity catalogue and
// walks a handful of clearly-labelled demo students through the REAL
// lifecycle so every screen (student, mentor, admin) has meaningful data.
//
//   npx tsx scripts/demo-showcase.ts            # dry run: prints the plan + current state
//   npx tsx scripts/demo-showcase.ts --apply    # perform the steps
//
// Everything goes through the InternPath HTTP API (same validators, business
// rules, notifications and audit log as the UI). Nothing touches the database
// directly. Every step checks current state first, so re-running is safe and
// resumes where a previous run stopped.
//
// What it does
//  1. Gives the demo mentor expertise in every active domain (capacity 6), so
//     approvals never promise an internship the platform cannot staff.
//  2. Adds one Python Development opportunity (the only domain without one).
//  3. Moves the InternPath opportunity projects DRAFT → review → PUBLISHED and
//     the matching programs DRAFT → OPEN.
//  4. Registers five demo students (@internpath.demo, names suffixed "(Demo)")
//     and takes each to a different lifecycle stage: submitted application,
//     approved offer, and three ACTIVE internships with varying task progress
//     (including one submission waiting in the mentor review queue).
//  The original student@internpath.demo account is left untouched for live
//  demonstrations, and each demo program keeps at least one free seat.
//
// Configuration (environment)
//   INTERNPATH_API_URL         default http://localhost:4000
//   SHOWCASE_ADMIN_EMAIL       default admin@internpath.demo
//   SHOWCASE_ADMIN_PASSWORD    required unless the API reports development
//   SHOWCASE_MENTOR_EMAIL      default mentor@internpath.demo
//   SHOWCASE_MENTOR_PASSWORD   required unless the API reports development
//   SHOWCASE_STUDENT_PASSWORD  password for the new demo students (required
//                              unless development; min 12 characters)
// Against a production API the script also requires --allow-production.

import { DEMO_QUESTIONS } from '../prisma/seed-data';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const ALLOW_PRODUCTION = args.has('--allow-production');
const API = (process.env.INTERNPATH_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const PACE_MS = 60;

// Committed seed defaults — only ever used against a development API.
const DEV_DEFAULTS = {
  admin: 'Demo-738bfa6b91c241a1a2504cbe-Ax9',
  mentor: 'Demo-2e24c83815dd7275aeb28f7c-Ax9',
  student: 'Showcase-Demo-Student-2026',
};

const PLACEHOLDER_REPO = 'https://github.com/Kashyap136/InternPath';
const DEMO_NOTE = '[Demonstration data] Placeholder evidence link for the InternPath showcase.';

class StopError extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requestCount = 0;

/* ------------------------------------------------------------------ */
/* HTTP session                                                        */
/* ------------------------------------------------------------------ */

class Session {
  private cookie = '';
  constructor(public readonly label: string) {}

  async call<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    await sleep(PACE_MS);
    requestCount += 1;
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    const match = setCookie ? /(?:^|,\s*)session=([^;]+)/.exec(setCookie) : null;
    if (match) this.cookie = `session=${match[1]}`;
    if (res.status === 429) {
      throw new StopError(`Rate limited (HTTP 429) after ${requestCount} requests on ${method} ${path}. Wait ~15 minutes and re-run; the script resumes safely.`);
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, json };
  }

  async ok<T = any>(method: string, path: string, body: unknown, expected: number[], what: string): Promise<T> {
    const r = await this.call<T>(method, path, body);
    if (!expected.includes(r.status)) {
      const j = (r.json ?? {}) as { error?: string; message?: string };
      throw new StopError(`${this.label}: ${what} failed — HTTP ${r.status} ${j.error ?? ''} ${j.message ?? ''}`.trim());
    }
    return r.json;
  }

  async login(email: string, password: string): Promise<boolean> {
    const r = await this.call('POST', '/api/auth/login', { email, password });
    return r.status === 200;
  }
}

async function listAll<T>(s: Session, path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const j = await s.ok<{ data: T[]; meta?: { totalPages?: number }; pagination?: { totalPages?: number } }>(
      'GET', `${path}${sep}page=${page}&limit=100`, undefined, [200], `GET ${path}`);
    out.push(...j.data);
    const total = j.meta?.totalPages ?? j.pagination?.totalPages;
    if (!total || page >= total) break;
  }
  return out;
}

const log = (msg: string) => console.log(msg);
const plan = (msg: string) => console.log(`${APPLY ? '  ✔' : '  •'} ${msg}${APPLY ? '' : ' (dry run)'}`);

/* ------------------------------------------------------------------ */
/* Python Development opportunity (InternPath-authored, simulated)     */
/* ------------------------------------------------------------------ */

const COHORT = { applicationDeadline: '2027-04-30T18:29:59.000Z', startDate: '2027-05-24T03:30:00.000Z' };

const PYTHON_PROGRAM = {
  title: 'Python Development Internship: Data-Quality Checker for CSV Files',
  durationWeeks: 4,
  level: 'BEGINNER',
  seats: 3,
};

const PYTHON_PROJECT = {
  title: 'Data-Quality Checker for CSV Files',
  sourceType: 'SIMULATED',
  difficulty: 'BEGINNER',
  durationWeeks: 4,
  requiredSkills: ['Python', 'Git', 'pytest'],
  problemStatement: [
    'Scenario (fictional organisation): a student-run open-data club collects CSV exports from several public sources. Files arrive with missing values, inconsistent dates, duplicated rows and columns that silently change type, and nobody notices until an analysis gives a wrong answer.',
    '',
    'You will build a small command-line tool in Python that reads a CSV file, checks it against a simple rules file, and produces a readable data-quality report. Only fictional or openly licensed sample data is used. No real organisation or personal data is involved.',
    '',
    'The point of the project is to learn how to structure, test and document a real Python tool, not just to write a script that works once.',
  ].join('\n'),
  objectives: [
    'By the end you should be able to:',
    '- structure a Python project as an installable package with a command-line entry point;',
    '- read and validate tabular data with the standard library (csv) or pandas;',
    '- express validation rules in a configuration file and apply them generically;',
    '- write unit tests with pytest, including edge cases and failure paths;',
    '- document usage and design decisions so another developer can pick the project up.',
  ].join('\n'),
  requirements: [
    'FUNCTIONAL REQUIREMENTS',
    '1. `dqcheck <file.csv> --rules rules.yaml` reads the file and applies the rules.',
    '2. Supported rules: required columns, non-empty values, type (integer, decimal, date in a given format), allowed values, numeric range, and unique key columns.',
    '3. The report lists every failed rule with the row numbers affected (first 20 per rule) and a summary count. Output formats: readable text (default) and JSON (`--format json`).',
    '4. Exit code 0 when all rules pass, 1 when any rule fails, 2 for usage or file errors, so the tool can be used in automation.',
    '5. Files up to 50,000 rows are processed in under 10 seconds on a normal laptop.',
    '',
    'PREREQUISITES / ELIGIBILITY',
    '- Assessment result: BEGINNER or above in Python Development.',
    '- You have written small Python programs and can use Git and GitHub at a basic level.',
    '',
    'PARTICIPATION TERMS (read before applying)',
    '- Organizer: InternPath. This brief was written by InternPath for learning purposes. Any organisation named in the scenario is fictional. There is no external client, sponsor, employer or partner organisation.',
    '- Compensation: UNPAID. There is no stipend, salary or other payment, and InternPath charges participants nothing at any stage.',
    '- Your work is not used in any InternPath product. You keep the copyright in everything you build.',
    '- Workload: about 6–8 hours per week, remote and self-scheduled, for 4 weeks.',
    '- Mentorship: one InternPath mentor with Python expertise reviews each submission in the platform.',
    '- Certificate: issued only if all mandatory tasks are approved, the final rubric score is at least 60/100 and your mentor recommends completion. It is not guaranteed.',
    '- Not offered: no job offer, placement, interview referral or academic credit is promised or implied.',
  ].join('\n'),
  expectedDeliverables: [
    '- A public Git repository containing the package, sample data, example rules files and tests.',
    '- A README explaining installation, usage, the rules format and known limitations.',
    '- A test report (pytest output with coverage) committed to the repository.',
    '- A short written reflection (about 400 words) on the feedback you received.',
  ].join('\n'),
  evaluationCriteria: [
    'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
    '- Quality (50%): rules behave correctly, including edge cases; clear code structure; meaningful tests.',
    '- Process (30%): small, meaningful commits; tasks submitted on time; review feedback addressed.',
    '- Communication (20%): a clear README and reflection; submission notes that explain what changed.',
  ].join('\n'),
  submissionGuidelines: [
    '- Submit repository links from github.com, gitlab.com or bitbucket.org, with the commit SHA to review.',
    '- Document links can point to a Markdown file in your repository.',
    '- In each submission note, list what you completed, what you did not, and any questions for your mentor.',
    '- All work must be your own. Disclose AI-assisted code in your notes.',
  ].join('\n'),
};

const PYTHON_MILESTONES = [
  {
    title: 'Project setup and rules design', description: 'Week 1: package structure, sample data and the rules format.', order: 1, isRequired: true,
    tasks: [{
      title: 'Package skeleton and rules-file design',
      description: 'Create the package with a `dqcheck` entry point, a linter and pytest. Add two fictional sample CSV files (one clean, one with deliberate problems) and a one-page design of the rules file format.',
      acceptanceCriteria: '`pip install -e .` then `dqcheck --help` works. Lint and an initial test pass. The design covers every rule type in the requirements.',
      isMandatory: true, evidenceTypes: ['CODE', 'DOCUMENT'], dueOffsetDays: 7, order: 1,
    }],
  },
  {
    title: 'Validation engine', description: 'Weeks 2–3: implement the rules and the report.', order: 2, isRequired: true,
    tasks: [
      {
        title: 'Column, value and type rules',
        description: 'Implement required columns, non-empty values, types, allowed values and numeric ranges, each with unit tests including failure cases.',
        acceptanceCriteria: 'Every rule type has passing tests for valid and invalid input. Row numbers in failures are correct.',
        isMandatory: true, evidenceTypes: ['CODE'], dueOffsetDays: 14, order: 1,
      },
      {
        title: 'Uniqueness rule, report formats and exit codes',
        description: 'Add unique-key checks, the text and JSON reports, and the exit-code contract.',
        acceptanceCriteria: 'JSON output is valid and documented. Exit codes match requirement 4 and are covered by tests.',
        isMandatory: true, evidenceTypes: ['CODE'], dueOffsetDays: 21, order: 2,
      },
    ],
  },
  {
    title: 'Documentation and reflection', description: 'Week 4: polish, performance check and write-up.', order: 3, isRequired: true,
    tasks: [{
      title: 'README, performance check and reflection',
      description: 'Write the README, check the 50,000-row performance target with a generated file, and write the reflection.',
      acceptanceCriteria: 'A new developer can install and run the tool from the README alone. The performance result is recorded. The reflection addresses the feedback received.',
      isMandatory: true, evidenceTypes: ['DOCUMENT'], dueOffsetDays: 28, order: 1,
    }],
  },
];

/** Project titles authored by InternPath that should be published for the showcase. */
const CATALOGUE_PROJECTS = [
  'Accessible Event Registration Interface',
  'Library Lending REST API',
  'Study Group Scheduler',
  'Test Plan and Automated Regression Suite for an Open-Source Web Application',
  'Exploratory Analysis of an Indian Open Government Dataset',
  PYTHON_PROJECT.title,
];

const CATALOGUE_PROGRAMS = [
  'Frontend Development Internship: Accessible Event Registration Interface',
  'Backend Development Internship: Library Lending REST API',
  'Full-Stack Development Internship: Study Group Scheduler',
  'Software Testing Internship: Test Plan and Automated Regression Suite',
  'Data Analysis Internship: Exploratory Analysis of Open Government Data',
  PYTHON_PROGRAM.title,
];

/* ------------------------------------------------------------------ */
/* Demo students                                                       */
/* ------------------------------------------------------------------ */

type Stage = 'submitted' | 'approved' | 'active';

interface Persona {
  fullName: string;
  email: string;
  program: string;
  project?: string;
  stage: Stage;
  approveTasks?: number;     // tasks taken all the way to mentor approval
  submitNext?: boolean;      // leave the next task submitted (mentor review queue)
  startNext?: boolean;       // leave the next task in progress
  profile: { institution: string; degree: string; yearOfStudy: number; graduationYear: number; declaredSkills: string[]; bio: string };
  statement: string;
}

const PERSONAS: Persona[] = [
  {
    fullName: 'Aarav Mehta (Demo)', email: 'aarav.mehta@internpath.demo',
    program: 'Frontend Engineering Internship (Academic Demo)', project: 'Accessible Event Registration Interface',
    stage: 'active', approveTasks: 2, submitNext: true,
    profile: { institution: 'Demo Institute of Technology', degree: 'B.Tech Computer Science', yearOfStudy: 3, graduationYear: 2028, declaredSkills: ['HTML/CSS', 'JavaScript', 'React'], bio: 'Demonstration account. Enjoys building accessible, responsive interfaces.' },
    statement: 'I want to learn how professional frontend work is specified and reviewed, especially accessibility. I have built two small React projects and can commit 10 hours a week. (Demonstration data.)',
  },
  {
    fullName: 'Priya Nair (Demo)', email: 'priya.nair@internpath.demo',
    program: 'Backend Engineering Internship (Academic Demo)', project: 'Library Lending REST API',
    stage: 'active', approveTasks: 1, startNext: true,
    profile: { institution: 'Demo College of Engineering', degree: 'B.E. Information Technology', yearOfStudy: 2, graduationYear: 2029, declaredSkills: ['Node.js', 'SQL', 'REST APIs'], bio: 'Demonstration account. Interested in API design and databases.' },
    statement: 'Designing reliable APIs is what I want to get better at. I have built a small Express API with PostgreSQL and can give 8–10 hours a week. (Demonstration data.)',
  },
  {
    fullName: 'Rohan Gupta (Demo)', email: 'rohan.gupta@internpath.demo',
    program: 'Full Stack Engineering Internship (Academic Demo)', project: 'Study Group Scheduler',
    stage: 'active',
    profile: { institution: 'Demo University', degree: 'BCA', yearOfStudy: 3, graduationYear: 2027, declaredSkills: ['React', 'Node.js', 'PostgreSQL'], bio: 'Demonstration account. Likes shipping complete features end to end.' },
    statement: 'I want experience owning a feature from database to UI with real code review. I have deployed one full-stack side project. (Demonstration data.)',
  },
  {
    fullName: 'Ananya Iyer (Demo)', email: 'ananya.iyer@internpath.demo',
    program: 'Backend Engineering Internship (Academic Demo)',
    stage: 'approved',
    profile: { institution: 'Demo Institute of Science', degree: 'B.Sc Computer Science', yearOfStudy: 2, graduationYear: 2028, declaredSkills: ['Python', 'SQL', 'Git'], bio: 'Demonstration account. Exploring backend development.' },
    statement: 'I am moving from scripting into backend development and want structured feedback on my code. Available 8 hours a week. (Demonstration data.)',
  },
  {
    fullName: 'Kabir Singh (Demo)', email: 'kabir.singh@internpath.demo',
    program: 'Full Stack Engineering Internship (Academic Demo)',
    stage: 'submitted',
    profile: { institution: 'Demo Technical University', degree: 'B.Tech Electronics', yearOfStudy: 4, graduationYear: 2027, declaredSkills: ['TypeScript', 'React', 'Express'], bio: 'Demonstration account. Switching from electronics to software.' },
    statement: 'I have taught myself TypeScript, React and Express over the past year and want mentored, project-based experience. (Demonstration data.)',
  },
];

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

interface Domain { id: string; name: string; isActive?: boolean }
interface Program { id: string; title: string; status: string; domainId: string; level: string }
interface Project { id: string; title: string; status: string; domainId: string }

async function setupMentor(mentor: Session, domains: Domain[]) {
  log('\n▸ Mentor expertise');
  const domainIds = domains.map((d) => d.id);
  const r = await mentor.call<{ profile: { domains?: Array<{ id: string }>; maxActiveInterns?: number } | null }>('GET', '/api/profiles/mentor/me');
  const profile = r.status === 200 ? r.json?.profile : null;
  const have = new Set((profile?.domains ?? []).map((d) => d.id));
  if (profile && domainIds.every((id) => have.has(id)) && (profile.maxActiveInterns ?? 0) >= 6) {
    log('  = already covers every domain with capacity ≥ 6');
    return;
  }
  const body = {
    summary: 'Demonstration mentor account. Reviews submissions across all InternPath domains.',
    maxActiveInterns: 6,
    domainIds,
  };
  if (APPLY) {
    if (profile) await mentor.ok('PUT', '/api/profiles/mentor/me', body, [200], 'update mentor profile');
    else await mentor.ok('POST', '/api/profiles/mentor/me', body, [200, 201], 'create mentor profile');
  }
  plan(`mentor expertise → ${domains.length} domains, capacity 6`);
}

async function ensurePythonOpportunity(admin: Session, domains: Domain[], programs: Program[], projects: Project[]) {
  log('\n▸ Python Development opportunity');
  const python = domains.find((d) => d.name === 'Python Development');
  if (!python) { log('  ! no "Python Development" domain — skipped'); return; }

  if (programs.some((p) => p.title === PYTHON_PROGRAM.title)) log('  = program exists');
  else {
    if (APPLY) {
      const j = await admin.ok<{ data: Program }>('POST', '/api/admin/programs', { ...PYTHON_PROGRAM, domainId: python.id, ...COHORT }, [201], 'create Python program');
      programs.push(j.data);
    }
    plan('create Python program (DRAFT)');
  }

  if (projects.some((p) => p.title === PYTHON_PROJECT.title)) { log('  = project exists'); return; }
  if (!APPLY) { plan('create Python project with 3 milestones / 4 tasks'); return; }
  const created = await admin.ok<{ data: Project }>('POST', '/api/projects', { ...PYTHON_PROJECT, domainId: python.id }, [201], 'create Python project');
  for (const m of PYTHON_MILESTONES) {
    const { tasks, ...milestone } = m;
    const mj = await admin.ok<{ data: { id: string } }>('POST', `/api/projects/${created.data.id}/milestones`, milestone, [201], `create milestone "${m.title}"`);
    for (const t of tasks) {
      await admin.ok('POST', `/api/projects/${created.data.id}/milestones/${mj.data.id}/tasks`, t, [201], `create task "${t.title}"`);
    }
  }
  projects.push(created.data);
  plan('create Python project with 3 milestones / 4 tasks');
}

async function publishCatalogue(admin: Session, programs: Program[], projects: Project[]) {
  log('\n▸ Publish projects');
  for (const title of CATALOGUE_PROJECTS) {
    const p = projects.find((x) => x.title === title);
    if (!p) { log(`  ! project not found: ${title}`); continue; }
    const from = p.status;
    let status = from;
    if (status === 'PUBLISHED') { log(`  = ${title} (PUBLISHED)`); continue; }
    if (status === 'ARCHIVED') { log(`  ! ${title} is ARCHIVED — left alone`); continue; }
    if (APPLY) {
      if (status === 'DRAFT') {
        await admin.ok('POST', `/api/projects/${p.id}/submit`, {}, [200], `submit "${title}"`);
        status = 'PENDING_REVIEW';
      }
      if (status === 'PENDING_REVIEW') {
        await admin.ok('POST', `/api/admin/projects/${p.id}/review`, { decision: 'APPROVED', comments: 'Reviewed and approved for the InternPath catalogue.' }, [200], `approve "${title}"`);
        status = 'APPROVED';
      }
      if (status === 'APPROVED') {
        await admin.ok('POST', `/api/admin/projects/${p.id}/publish`, {}, [200], `publish "${title}"`);
      }
      p.status = 'PUBLISHED';
    }
    plan(`${title}: ${from} → PUBLISHED`);
  }

  log('\n▸ Open programs');
  for (const title of CATALOGUE_PROGRAMS) {
    const p = programs.find((x) => x.title === title);
    if (!p) { log(`  ! program not found: ${title}`); continue; }
    if (p.status !== 'DRAFT') { log(`  = ${title} (${p.status})`); continue; }
    if (APPLY) {
      await admin.ok('PUT', `/api/admin/programs/${p.id}/status`, { status: 'OPEN' }, [200], `open "${title}"`);
      p.status = 'OPEN';
    }
    plan(`${title}: DRAFT → OPEN`);
  }
}

const answerKey = new Map(DEMO_QUESTIONS.map((q) => [q.text, q.correctOption]));

async function ensureAssessment(student: Session, persona: Persona, domainId: string) {
  const attempts = await student.ok<{ data: Array<{ domainId: string; submittedAt: string | null; resultLevel: string | null }> }>(
    'GET', '/api/assessment/attempts', undefined, [200], 'list attempts');
  const done = (attempts.data ?? []).find((a) => a.domainId === domainId && a.submittedAt);
  if (done) return `assessment already taken (${done.resultLevel ?? 'no level'})`;
  if (!APPLY) return 'take domain assessment';

  const start = await student.ok<{ data: { attempt: { id: string }; questions: Array<{ id: string; text: string; options: string[] }> } }>(
    'POST', `/api/assessment/${domainId}/start`, {}, [200, 201], 'start assessment');
  const { attempt, questions } = start.data;
  // Realistic, not perfect: miss one question when there are enough to stay
  // comfortably above the INTERMEDIATE threshold.
  const missIndex = questions.length >= 9 ? questions.length - 1 : -1;
  for (const [i, q] of questions.entries()) {
    const correct = answerKey.get(q.text);
    let selected = correct ?? 0;
    if (i === missIndex && correct !== undefined) selected = (correct + 1) % q.options.length;
    await student.ok('POST', `/api/assessment/attempt/${attempt.id}/answer`, { questionId: q.id, selectedOption: selected }, [200, 201], 'answer question');
  }
  const result = await student.ok<{ data: { resultLevel?: string } }>(
    'POST', `/api/assessment/attempt/${attempt.id}/submit`, {}, [200], 'submit assessment');
  return `assessment → ${result.data?.resultLevel ?? 'submitted'}`;
}

async function runPersona(persona: Persona, ctx: {
  admin: Session; mentor: Session; mentorId: string; studentPassword: string;
  programs: Program[]; projects: Project[];
}) {
  log(`\n▸ ${persona.fullName} — target: ${persona.stage}`);
  const program = ctx.programs.find((p) => p.title === persona.program);
  if (!program) { log(`  ! program not found: ${persona.program}`); return; }
  if (program.status !== 'OPEN') { log(`  ! program is ${program.status}, needs OPEN — skipped`); return; }

  const s = new Session(persona.fullName);

  // Account
  if (!(await s.login(persona.email, ctx.studentPassword))) {
    if (!APPLY) { plan('register account, complete profile, assess, apply'); return; }
    const reg = await s.call('POST', '/api/auth/register', { fullName: persona.fullName, email: persona.email, password: ctx.studentPassword, privacyAccepted: true });
    if (reg.status === 409) throw new StopError(`${persona.email} exists but the password does not match SHOWCASE_STUDENT_PASSWORD`);
    if (reg.status !== 201 && reg.status !== 200) throw new StopError(`register ${persona.email} failed — HTTP ${reg.status} ${JSON.stringify(reg.json)}`);
    if (!(await s.login(persona.email, ctx.studentPassword))) throw new StopError(`login after registering ${persona.email} failed`);
    plan('registered account');
  }

  // Profile
  const prof = await s.call<{ profile: unknown; complete: boolean }>('GET', '/api/profiles/student/me');
  if (!(prof.status === 200 && prof.json?.complete)) {
    if (APPLY) {
      const exists = prof.status === 200 && prof.json?.profile;
      await s.ok(exists ? 'PUT' : 'POST', '/api/profiles/student/me', persona.profile, [200, 201], 'save student profile');
    }
    plan('completed student profile');
  }

  // Assessment
  plan(await ensureAssessment(s, persona, program.domainId));

  // Application
  const apps = await s.ok<{ data: Array<{ id: string; programId: string; status: string }> }>('GET', '/api/applications', undefined, [200], 'list applications');
  let app = (apps.data ?? []).find((a) => a.programId === program.id);
  if (!app) {
    if (!APPLY) { plan('create + submit application'); return; }
    const created = await s.ok<{ data: { id: string; status: string; programId: string } }>('POST', '/api/applications', { programId: program.id, statementOfInterest: persona.statement }, [201], 'create application');
    app = created.data;
  }
  if (app.status === 'DRAFT') {
    if (APPLY) { await s.ok('POST', `/api/applications/${app.id}/submit`, {}, [200], 'submit application'); app.status = 'SUBMITTED'; }
    plan('submitted application');
  }
  if (persona.stage === 'submitted') { log(`  = application ${app.status}`); return; }

  // Admin decision
  if (app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW') {
    if (APPLY) {
      if (app.status === 'SUBMITTED') await ctx.admin.ok('PUT', `/api/admin/applications/${app.id}/under-review`, {}, [200], 'move to review');
      await ctx.admin.ok('PUT', `/api/admin/applications/${app.id}/decision`, { status: 'APPROVED' }, [200], 'approve application');
      app.status = 'APPROVED';
    }
    plan('admin reviewed and approved the application');
  }
  if (persona.stage === 'approved') { log(`  = application ${app.status} (offer awaiting the student)`); return; }

  // Student accepts → internship
  if (app.status === 'APPROVED') {
    if (APPLY) await s.ok('POST', `/api/applications/${app.id}/accept`, {}, [200], 'accept offer');
    plan('student accepted the offer → internship created');
  }
  if (!APPLY) return;

  const internships = await s.ok<{ data: Array<{ id: string; programId: string; status: string; mentorId: string | null; projectId: string | null }> }>(
    'GET', '/api/internships', undefined, [200], 'list internships');
  const internship = (internships.data ?? []).find((i) => i.programId === program.id);
  if (!internship) throw new StopError(`${persona.fullName}: internship not found after acceptance`);

  if (internship.status === 'PENDING_START') {
    if (!internship.mentorId) {
      await ctx.admin.ok('POST', `/api/admin/internships/${internship.id}/assign-mentor`, { mentorId: ctx.mentorId }, [200], 'assign mentor');
      plan('admin assigned the demo mentor');
    }
    if (!internship.projectId) {
      const project = ctx.projects.find((p) => p.title === persona.project && p.status === 'PUBLISHED');
      if (!project) throw new StopError(`${persona.fullName}: published project "${persona.project}" not found`);
      await ctx.admin.ok('POST', `/api/admin/internships/${internship.id}/assign-project`, { projectId: project.id }, [200], 'assign project');
      plan(`admin assigned project "${project.title}"`);
    }
    await ctx.admin.ok('POST', `/api/admin/internships/${internship.id}/activate`, {}, [200], 'activate internship');
    plan('internship activated');
  }

  await progressTasks(s, ctx.mentor, persona, internship.id);
}

interface InternTask { id: string; title: string; status: string; locked?: boolean; evidenceTypes: string[]; order: number }

async function progressTasks(student: Session, mentor: Session, persona: Persona, internshipId: string) {
  const want = persona.approveTasks ?? 0;
  const fetchTasks = async () => {
    const j = await student.ok<{ data: { milestones: Array<{ order: number; tasks: InternTask[] }> } }>(
      'GET', `/api/internships/${internshipId}`, undefined, [200], 'load internship');
    return [...j.data.milestones].sort((a, b) => a.order - b.order).flatMap((m) => [...m.tasks].sort((a, b) => a.order - b.order));
  };

  const evidence = (t: InternTask) => ({
    ...(t.evidenceTypes.includes('CODE') ? { repositoryUrl: PLACEHOLDER_REPO, commitRef: 'main' } : {}),
    ...(t.evidenceTypes.includes('DOCUMENT') ? { documentUrl: `${PLACEHOLDER_REPO}#readme` } : {}),
    ...(t.evidenceTypes.includes('LIVE_DEMO') ? { liveDemoUrl: `${PLACEHOLDER_REPO}#readme` } : {}),
    notes: `${DEMO_NOTE} Completed: ${t.title}.`,
    originalityDeclared: true as const,
  });

  const submit = async (t: InternTask) => {
    if (t.status === 'NOT_STARTED') await student.ok('POST', `/api/internships/${internshipId}/tasks/${t.id}/start`, {}, [200], `start "${t.title}"`);
    if (t.status === 'NOT_STARTED' || t.status === 'IN_PROGRESS' || t.status === 'CHANGES_REQUESTED') {
      await student.ok('POST', `/api/internships/${internshipId}/tasks/${t.id}/submissions`, evidence(t), [200, 201], `submit "${t.title}"`);
    }
  };

  let tasks = await fetchTasks();
  let approved = tasks.filter((t) => t.status === 'APPROVED').length;

  while (approved < want) {
    const t = tasks.find((x) => x.status !== 'APPROVED');
    if (!t) break;
    await submit(t);
    if (t.status !== 'UNDER_REVIEW') {
      await mentor.ok('POST', `/api/mentor/tasks/${t.id}/start-review`, {}, [200], `start review "${t.title}"`);
    }
    await mentor.ok('POST', `/api/mentor/tasks/${t.id}/review`, { decision: 'APPROVED', comment: 'Meets the acceptance criteria. Clear structure and good notes — well done. (Demonstration review.)' }, [200], `approve "${t.title}"`);
    plan(`task approved: ${t.title}`);
    approved += 1;
    tasks = await fetchTasks();
  }

  const next = tasks.find((x) => x.status !== 'APPROVED');
  if (!next) return;
  if (persona.submitNext && ['NOT_STARTED', 'IN_PROGRESS'].includes(next.status)) {
    await submit(next);
    plan(`task submitted, waiting for mentor review: ${next.title}`);
  } else if (persona.startNext && next.status === 'NOT_STARTED') {
    await student.ok('POST', `/api/internships/${internshipId}/tasks/${next.id}/start`, {}, [200], `start "${next.title}"`);
    plan(`task in progress: ${next.title}`);
  }
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  log(`InternPath showcase — ${APPLY ? 'APPLY' : 'DRY RUN'} against ${API}`);
  const health = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null) as { environment?: string } | null;
  if (!health) throw new StopError(`Cannot reach ${API}/health`);
  const env = health.environment ?? 'unknown';
  const isDev = env === 'development';
  log(`API environment: ${env}`);
  if (!isDev && !ALLOW_PRODUCTION) throw new StopError('Non-development API: re-run with --allow-production to confirm.');

  const need = (name: string, devDefault: string) => {
    const v = process.env[name];
    if (v) return v;
    if (isDev) return devDefault;
    throw new StopError(`${name} is required for a non-development API.`);
  };
  const adminEmail = process.env.SHOWCASE_ADMIN_EMAIL ?? 'admin@internpath.demo';
  const mentorEmail = process.env.SHOWCASE_MENTOR_EMAIL ?? 'mentor@internpath.demo';
  const adminPassword = need('SHOWCASE_ADMIN_PASSWORD', DEV_DEFAULTS.admin);
  const mentorPassword = need('SHOWCASE_MENTOR_PASSWORD', DEV_DEFAULTS.mentor);
  const studentPassword = need('SHOWCASE_STUDENT_PASSWORD', DEV_DEFAULTS.student);
  if (studentPassword.length < 12) throw new StopError('SHOWCASE_STUDENT_PASSWORD must be at least 12 characters.');

  const admin = new Session('admin');
  const mentor = new Session('mentor');
  if (!(await admin.login(adminEmail, adminPassword))) throw new StopError(`Admin login failed for ${adminEmail}`);
  if (!(await mentor.login(mentorEmail, mentorPassword))) throw new StopError(`Mentor login failed for ${mentorEmail}`);
  const me = await mentor.ok<{ user?: { id: string }; data?: { user?: { id: string } } }>('GET', '/api/auth/me', undefined, [200], 'mentor /me');
  const mentorId = me.user?.id ?? me.data?.user?.id;
  if (!mentorId) throw new StopError('Could not resolve the mentor id');

  const domains = (await listAll<Domain>(admin, '/api/domains')).filter((d) => d.isActive !== false);
  const programs = await listAll<Program>(admin, '/api/admin/programs');
  const projects = await listAll<Project>(admin, '/api/admin/projects');
  log(`Found ${domains.length} domains, ${programs.length} programs, ${projects.length} projects.`);

  await setupMentor(mentor, domains);
  await ensurePythonOpportunity(admin, domains, programs, projects);
  await publishCatalogue(admin, programs, projects);
  for (const persona of PERSONAS) {
    await runPersona(persona, { admin, mentor, mentorId, studentPassword, programs, projects });
  }
  log(`\nDone (${requestCount} requests).${APPLY ? '' : ' Dry run only — re-run with --apply to perform these steps.'}`);
}

main().catch((err) => {
  console.error(`\n✖ ${err instanceof StopError ? err.message : (err as Error).stack ?? err}`);
  process.exit(1);
});
