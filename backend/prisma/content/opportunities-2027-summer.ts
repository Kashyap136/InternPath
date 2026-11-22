// InternPath opportunity content package — 2027 Summer Cohort (v1)
//
// Pure data, no I/O. This is GENUINE platform content intended for real
// applicants, NOT demo/QA fixture data (contrast: prisma/seed-data.ts).
//
// Authenticity rules this file follows (verified by
// src/content-opportunities.test.ts):
//  - Organizer is InternPath. Every project brief is SIMULATED: there is no
//    external client, sponsor, employer or partner organisation, and no
//    fictional organisation is presented as real.
//  - No mentor names, qualifications, testimonials, statistics or partner
//    claims. Mentors are assigned only from real, admin-provisioned MENTOR
//    accounts with matching domain expertise.
//  - Compensation is stated as UNPAID everywhere; no stipend, salary,
//    placement, job offer, interview or certificate is promised.
//  - Participant work is not used in any InternPath product — none of these
//    projects uses the InternPath codebase as project material (doing so
//    would turn an unpaid learning internship into unpaid productive labour
//    for the platform).
//
// How it maps onto the schema (see the audit, section 5):
//  - `tracks` are organisational groupings for documentation only — the
//    schema has no "track" entity, so they are not imported.
//  - each `opportunity` becomes ONE Program (the record students apply to)
//    and ONE Project (the brief + milestones + tasks the mentor works from).
//  - Program has no description column, so the full brief and the
//    participation terms live on the Project, which students can read only
//    once it is PUBLISHED. See audit finding about Program detail content.
//
// Publication state: every record is imported as DRAFT and must stay DRAFT
// until the readiness conditions in `readiness` are met (real mentor with
// matching domain expertise and capacity, assessment bank expanded, release
// blockers resolved). The importer never opens or publishes anything.
//
// Dates are PROPOSED (owner decision): applications close 30 Apr 2027
// 23:59 IST and the cohort starts 24 May 2027 09:00 IST, aligned with the
// summer vacation of most Indian universities. Seats are PROVISIONAL and
// equal one mentor's default capacity (maxActiveInterns = 3); before a
// program is opened, seats must be reset to the confirmed mentor capacity.

export const CONTENT_PACKAGE_ID = 'internpath-2027-summer-v1';

export const COHORT = {
  name: '2027 Summer Cohort',
  applicationDeadline: '2027-04-30T18:29:59.000Z', // 30 Apr 2027 23:59:59 IST
  startDate: '2027-05-24T03:30:00.000Z', // 24 May 2027 09:00 IST
} as const;

export type EvidenceType = 'CODE' | 'DOCUMENT' | 'LIVE_DEMO';
export type Level = 'BEGINNER' | 'INTERMEDIATE';
export type ReadinessState =
  | 'DRAFT_REQUIRES_MENTOR'
  | 'DRAFT_REQUIRES_MENTOR_AND_TARGET_LIST';

export interface TaskContent {
  key: string; // stable key used for dependencies (not stored)
  title: string;
  description: string;
  acceptanceCriteria: string;
  isMandatory: boolean;
  evidenceTypes: EvidenceType[];
  dueOffsetDays: number; // days after the internship start date
  order: number;
  dependsOn?: string[]; // task keys within the same project
}

export interface MilestoneContent {
  title: string;
  description: string;
  order: number;
  isRequired: boolean;
  tasks: TaskContent[];
}

export interface OpportunityContent {
  key: string;
  track: string;
  domain: string; // must match an existing Domain.name
  program: {
    title: string;
    durationWeeks: 2 | 4 | 6 | 8;
    level: Level;
    seats: number; // PROVISIONAL — see header
  };
  hoursPerWeek: string;
  project: {
    title: string;
    sourceType: 'SIMULATED';
    difficulty: Level;
    durationWeeks: number;
    requiredSkills: string[];
    problemStatement: string;
    objectives: string;
    requirements: string;
    expectedDeliverables: string;
    evaluationCriteria: string;
    submissionGuidelines: string;
  };
  milestones: MilestoneContent[];
  readiness: {
    state: ReadinessState;
    conditions: string[];
  };
}

/* ------------------------------------------------------------------ */
/* Shared text                                                         */
/* ------------------------------------------------------------------ */

function participationTerms(hoursPerWeek: string, weeks: number): string {
  return [
    'PARTICIPATION TERMS (read before applying)',
    '- Organizer: InternPath. This brief was written by InternPath for learning purposes. Any organisation named in the scenario is fictional. There is no external client, sponsor, employer or partner organisation.',
    '- Compensation: UNPAID. There is no stipend, salary or other payment. InternPath charges participants nothing at any stage. If anyone asks you for money, report it in the platform (Reports > Payment request).',
    '- Why it is unpaid: this is a learning project. Your work is not used in any InternPath product and is not sold to or used by anyone else. You keep the copyright in everything you build. We recommend publishing it in your own repository under an open-source licence such as MIT.',
    `- Workload: about ${hoursPerWeek} hours per week, remote and self-scheduled, for ${weeks} weeks. Tasks have due dates. If you need more time, tell your mentor early: an administrator can grant one extension of up to 7 days.`,
    '- Mentorship: one InternPath mentor with expertise in this domain reviews each submission in the platform and writes feedback. The target review time is 3 days. Live calls are at the mentor’s discretion and are not guaranteed.',
    '- Evaluation: your mentor must approve every mandatory task. At the end your mentor scores you on the platform rubric: Quality 50%, Process 30%, Communication 20%.',
    '- Certificate: an administrator issues a verifiable InternPath completion certificate only if all mandatory tasks are approved, your final rubric score is at least 60/100, and your mentor recommends completion. A certificate is not guaranteed.',
    '- Not offered: no job offer, placement, interview referral, academic credit or third-party accreditation is promised or implied. If you need academic recognition, ask your institution before you apply.',
    '- Leaving: you can withdraw at any time from your internship page by giving a short reason.',
  ].join('\n');
}

const APPLICATION_INSTRUCTIONS = [
  'HOW TO APPLY',
  '1. Complete your student profile (institution, degree, year, graduation year, skills).',
  '2. Take the skills assessment for this domain. Your result must meet the program level.',
  '3. Start an application and write a statement of interest (max 2000 characters) covering: (a) why this project, (b) links to one or two things you have built (a repository, notebook or site), (c) your realistic weekly availability during the internship dates, and (d) anything that could affect your participation.',
  '4. Submit before the deadline. An administrator reviews applications. If you are approved, you have 3 days to accept the offer in the platform. After you accept, an administrator assigns your mentor and this project before the start date.',
].join('\n');

/* ------------------------------------------------------------------ */
/* Tracks (documentation grouping only)                                */
/* ------------------------------------------------------------------ */

export const TRACKS: ReadonlyArray<{
  name: string;
  purpose: string;
  audience: string;
  opportunityKeys: string[];
}> = [
  {
    name: 'Frontend Web Development Track',
    purpose:
      'Practice building accessible, responsive user interfaces from a written specification, with code review from a mentor.',
    audience:
      'Undergraduate or diploma students who have built at least one small HTML/CSS/JavaScript page and want structured feedback on real-world UI work.',
    opportunityKeys: ['frontend-event-registration'],
  },
  {
    name: 'Backend API Development Track',
    purpose:
      'Practice designing, implementing, testing and documenting a REST API with real business rules and database transactions.',
    audience:
      'Students comfortable with basic JavaScript/TypeScript and SQL who have not yet built and tested a complete API.',
    opportunityKeys: ['backend-library-api'],
  },
  {
    name: 'Full-Stack and Software Quality Track',
    purpose:
      'Practice end-to-end feature delivery with authorization and automated tests, or systematic software testing of an existing application.',
    audience:
      'Intermediate students who can already build simple web apps (full-stack internship), or beginners interested in QA careers (testing internship).',
    opportunityKeys: ['fullstack-study-scheduler', 'qa-regression-suite'],
  },
  {
    name: 'Data Analysis Track',
    purpose:
      'Practice the full analysis cycle on a legitimately licensed public dataset: question framing, cleaning, analysis, visualisation and honest reporting of limitations.',
    audience:
      'Students with introductory Python or SQL who want to produce a complete, reviewable analysis.',
    opportunityKeys: ['data-open-government-eda'],
  },
];

/* ------------------------------------------------------------------ */
/* Opportunities                                                       */
/* ------------------------------------------------------------------ */

const MENTOR_CONDITION = (domain: string) =>
  `A real MENTOR account with "${domain}" expertise and free capacity must be provisioned, and that mentor must review and accept this brief before the program is opened.`;

const COMMON_CONDITIONS = [
  'Release blockers P1 in the production-readiness audit must be resolved, at minimum self-service password recovery, email verification and email delivery, before real applicants are invited.',
  'Expand the domain assessment bank. The current bank has 2 questions per domain, which is not a meaningful eligibility gate.',
  'Confirm the proposed dates and reset seats to the confirmed mentor capacity before changing the program status from DRAFT to OPEN.',
  'Publish the project (submit for review, approve, publish) before opening the program, so applicants can read the full brief and participation terms.',
];

export const OPPORTUNITIES: ReadonlyArray<OpportunityContent> = [
  /* ---------------------------------------------------------------- */
  {
    key: 'frontend-event-registration',
    track: 'Frontend Web Development Track',
    domain: 'Frontend Development',
    program: {
      title: 'Frontend Development Internship: Accessible Event Registration Interface',
      durationWeeks: 6,
      level: 'BEGINNER',
      seats: 3,
    },
    hoursPerWeek: '8–10',
    project: {
      title: 'Accessible Event Registration Interface',
      sourceType: 'SIMULATED',
      difficulty: 'BEGINNER',
      durationWeeks: 6,
      requiredSkills: ['HTML/CSS', 'TypeScript', 'React'],
      problemStatement: [
        'Scenario (fictional organisation): a volunteer-run community tech meetup publishes its talks on a spreadsheet, and people register by email. Attendees cannot easily find sessions that match their interests, and the current page cannot be used with a keyboard or a screen reader.',
        '',
        'You will build the frontend for a session catalogue and a multi-step registration flow. You will work against a mock API that you run locally, based on the data contract in the requirements. No real backend, real organisation or real attendee data is involved.',
        '',
        'The point of the project is to learn how professional UI work is specified, built, reviewed and checked for accessibility. It is not just about making screens look right.',
      ].join('\n'),
      objectives: [
        'By the end you should be able to:',
        '- turn a written specification into a component plan and a working React + TypeScript interface;',
        '- fetch, filter and render data from a JSON API with loading, empty and error states;',
        '- build a multi-step form with client-side validation and clear, accessible error messages;',
        '- check your own work against WCAG 2.2 AA basics: keyboard use, focus order, labels, contrast and announcements;',
        '- respond to code-review feedback and explain your decisions in writing.',
      ].join('\n'),
      requirements: [
        'FUNCTIONAL REQUIREMENTS',
        '1. Session catalogue: list sessions with title, track, start time (shown in IST), duration, room and remaining seats.',
        '2. Search by title, plus filters for track and day. Filters can be combined and are reflected in the URL so they survive a refresh.',
        '3. Visible loading, empty ("no sessions match") and error states. Errors offer a retry.',
        '4. Registration in three steps: (a) choose 1–3 sessions with no time clashes, (b) attendee details (name, email, optional accessibility needs), (c) review and confirm. Back navigation keeps the data entered so far.',
        '5. Validation: required fields, email format, time-clash detection and a sold-out check. Errors are announced to screen readers and linked to their fields.',
        '6. Responsive layout from 360px width upward, with no horizontal scrolling.',
        '',
        'DATA CONTRACT (implement it with json-server, MSW or a static JSON file)',
        'Session { id: string, title: string, track: "Web" | "Data" | "Career", startsAt: ISO-8601 string, durationMinutes: number, room: string, capacity: number, seatsTaken: number }',
        'GET /sessions returns Session[]; POST /registrations { sessionIds: string[], fullName: string, email: string, accessibilityNeeds?: string } returns 201 { id: string } or 409 { error: "SOLD_OUT", sessionId }.',
        'Create at least 12 fictional sessions across 2 days. Do not use real people’s names or contact details.',
        '',
        'PREREQUISITES / ELIGIBILITY',
        '- Assessment result: BEGINNER or above in Frontend Development.',
        '- You have built at least one small page with HTML, CSS and JavaScript, and you can use Git and GitHub at a basic level.',
        '- React experience is helpful but not required. Week 1 includes time to learn the basics.',
        '',
        participationTerms('8–10', 6),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: [
        '- A public Git repository containing the React + TypeScript application, the mock API and the seed data.',
        '- A deployed preview, for example on GitHub Pages, Netlify or Vercel free tiers.',
        '- A README explaining how to run the project, the component structure and the known limitations.',
        '- An accessibility checklist document recording what you tested, how you tested it, what you fixed and what remains.',
        '- A short written reflection (about 500 words) on the feedback you received and what you would do differently.',
      ].join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        '- Quality (50%): requirements met; correct behaviour in loading, empty and error states; readable, typed components; accessibility checklist items demonstrably satisfied.',
        '- Process (30%): small, meaningful commits; tasks submitted on time or with an early extension request; review feedback addressed.',
        '- Communication (20%): a clear README and reflection; submission notes that explain what changed between versions.',
      ].join('\n'),
      submissionGuidelines: [
        '- Submit repository links from github.com, gitlab.com or bitbucket.org. Other hosts are rejected by the platform.',
        '- Include the commit SHA you want reviewed in the commit field.',
        '- Document links can point to a Markdown file in your repository.',
        '- In each submission note, list what you completed, what you did not complete and any questions for your mentor.',
        '- All work must be your own. You may use libraries and documentation, but you must disclose AI-assisted code in your notes. Copying another participant’s work leads to rejection of the task.',
      ].join('\n'),
    },
    milestones: [
      {
        title: 'Setup and component plan',
        description: 'Week 1: set up the toolchain and plan the interface before writing features.',
        order: 1,
        isRequired: true,
        tasks: [
          {
            key: 'fe-setup',
            title: 'Repository setup and component plan',
            description:
              'Create the repository with React + TypeScript (Vite or Next.js), a linter and a formatter. Add the mock API and the seed data that follow the data contract. Write a one-page plan listing your components, their props and how the data flows between them.',
            acceptanceCriteria:
              'The project runs with one documented command. Lint passes. The mock API serves at least 12 sessions. The plan covers the catalogue, filters and every registration step.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'DOCUMENT'],
            dueOffsetDays: 7,
            order: 1,
          },
        ],
      },
      {
        title: 'Session catalogue',
        description: 'Weeks 2–3: data fetching, rendering, search and filters.',
        order: 2,
        isRequired: true,
        tasks: [
          {
            key: 'fe-catalogue',
            title: 'Session list with search and URL-synced filters',
            description:
              'Implement requirements 1–3: the catalogue, search, combinable filters, and the loading, empty and error states.',
            acceptanceCriteria:
              'Filters survive a page refresh. Stopping the mock API shows the error state with a working retry. The page can be used with a keyboard alone and focus is always visible.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 21,
            order: 1,
            dependsOn: ['fe-setup'],
          },
        ],
      },
      {
        title: 'Registration flow and accessibility',
        description: 'Weeks 4–5: multi-step form, validation and an accessibility pass.',
        order: 3,
        isRequired: true,
        tasks: [
          {
            key: 'fe-registration',
            title: 'Multi-step registration form with validation',
            description:
              'Implement requirements 4–5. Handle the 409 SOLD_OUT response from the mock API gracefully.',
            acceptanceCriteria:
              'Time clashes and sold-out sessions are blocked with clear messages. Errors are linked to their fields with aria-describedby. Going back keeps entered data. Submitting shows a confirmation.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 32,
            order: 1,
            dependsOn: ['fe-catalogue'],
          },
          {
            key: 'fe-a11y',
            title: 'Accessibility audit and fixes',
            description:
              'Audit the whole interface with keyboard-only use, a screen reader (NVDA, VoiceOver or TalkBack), an automated checker such as axe DevTools, and a contrast checker. Record each issue, fix it and re-test it.',
            acceptanceCriteria:
              'The checklist document lists the tools used, every issue found, the fix applied and the re-test result. No critical automated-checker violations remain.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'DOCUMENT'],
            dueOffsetDays: 37,
            order: 2,
            dependsOn: ['fe-registration'],
          },
        ],
      },
      {
        title: 'Delivery',
        description: 'Week 6: deploy, document and reflect.',
        order: 4,
        isRequired: true,
        tasks: [
          {
            key: 'fe-delivery',
            title: 'Deployment, README and reflection',
            description:
              'Deploy a preview, finish the README and write the reflection described in the deliverables.',
            acceptanceCriteria:
              'The preview URL loads and works at 360px and desktop widths. The README lets a new developer run the project. The reflection refers to specific review feedback.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'LIVE_DEMO', 'DOCUMENT'],
            dueOffsetDays: 42,
            order: 1,
            dependsOn: ['fe-a11y'],
          },
        ],
      },
    ],
    readiness: {
      state: 'DRAFT_REQUIRES_MENTOR',
      conditions: [MENTOR_CONDITION('Frontend Development'), ...COMMON_CONDITIONS],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'backend-library-api',
    track: 'Backend API Development Track',
    domain: 'Backend Development',
    program: {
      title: 'Backend Development Internship: Library Lending REST API',
      durationWeeks: 8,
      level: 'BEGINNER',
      seats: 3,
    },
    hoursPerWeek: '10–12',
    project: {
      title: 'Library Lending REST API',
      sourceType: 'SIMULATED',
      difficulty: 'BEGINNER',
      durationWeeks: 8,
      requiredSkills: ['Node.js', 'Express.js', 'PostgreSQL'],
      problemStatement: [
        'Scenario (fictional organisation): a small reading club runs a lending library of about 500 donated books. Loans are tracked in a notebook, so books go missing, members borrow more than allowed, and nobody knows what is overdue.',
        '',
        'You will design, build, test and document a REST API that enforces the lending rules. It runs locally or on a free tier, uses only fictional seed data, and has no real users.',
        '',
        'The point of the project is to learn how backend services keep data correct: validation, business rules, database transactions, consistent errors and automated tests.',
      ].join('\n'),
      objectives: [
        'By the end you should be able to:',
        '- design a resource-oriented API contract (OpenAPI 3) and a relational data model before coding;',
        '- implement validated CRUD endpoints with Node.js, Express and PostgreSQL through an ORM or query builder;',
        '- enforce business rules safely under concurrent requests using database transactions and constraints;',
        '- return consistent, documented error responses with correct HTTP status codes;',
        '- write automated integration tests against an isolated test database.',
      ].join('\n'),
      requirements: [
        'FUNCTIONAL REQUIREMENTS',
        '1. Books: create, list (paginated, searchable by title or author), get, update and retire. A book has one or more physical copies.',
        '2. Members: create, list, get and deactivate. Deactivated members cannot borrow.',
        '3. Loans: borrow a copy (due in 14 days) and return it. A member may hold at most 3 active loans. A copy cannot be lent twice at the same time, even if two requests arrive together. Overdue members cannot borrow until they return their overdue books.',
        '4. Reports: list overdue loans, and show the loan history for a member.',
        '5. Errors: one JSON error format { error, message, details? }. Use 400 for validation, 404 for missing records, 409 for rule conflicts and 500 without leaking internals.',
        '6. Stretch (optional task): only authenticated "librarian" users can create, update and retire books and members. Reads stay public.',
        '',
        'NON-FUNCTIONAL',
        '- Configuration through environment variables, with no secrets in the repository.',
        '- Seed data is fictional, with no real names or contact details.',
        '- Tests run against a separate test database and never against the development database.',
        '',
        'PREREQUISITES / ELIGIBILITY',
        '- Assessment result: BEGINNER or above in Backend Development.',
        '- Comfortable with JavaScript or TypeScript, and basic SQL (SELECT, JOIN, INSERT).',
        '- Able to install Node.js and PostgreSQL locally (Docker is optional).',
        '',
        participationTerms('10–12', 8),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: [
        '- A public Git repository containing the API source, database migrations, seed script and tests.',
        '- An OpenAPI 3 specification that matches the implemented behaviour.',
        '- An entity-relationship diagram and a short design note explaining how the "no double lending" and "max 3 loans" rules are enforced.',
        '- An automated test suite covering every business rule and every error status.',
        '- A README with setup steps, environment variables, and how to run the tests.',
      ].join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        '- Quality (50%): every business rule is enforced server-side, including under concurrent requests; responses are consistent; tests are meaningful and pass.',
        '- Process (30%): the design comes before code, commits are incremental, and review feedback is acted on.',
        '- Communication (20%): an accurate OpenAPI spec, a clear design note and README, and useful submission notes.',
      ].join('\n'),
      submissionGuidelines: [
        '- Submit repository links from github.com, gitlab.com or bitbucket.org, with the commit SHA you want reviewed.',
        '- Document links (spec, design note) can point to files in your repository.',
        '- Every submission must keep the test suite passing. Say in your notes if a test is skipped, and why.',
        '- All work must be your own. Disclose AI-assisted code in your notes.',
      ].join('\n'),
    },
    milestones: [
      {
        title: 'Design',
        description: 'Week 1: contract and data model before code.',
        order: 1,
        isRequired: true,
        tasks: [
          {
            key: 'be-design',
            title: 'API contract and data model',
            description:
              'Write a draft OpenAPI 3 specification for all the endpoints and an entity-relationship diagram (books, copies, members, loans). Include the error format.',
            acceptanceCriteria:
              'Every functional requirement maps to at least one endpoint. Status codes are specified. The data model shows the keys and the constraints that support the lending rules.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 7,
            order: 1,
          },
        ],
      },
      {
        title: 'Core resources',
        description: 'Weeks 2–3: project setup, books and members.',
        order: 2,
        isRequired: true,
        tasks: [
          {
            key: 'be-crud',
            title: 'Books and members endpoints with validation',
            description:
              'Set up the project (Express, PostgreSQL, migrations, seed). Implement requirements 1, 2 and 5 with request validation and pagination.',
            acceptanceCriteria:
              'Invalid input returns 400 with field details. Missing records return 404. Lists are paginated. The seed script creates fictional data. Migrations run from scratch.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 21,
            order: 1,
            dependsOn: ['be-design'],
          },
        ],
      },
      {
        title: 'Lending rules',
        description: 'Weeks 4–5: loans, returns and reports.',
        order: 3,
        isRequired: true,
        tasks: [
          {
            key: 'be-loans',
            title: 'Loans and returns with transactional rules',
            description:
              'Implement requirements 3 and 4. Enforce the rules in a single database transaction, backed by constraints, so that two simultaneous borrow requests cannot both succeed.',
            acceptanceCriteria:
              'There is a demonstrated concurrent-request test, or a written proof using two parallel requests. Rule violations return 409 with a clear message. The overdue report is correct.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 35,
            order: 1,
            dependsOn: ['be-crud'],
          },
        ],
      },
      {
        title: 'Quality',
        description: 'Weeks 6–7: tests, error handling and optional authentication.',
        order: 4,
        isRequired: true,
        tasks: [
          {
            key: 'be-tests',
            title: 'Automated integration tests',
            description:
              'Write integration tests (Vitest or Jest with supertest) against an isolated test database, covering every business rule and every error status.',
            acceptanceCriteria:
              'Tests pass with one documented command and never touch the development database. Each rule in requirement 3 has a passing and a failing case.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 47,
            order: 1,
            dependsOn: ['be-loans'],
          },
          {
            key: 'be-auth',
            title: 'Stretch: librarian-only write access',
            description:
              'Optional. Implement requirement 6 with hashed passwords and session or token authentication.',
            acceptanceCriteria:
              'Unauthenticated writes return 401, authenticated non-librarian users get 403, and passwords are never stored or logged in plain text.',
            isMandatory: false,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 49,
            order: 2,
            dependsOn: ['be-loans'],
          },
        ],
      },
      {
        title: 'Delivery',
        description: 'Week 8: documentation and handover.',
        order: 5,
        isRequired: true,
        tasks: [
          {
            key: 'be-docs',
            title: 'Final specification, design note and README',
            description:
              'Update the OpenAPI spec to match the code. Write the design note on how the rules are enforced, and finish the README.',
            acceptanceCriteria:
              'The spec matches the implemented behaviour, which the mentor spot-checks. A new developer can run the API and the tests from the README alone.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'DOCUMENT'],
            dueOffsetDays: 56,
            order: 1,
            dependsOn: ['be-tests'],
          },
        ],
      },
    ],
    readiness: {
      state: 'DRAFT_REQUIRES_MENTOR',
      conditions: [MENTOR_CONDITION('Backend Development'), ...COMMON_CONDITIONS],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'fullstack-study-scheduler',
    track: 'Full-Stack and Software Quality Track',
    domain: 'Full Stack Development',
    program: {
      title: 'Full-Stack Development Internship: Study Group Scheduler',
      durationWeeks: 8,
      level: 'INTERMEDIATE',
      seats: 3,
    },
    hoursPerWeek: '12–15',
    project: {
      title: 'Study Group Scheduler',
      sourceType: 'SIMULATED',
      difficulty: 'INTERMEDIATE',
      durationWeeks: 8,
      requiredSkills: ['Next.js Full Stack', 'Authentication/Authorization', 'Testing (Jest, Vitest, Cypress)'],
      problemStatement: [
        'Scenario: students who want to form study groups end up coordinating meeting times in long chat threads, and sessions often fall through.',
        '',
        'You will build a small full-stack web application. Users create study groups, invite members, propose time slots and mark their availability. The organiser then confirms a session.',
        '',
        'The application is a learning project with fictional seed data. It is not deployed for real users and does not collect real personal data.',
        '',
        'The point of the project is to deliver complete features across the stack, with server-side authorization and automated tests as first-class requirements.',
      ].join('\n'),
      objectives: [
        'By the end you should be able to:',
        '- plan a feature-sized application: requirements, data model, routes and permissions;',
        '- implement authentication and resource-level authorization on the server, not only in the UI;',
        '- build validated forms and API routes with consistent error handling;',
        '- write unit, integration and end-to-end tests for the critical user journeys;',
        '- deploy an application with environment-based configuration and document how it works.',
      ].join('\n'),
      requirements: [
        'FUNCTIONAL REQUIREMENTS',
        '1. Accounts: register, log in and log out with email and password. Passwords are hashed. Sessions use HttpOnly cookies.',
        '2. Groups: any user can create a group and becomes its organiser. The organiser invites members with a shareable invite code, and can remove members.',
        '3. Scheduling: the organiser proposes 2–5 time slots. Members mark each slot as available or unavailable. Everyone sees an availability summary. The organiser confirms one slot, which locks voting.',
        '4. Authorization, enforced on the server: only members can view a group; only the organiser can propose, confirm or remove; non-members get 404 for a group’s resources.',
        '5. Validation on both client and server, with clear error messages. Slots cannot be in the past or overlap.',
        '6. Stretch (optional task): accessibility and performance pass.',
        '',
        'PREREQUISITES / ELIGIBILITY',
        '- Assessment result: INTERMEDIATE in Full Stack Development.',
        '- You have previously built a web application with both a frontend and a database-backed API, even a small one.',
        '- Working knowledge of Git, TypeScript and SQL or an ORM.',
        '',
        participationTerms('12–15', 8),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: [
        '- A public Git repository containing the full application, migrations, a fictional seed script and tests.',
        '- An architecture note (1–2 pages) covering the data model, the authorization rules and the key trade-offs.',
        '- An automated test suite including at least one end-to-end journey (register → create group → invite → vote → confirm) and authorization tests proving that non-members and non-organisers are refused.',
        '- A deployed preview on a free tier with a demo account that uses fictional data.',
        '- A short retrospective covering what went well, what did not and what you would change.',
      ].join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        '- Quality (50%): features complete and correct; authorization enforced server-side (verified by tests); validation and errors consistent; code organised and typed.',
        '- Process (30%): incremental delivery against milestones, early communication about risks, and feedback addressed.',
        '- Communication (20%): an accurate architecture note and README, and a useful retrospective and submission notes.',
      ].join('\n'),
      submissionGuidelines: [
        '- Submit repository links from github.com, gitlab.com or bitbucket.org, with the commit SHA you want reviewed.',
        '- Live demo links must point to your own deployment. Never include real personal data.',
        '- Never commit secrets. Use environment variables and provide an .env.example file.',
        '- All work must be your own. Disclose AI-assisted code in your notes.',
      ].join('\n'),
    },
    milestones: [
      {
        title: 'Plan',
        description: 'Week 1: requirements, data model and authorization matrix.',
        order: 1,
        isRequired: true,
        tasks: [
          {
            key: 'fs-plan',
            title: 'Requirements, data model and authorization matrix',
            description:
              'Write the architecture note draft. Include the entities and relations, the API routes, and a matrix of which role (anonymous, member, organiser) can perform which action.',
            acceptanceCriteria:
              'Every functional requirement is traceable to routes and tables. The authorization matrix covers every route.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 7,
            order: 1,
          },
        ],
      },
      {
        title: 'Accounts and groups',
        description: 'Weeks 2–3.',
        order: 2,
        isRequired: true,
        tasks: [
          {
            key: 'fs-groups',
            title: 'Authentication and group management',
            description: 'Implement requirements 1 and 2, with server-side validation.',
            acceptanceCriteria:
              'Passwords are hashed. Session cookies are HttpOnly. Invite codes work. A non-member who requests a group gets 404. An organiser can remove a member.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 21,
            order: 1,
            dependsOn: ['fs-plan'],
          },
        ],
      },
      {
        title: 'Scheduling',
        description: 'Weeks 4–5.',
        order: 3,
        isRequired: true,
        tasks: [
          {
            key: 'fs-scheduling',
            title: 'Time-slot proposals, availability voting and confirmation',
            description: 'Implement requirements 3–5.',
            acceptanceCriteria:
              'Past or overlapping slots are rejected. Confirming a slot locks voting. Only the organiser can propose or confirm. The availability summary is correct.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 35,
            order: 1,
            dependsOn: ['fs-groups'],
          },
        ],
      },
      {
        title: 'Verification',
        description: 'Weeks 6–7.',
        order: 4,
        isRequired: true,
        tasks: [
          {
            key: 'fs-tests',
            title: 'Authorization tests and end-to-end journey',
            description:
              'Write integration tests for every row of the authorization matrix, and an end-to-end test (Playwright or Cypress) for the main journey.',
            acceptanceCriteria:
              'Tests pass with one documented command. Each forbidden action in the matrix has a test proving it is refused by the server.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 45,
            order: 1,
            dependsOn: ['fs-scheduling'],
          },
          {
            key: 'fs-a11y-perf',
            title: 'Stretch: accessibility and performance pass',
            description:
              'Optional. Run Lighthouse and axe checks, fix the issues and record the before and after results.',
            acceptanceCriteria:
              'The document shows the before and after results and lists the fixes. No critical accessibility violations remain on the main journey.',
            isMandatory: false,
            evidenceTypes: ['CODE', 'DOCUMENT'],
            dueOffsetDays: 49,
            order: 2,
            dependsOn: ['fs-scheduling'],
          },
        ],
      },
      {
        title: 'Delivery',
        description: 'Week 8.',
        order: 5,
        isRequired: true,
        tasks: [
          {
            key: 'fs-delivery',
            title: 'Deployment, documentation and retrospective',
            description:
              'Deploy a preview, finalise the architecture note and README, and write the retrospective.',
            acceptanceCriteria:
              'The preview works with the fictional demo account. The documentation matches the implementation. The retrospective refers to specific feedback.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'LIVE_DEMO', 'DOCUMENT'],
            dueOffsetDays: 56,
            order: 1,
            dependsOn: ['fs-tests'],
          },
        ],
      },
    ],
    readiness: {
      state: 'DRAFT_REQUIRES_MENTOR',
      conditions: [MENTOR_CONDITION('Full Stack Development'), ...COMMON_CONDITIONS],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'qa-regression-suite',
    track: 'Full-Stack and Software Quality Track',
    domain: 'Full Stack Development',
    program: {
      title: 'Software Testing Internship: Test Plan and Automated Regression Suite',
      durationWeeks: 6,
      level: 'BEGINNER',
      seats: 3,
    },
    hoursPerWeek: '8–10',
    project: {
      title: 'Test Plan and Automated Regression Suite for an Open-Source Web Application',
      sourceType: 'SIMULATED',
      difficulty: 'BEGINNER',
      durationWeeks: 6,
      requiredSkills: ['Testing (Jest, Vitest, Cypress)'],
      problemStatement: [
        'Many small open-source web applications have few automated tests, so regressions slip through between releases.',
        '',
        'You will act as the QA engineer for a LOCAL COPY of an open-source web application. You choose it with your mentor from InternPath’s approved target list in week 1. You will plan the testing, explore the app, write reproducible bug reports, and build an automated regression suite that runs in CI.',
        '',
        'You test only your own local copy. Never test anyone’s hosted or production service, never run load or security attacks, and never use real personal data.',
        '',
        'The point of the project is to learn systematic testing: risk-based planning, clear defect reporting and maintainable automation.',
      ].join('\n'),
      objectives: [
        'By the end you should be able to:',
        '- write a risk-based test plan that defines scope, approach, environments and exit criteria;',
        '- perform structured exploratory testing and write bug reports that someone else can reproduce;',
        '- automate API checks and UI journeys with a modern framework such as Playwright, Cypress, Vitest or Jest;',
        '- run a test suite in continuous integration (GitHub Actions or GitLab CI) and report results honestly, including flaky and skipped tests.',
      ].join('\n'),
      requirements: [
        'TARGET APPLICATION RULES',
        '- The target must come from InternPath’s approved target list, which the mentor provides in week 1. Every target on the list has an OSI-approved licence, runs locally with Docker or npm in under an hour, and has both a web UI and an HTTP API.',
        '- Run the target on your own machine or in CI only.',
        '- Do not file issues upstream unless your mentor has reviewed them first and the project’s contribution guidelines allow it. Many open-source maintainers are volunteers.',
        '',
        'WORK REQUIREMENTS',
        '1. A test plan covering features in scope, risk ranking, test types, environments, entry and exit criteria, and what is out of scope.',
        '2. At least 8 exploratory test charters with session notes.',
        '3. Bug reports, each with: title, environment, steps to reproduce, expected result, actual result, severity, and evidence (screenshot or log). Do not include sensitive data.',
        '4. At least 15 automated API checks and 5 automated UI journeys for the highest-risk features. Tests must be independent and repeatable.',
        '5. A CI workflow that starts the target, runs the suite and publishes a report.',
        '',
        'PREREQUISITES / ELIGIBILITY',
        '- Assessment result: BEGINNER or above in Full Stack Development.',
        '- Basic JavaScript or TypeScript, and comfort with the command line and Git.',
        '- Able to run Docker or Node.js locally.',
        '',
        participationTerms('8–10', 6),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: [
        '- The test plan document.',
        '- Exploratory testing charters and session notes.',
        '- Bug reports, written in your repository or in an issues document.',
        '- A public Git repository containing the automated API and UI tests and the CI workflow.',
        '- A final test report covering coverage of the planned scope, pass, fail, skipped and flaky counts, open defects and recommendations.',
      ].join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        '- Quality (50%): the plan is risk-based, the bug reports are reproducible by the mentor, and the automated tests are independent, readable and pass reliably in CI.',
        '- Process (30%): testing follows the plan, scope changes are recorded, and feedback is addressed.',
        '- Communication (20%): bug reports and the final report are clear and accurate. Results are reported honestly, with no hidden skipped or flaky tests.',
      ].join('\n'),
      submissionGuidelines: [
        '- Submit repository links from github.com, gitlab.com or bitbucket.org, with the commit SHA you want reviewed.',
        '- Document links can point to Markdown files in your repository.',
        '- Never include credentials, tokens or personal data in reports or screenshots.',
        '- All work must be your own. Disclose AI-assisted code in your notes.',
      ].join('\n'),
    },
    milestones: [
      {
        title: 'Planning',
        description: 'Week 1: choose the target with your mentor and write the test plan.',
        order: 1,
        isRequired: true,
        tasks: [
          {
            key: 'qa-plan',
            title: 'Target selection and risk-based test plan',
            description:
              'Agree the target application with your mentor. Run it locally. Write the test plan (work requirement 1).',
            acceptanceCriteria:
              'The target is running locally and the plan records its version or commit. The plan ranks at least 5 features by risk and defines exit criteria.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 7,
            order: 1,
          },
        ],
      },
      {
        title: 'Exploratory testing',
        description: 'Weeks 2–3.',
        order: 2,
        isRequired: true,
        tasks: [
          {
            key: 'qa-explore',
            title: 'Exploratory charters and bug reports',
            description: 'Complete work requirements 2 and 3.',
            acceptanceCriteria:
              'At least 8 charters with notes. Every bug report can be reproduced by the mentor from its steps alone.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 17,
            order: 1,
            dependsOn: ['qa-plan'],
          },
        ],
      },
      {
        title: 'Automation',
        description: 'Weeks 3–5.',
        order: 3,
        isRequired: true,
        tasks: [
          {
            key: 'qa-api',
            title: 'Automated API checks',
            description: 'Write at least 15 independent API checks for the highest-risk features.',
            acceptanceCriteria:
              'Tests pass repeatedly from a clean start. Each test sets up and cleans up its own data. Assertions check status codes and response content.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 28,
            order: 1,
            dependsOn: ['qa-plan'],
          },
          {
            key: 'qa-ui',
            title: 'Automated UI journeys',
            description: 'Write at least 5 UI journey tests with Playwright or Cypress.',
            acceptanceCriteria:
              'Journeys use stable selectors such as roles or labels, not brittle CSS chains. Tests pass three runs in a row.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 35,
            order: 2,
            dependsOn: ['qa-api'],
          },
        ],
      },
      {
        title: 'Continuous integration and reporting',
        description: 'Week 6.',
        order: 4,
        isRequired: true,
        tasks: [
          {
            key: 'qa-ci-report',
            title: 'CI pipeline and final test report',
            description: 'Complete work requirement 5 and write the final test report.',
            acceptanceCriteria:
              'CI runs on every push and publishes results. The report states the exact pass, fail, skipped and flaky counts and lists the open defects.',
            isMandatory: true,
            evidenceTypes: ['CODE', 'DOCUMENT'],
            dueOffsetDays: 42,
            order: 1,
            dependsOn: ['qa-ui'],
          },
        ],
      },
    ],
    readiness: {
      state: 'DRAFT_REQUIRES_MENTOR_AND_TARGET_LIST',
      conditions: [
        MENTOR_CONDITION('Full Stack Development'),
        'The project owner (InternPath) must publish the approved target list: 3–5 open-source applications whose OSI licence and local runnability have been verified by a mentor. The list must exist before the program is opened.',
        ...COMMON_CONDITIONS,
      ],
    },
  },

  /* ---------------------------------------------------------------- */
  {
    key: 'data-open-government-eda',
    track: 'Data Analysis Track',
    domain: 'Data & Analytics',
    program: {
      title: 'Data Analysis Internship: Exploratory Analysis of Open Government Data',
      durationWeeks: 6,
      level: 'BEGINNER',
      seats: 3,
    },
    hoursPerWeek: '8–10',
    project: {
      title: 'Exploratory Analysis of an Indian Open Government Dataset',
      sourceType: 'SIMULATED',
      difficulty: 'BEGINNER',
      durationWeeks: 6,
      requiredSkills: ['Python for Data Analysis', 'SQL', 'Statistics'],
      problemStatement: [
        'Public open datasets are often published without any accessible analysis, so citizens, students and journalists struggle to understand what they show and what they cannot show.',
        '',
        'You will choose a dataset published on the Open Government Data Platform India (data.gov.in) under the Government Open Data License – India, or another dataset with an explicit open licence approved by your mentor. You will then frame questions, clean the data, analyse it, visualise it, and write an honest findings report that states its limitations.',
        '',
        'Only aggregated, non-personal data may be used. Datasets containing information about identifiable individuals are not allowed.',
        '',
        'The point of the project is to learn the full analysis cycle and responsible communication of results.',
      ].join('\n'),
      objectives: [
        'By the end you should be able to:',
        '- choose a dataset responsibly by checking its licence, provenance and the absence of personal data;',
        '- write answerable analysis questions before looking for patterns;',
        '- clean and document data issues reproducibly with pandas, and query the cleaned data with SQL (for example SQLite or DuckDB);',
        '- use descriptive statistics and appropriate charts without overstating causation;',
        '- write a findings report that separates what the data shows from what it does not.',
      ].join('\n'),
      requirements: [
        'DATASET RULES',
        '- Licence: Government Open Data License – India (data.gov.in), or CC BY 4.0, CC0 or ODbL with mentor approval. Record the licence and the attribution exactly as the publisher requires.',
        '- No personal data: the data must be aggregated, for example by district, year or category.',
        '- Size: at least 1,000 rows, or several related tables, so that cleaning and analysis are meaningful.',
        '',
        'WORK REQUIREMENTS',
        '1. Write 3–5 analysis questions before you start exploring, with a reason why each question matters.',
        '2. A cleaning notebook that loads the raw data unchanged, then documents every transformation and keeps a data-quality log covering missing values, duplicates, unit inconsistencies and outliers.',
        '3. Analysis using pandas plus at least 5 SQL queries over the cleaned data, with descriptive statistics for each question.',
        '4. At least 5 charts, each with a title, labelled axes with units, the source and a one-sentence takeaway. Use colour-blind-safe palettes.',
        '5. A findings report (1,500–2,500 words) covering the answer to each question, how confident you are, the limitations, and what further data would be needed.',
        '',
        'PREREQUISITES / ELIGIBILITY',
        '- Assessment result: BEGINNER or above in Data & Analytics.',
        '- Introductory Python (variables, functions, lists or dataframes) or SQL (SELECT, GROUP BY).',
        '- Able to run Jupyter notebooks locally or in a free hosted notebook environment.',
        '',
        participationTerms('8–10', 6),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: [
        '- A public Git repository containing the notebooks, SQL queries, a requirements file and a data README with the source, licence, attribution and download date. Include raw data only where the licence allows redistribution.',
        '- The data-quality log.',
        '- Charts exported as images, alongside the notebooks.',
        '- The findings report, as Markdown or PDF.',
      ].join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        '- Quality (50%): the analysis is reproducible from raw data; methods suit the questions; charts are honest and readable; conclusions are supported by the evidence.',
        '- Process (30%): questions were defined before exploration, cleaning decisions are documented, and feedback is addressed.',
        '- Communication (20%): the report is clear, limitations and uncertainty are stated, and the licence and attribution are correct.',
      ].join('\n'),
      submissionGuidelines: [
        '- Submit repository links from github.com, gitlab.com or bitbucket.org, with the commit SHA you want reviewed.',
        '- Notebooks must run top to bottom on a fresh environment using your requirements file.',
        '- Do not upload data whose licence forbids redistribution. Provide download instructions instead.',
        '- All work must be your own. Disclose AI-assisted analysis or code in your notes.',
      ].join('\n'),
    },
    milestones: [
      {
        title: 'Framing',
        description: 'Week 1: choose the dataset and write the questions.',
        order: 1,
        isRequired: true,
        tasks: [
          {
            key: 'da-framing',
            title: 'Dataset selection and analysis questions',
            description:
              'Propose a dataset with its licence, publisher and description. Confirm that it contains no personal data. Write 3–5 analysis questions (work requirement 1).',
            acceptanceCriteria:
              'The licence is recorded with an exact attribution. The mentor confirms the dataset meets the dataset rules. The questions are specific and answerable from the data.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 7,
            order: 1,
          },
        ],
      },
      {
        title: 'Cleaning',
        description: 'Weeks 2–3.',
        order: 2,
        isRequired: true,
        tasks: [
          {
            key: 'da-cleaning',
            title: 'Reproducible cleaning notebook and data-quality log',
            description: 'Complete work requirement 2.',
            acceptanceCriteria:
              'The notebook runs from the raw files without manual steps. Every transformation is explained. The data-quality log quantifies each issue.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 17,
            order: 1,
            dependsOn: ['da-framing'],
          },
        ],
      },
      {
        title: 'Analysis and visualisation',
        description: 'Weeks 3–5.',
        order: 3,
        isRequired: true,
        tasks: [
          {
            key: 'da-analysis',
            title: 'Exploratory analysis with pandas and SQL',
            description: 'Complete work requirement 3.',
            acceptanceCriteria:
              'Each question has supporting statistics. At least 5 SQL queries run against the cleaned data. No causal claims are made from correlations.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 28,
            order: 1,
            dependsOn: ['da-cleaning'],
          },
          {
            key: 'da-charts',
            title: 'Visualisations',
            description: 'Complete work requirement 4.',
            acceptanceCriteria:
              'At least 5 charts meet every chart rule in requirement 4. The axes do not mislead, for example by truncating them without saying so.',
            isMandatory: true,
            evidenceTypes: ['CODE'],
            dueOffsetDays: 33,
            order: 2,
            dependsOn: ['da-analysis'],
          },
        ],
      },
      {
        title: 'Reporting',
        description: 'Week 6.',
        order: 4,
        isRequired: true,
        tasks: [
          {
            key: 'da-report',
            title: 'Findings report with limitations',
            description: 'Complete work requirement 5.',
            acceptanceCriteria:
              'Every question is answered with a stated level of confidence. The limitations section is specific to this dataset. The licence attribution is correct.',
            isMandatory: true,
            evidenceTypes: ['DOCUMENT'],
            dueOffsetDays: 42,
            order: 1,
            dependsOn: ['da-charts'],
          },
        ],
      },
    ],
    readiness: {
      state: 'DRAFT_REQUIRES_MENTOR',
      conditions: [MENTOR_CONDITION('Data & Analytics'), ...COMMON_CONDITIONS],
    },
  },
];
