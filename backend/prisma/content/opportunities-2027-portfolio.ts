// InternPath opportunity content package — 2027 Portfolio Projects (v1)
//
// Pure data, no I/O. 25 GENUINE programs + project briefs (5 per domain) for
// real applicants: portfolio-grade, job-relevant projects a student can show
// in interviews or submit as an academic/major project.
//
// Same authenticity rules as opportunities-2027-summer.ts:
//  - Organizer is InternPath. Every brief is SIMULATED: any organisation in a
//    scenario is fictional; there is no client, sponsor, employer or partner.
//  - UNPAID, no job/placement/interview/academic-credit promise. Participants
//    own their work and are encouraged to publish it under an open licence.
//  - Datasets are public and openly licensed; students must re-check the
//    licence on the dataset page and cite it.
//  - The participation terms below quote the rubric and thresholds that
//    actually ship (default rubric migration 20261124000000 and settings
//    defaults completionThreshold=60, appreciationThreshold=85).
//
// Mapping onto the schema: each opportunity becomes ONE Program (DRAFT) and
// ONE Project (DRAFT, SIMULATED) with milestones, tasks and dependencies.
// Import with scripts/content-import-opportunities.ts --package=portfolio.

import type {
  EvidenceType,
  Level,
  MilestoneContent,
  OpportunityContent,
  TaskContent,
} from './opportunities-2027-summer';

export const CONTENT_PACKAGE_ID = 'internpath-2027-portfolio-v1';

// PROPOSED dates (owner decision; overridable at import time with
// INTERNPATH_COHORT_DEADLINE / INTERNPATH_COHORT_START): applications close
// 15 Jan 2027 23:59 IST, the cohort starts 1 Feb 2027 09:00 IST — the start of
// the even semester at most Indian universities, so the work can double as a
// semester project.
export const COHORT = {
  name: '2027 Spring Portfolio Cohort',
  applicationDeadline: '2027-01-15T18:29:59.000Z',
  startDate: '2027-02-01T03:30:00.000Z',
} as const;

/* ------------------------------------------------------------------ */
/* Shared text                                                         */
/* ------------------------------------------------------------------ */

function participationTerms(hoursPerWeek: string, weeks: number): string {
  return [
    'PARTICIPATION TERMS (read before applying)',
    '- Organizer: InternPath. This brief was written by InternPath for learning. Any organisation in the scenario is fictional. There is no external client, sponsor, employer or partner.',
    '- Compensation: UNPAID. InternPath charges participants nothing at any stage. If anyone asks you for money, report it in the platform (Reports > Payment request).',
    '- Ownership: your work is not used in any InternPath product. You keep the copyright; we recommend publishing it in your own repository under an open-source licence such as MIT, so you can show it to employers.',
    `- Workload: about ${hoursPerWeek} hours per week, remote and self-scheduled, for ${weeks} weeks. Ask your mentor early if you need more time: an administrator can grant one extension of up to 7 days.`,
    '- Mentorship: an InternPath mentor with expertise in this domain reviews each submission in the platform and writes feedback (target: within 3 days).',
    '- Evaluation: every mandatory task must be approved. The final rubric: technical quality 30%, problem solving and independence 20%, delivery against milestones 20%, code quality/testing/documentation 15%, communication and response to feedback 15%.',
    '- Certificate: a verifiable completion certificate is issued only if all mandatory tasks are approved, the final score is at least 60/100 and your mentor recommends completion. A score of 85+ with a mentor recommendation can also earn a certificate of appreciation. Neither is guaranteed.',
    '- Not offered: no job offer, placement, interview referral or academic credit is promised. If you want to submit this as an academic project, confirm with your institution first.',
    '- Leaving: you can withdraw at any time from your internship page.',
  ].join('\n');
}

const APPLICATION_INSTRUCTIONS = [
  'HOW TO APPLY',
  '1. Complete your student profile (institution, degree, year, graduation year, skills).',
  '2. Take the skills assessment for this domain; your result must meet the program level.',
  '3. Write a statement of interest (max 2000 characters): why this project, links to one or two things you have built, your weekly availability, and anything that could affect participation.',
  '4. Submit before the deadline. If approved, accept the offer within 3 days; an administrator then assigns your mentor and this project.',
].join('\n');

const SUBMISSION_GUIDELINES = [
  '- Submit repository links from github.com, gitlab.com or bitbucket.org (other hosts are rejected), with the commit SHA you want reviewed.',
  '- Documents may be Markdown files in your repository; dashboards may be shared via a public link plus screenshots in the repository.',
  '- In each submission note, list what you completed, what is missing and any questions for your mentor.',
  '- All work must be your own. Libraries and documentation are fine; disclose AI-assisted code in your notes. Copying another participant’s work leads to rejection.',
  '- Never commit secrets (API keys, passwords). Use environment variables and a committed .env.example.',
].join('\n');

const READINESS_CONDITIONS = (domain: string) => [
  `A real MENTOR account with "${domain}" expertise and free capacity must be provisioned and must review this brief before the program is opened.`,
  'Confirm the proposed dates and reset seats to the confirmed mentor capacity before changing the program from DRAFT to OPEN.',
  'Publish the project (submit, approve, publish) before opening the program so applicants can read the full brief and terms.',
];

/* ------------------------------------------------------------------ */
/* Builders (keep each brief readable; orders are assigned here)        */
/* ------------------------------------------------------------------ */

type T = Omit<TaskContent, 'order' | 'isMandatory'> & { optional?: boolean };

function t(
  key: string,
  title: string,
  description: string,
  acceptanceCriteria: string,
  evidenceTypes: EvidenceType[],
  dueOffsetDays: number,
  dependsOn?: string[],
  optional = false
): T {
  return { key, title, description, acceptanceCriteria, evidenceTypes, dueOffsetDays, dependsOn, optional };
}

interface M extends Omit<MilestoneContent, 'order' | 'tasks'> {
  tasks: T[];
}

function m(title: string, description: string, tasks: T[]): M {
  return { title, description, isRequired: tasks.some((x) => !x.optional), tasks };
}

interface Spec {
  key: string;
  domain: string;
  level: Level;
  weeks: 4 | 6 | 8;
  hours: string;
  programTitle: string;
  projectTitle: string;
  skills: string[];
  scenario: string[];
  outcomes: string[];
  requirements: string[];
  prerequisites: string[];
  deliverables: string[];
  qualityFocus: string;
  milestones: M[];
}

function opportunity(s: Spec): OpportunityContent {
  return {
    key: s.key,
    track: `${s.domain} Portfolio Track`,
    domain: s.domain,
    program: { title: s.programTitle, durationWeeks: s.weeks, level: s.level, seats: 3 },
    hoursPerWeek: s.hours,
    project: {
      title: s.projectTitle,
      sourceType: 'SIMULATED',
      difficulty: s.level,
      durationWeeks: s.weeks,
      requiredSkills: s.skills,
      problemStatement: s.scenario.join('\n\n'),
      objectives: ['By the end you should be able to:', ...s.outcomes.map((o) => `- ${o}`)].join('\n'),
      requirements: [
        'FUNCTIONAL REQUIREMENTS',
        ...s.requirements.map((r, i) => `${i + 1}. ${r}`),
        '',
        'PREREQUISITES / ELIGIBILITY',
        `- Assessment result: ${s.level} or above in ${s.domain}.`,
        ...s.prerequisites.map((p) => `- ${p}`),
        '',
        participationTerms(s.hours, s.weeks),
        '',
        APPLICATION_INSTRUCTIONS,
      ].join('\n'),
      expectedDeliverables: s.deliverables.map((d) => `- ${d}`).join('\n'),
      evaluationCriteria: [
        'Each task is approved against its acceptance criteria. The final evaluation uses the platform rubric:',
        `- Technical quality (30%): ${s.qualityFocus}`,
        '- Problem solving and independence (20%): sensible decisions, documented trade-offs, blockers raised early with a proposed approach.',
        '- Delivery against milestones (20%): tasks submitted on time or with an early extension request.',
        '- Code quality, testing and documentation (15%): readable code, meaningful tests, a README a stranger can follow.',
        '- Communication and response to feedback (15%): clear submission notes; review feedback addressed in the next version.',
      ].join('\n'),
      submissionGuidelines: SUBMISSION_GUIDELINES,
    },
    milestones: s.milestones.map((ms, i) => ({
      title: ms.title,
      description: ms.description,
      order: i + 1,
      isRequired: ms.isRequired,
      tasks: ms.tasks.map(({ optional, ...task }, j) => ({ ...task, isMandatory: !optional, order: j + 1 })),
    })),
    readiness: { state: 'DRAFT_REQUIRES_MENTOR', conditions: READINESS_CONDITIONS(s.domain) },
  };
}

const CAREER_NOTE =
  'Why employers care: this project mirrors work junior engineers do in their first year, and the finished repository, demo and write-up are designed to be discussed in an interview.';

/* ================================================================== */
/* FRONTEND DEVELOPMENT                                                */
/* ================================================================== */

const FRONTEND: OpportunityContent[] = [
  opportunity({
    key: 'pf-fe-finance-dashboard',
    domain: 'Frontend Development',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Frontend Internship: Personal Finance Dashboard',
    projectTitle: 'Personal Finance Dashboard with Charts and CSV Import',
    skills: ['React', 'TypeScript', 'HTML/CSS', 'Tailwind CSS'],
    scenario: [
      'Scenario (fictional): students in a hostel track shared and personal spending in scattered notes and bank SMS messages, and cannot see where their money goes each month.',
      'You will build a client-side dashboard that imports transactions from CSV, categorises them, and visualises monthly spending against a budget. All data stays in the browser; use only fictional sample data.',
      CAREER_NOTE,
    ],
    outcomes: [
      'structure a React + TypeScript application into typed, reusable components;',
      'parse and validate user-supplied files and report errors clearly;',
      'derive aggregates (per month, per category) and render accessible charts;',
      'persist state locally and design responsive layouts from 360px upward.',
    ],
    requirements: [
      'Import a CSV (date, description, amount, optional category). Show a preview, flag invalid rows with the reason, and import only valid rows.',
      'Transactions table with sorting, text search, category and month filters, and inline category editing.',
      'Rule-based auto-categorisation ("description contains SWIGGY → Food"), editable by the user.',
      'Monthly budget per category with progress bars and an over-budget warning.',
      'Charts: spending by category (bar or donut) and a 6-month trend line, each with a text/table alternative for screen readers.',
      'Persist everything in localStorage/IndexedDB; export the cleaned data back to CSV.',
    ],
    prerequisites: [
      'You have built at least one small page with HTML, CSS and JavaScript and can use Git at a basic level.',
    ],
    deliverables: [
      'Public repository with the app, a sample CSV of at least 150 fictional transactions, and a README.',
      'Deployed preview on a free tier (GitHub Pages, Netlify or Vercel).',
      'A short design note: component tree, state shape, and how categorisation rules are applied.',
    ],
    qualityFocus: 'correct CSV validation and aggregates, charts with accessible alternatives, responsive layout without horizontal scroll.',
    milestones: [
      m('Setup and data model', 'Week 1: project scaffold and the transaction model.', [
        t('fd-setup', 'Scaffold, types and sample data', 'Create a Vite or Next.js React + TypeScript project with ESLint and Prettier. Define Transaction, Category and Budget types and write the sample CSV.', 'Project runs with one documented command; lint passes; the sample CSV has 150+ rows across 6 months and 8+ categories.', ['CODE'], 7),
      ]),
      m('Import and transactions', 'Weeks 2–3: CSV import, table and categorisation.', [
        t('fd-import', 'CSV import with row-level validation', 'Implement requirement 1 with a preview step. Handle bad dates, non-numeric amounts and missing columns.', 'Invalid rows are listed with line number and reason; valid rows import; re-importing the same file does not duplicate rows.', ['CODE'], 14, ['fd-setup']),
        t('fd-table', 'Transactions table and categorisation rules', 'Implement requirements 2 and 3.', 'Sorting, search and filters combine correctly; a new rule re-categorises matching transactions; the table works with keyboard only.', ['CODE'], 21, ['fd-import']),
      ]),
      m('Budgets and charts', 'Weeks 4–5: insight features.', [
        t('fd-charts', 'Budgets and accessible charts', 'Implement requirements 4 and 5.', 'Numbers in charts match the table totals; each chart has a data table alternative; over-budget categories are clearly flagged.', ['CODE'], 32, ['fd-table']),
        t('fd-persist', 'Persistence and CSV export', 'Implement requirement 6.', 'Data survives a reload; exported CSV re-imports cleanly; clearing data asks for confirmation.', ['CODE'], 35, ['fd-charts']),
      ]),
      m('Delivery', 'Week 6: deploy and document.', [
        t('fd-delivery', 'Deployment, README and design note', 'Deploy a preview and complete the README and design note.', 'Preview works at 360px and desktop; README explains setup and features; design note covers state and rules.', ['CODE', 'LIVE_DEMO', 'DOCUMENT'], 42, ['fd-persist']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fe-nextjs-storefront',
    domain: 'Frontend Development',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Frontend Internship: SEO-Ready E-commerce Storefront with Next.js',
    projectTitle: 'E-commerce Storefront with Next.js, Cart State and SEO',
    skills: ['Next.js', 'React', 'TypeScript', 'State Management (Redux, Zustand)', 'Tailwind CSS'],
    scenario: [
      'Scenario (fictional): a small handloom cooperative wants an online catalogue that loads fast on mobile data and appears in search results.',
      'You will build the storefront frontend — catalogue, product pages, cart and a mock checkout — against a mock product API you run yourself (for example the free DummyJSON products endpoint or your own JSON). No real payments or customer data.',
      CAREER_NOTE,
    ],
    outcomes: [
      'choose between static generation, server rendering and client rendering per page and justify it;',
      'manage cross-page client state (cart) with a store and persist it;',
      'implement SEO essentials: metadata, Open Graph, sitemap, structured data;',
      'measure and improve Core Web Vitals with Lighthouse.',
    ],
    requirements: [
      'Catalogue with category pages, search, price/rating filters and pagination; filters reflected in the URL.',
      'Product detail page with image gallery, variants (size/colour), stock state and related products; statically generated with revalidation.',
      'Cart drawer and cart page using Zustand or Redux Toolkit: add/remove, quantity limits by stock, totals with tax, persisted across reloads.',
      'Mock checkout: address form with validation, order summary, and a confirmation page (no payment integration).',
      'SEO: per-page metadata and Open Graph tags, sitemap.xml, robots.txt and Product JSON-LD.',
      'Performance: optimised images, Lighthouse mobile scores of 90+ for Performance, Accessibility and SEO on the home and product pages.',
    ],
    prerequisites: [
      'You have built a React application with routing and API calls, and understand TypeScript basics.',
    ],
    deliverables: [
      'Public repository and a deployed preview (Vercel free tier works well).',
      'A rendering-strategy note explaining SSG/SSR/CSR choices per route.',
      'Lighthouse reports (before and after optimisation) committed to the repository.',
    ],
    qualityFocus: 'correct rendering strategy per route, robust cart logic, measurable Lighthouse results and valid structured data.',
    milestones: [
      m('Plan and scaffold', 'Week 1: routes, data contract and rendering plan.', [
        t('ns-plan', 'Route map, data contract and rendering plan', 'Scaffold Next.js (App Router) with TypeScript and Tailwind. Document each route, its data source and its rendering strategy.', 'App runs; the plan lists every route with SSG/SSR/CSR and a reason; mock API serves 50+ products in 5+ categories.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Catalogue and product pages', 'Weeks 2–4.', [
        t('ns-catalogue', 'Catalogue with URL-synced search and filters', 'Implement requirement 1 with loading, empty and error states.', 'Filters survive refresh and are shareable via URL; pagination works; error state offers retry.', ['CODE'], 18, ['ns-plan']),
        t('ns-product', 'Statically generated product pages', 'Implement requirement 2 with generateStaticParams and revalidation.', 'Product pages are pre-rendered at build; variant and stock states are correct; unknown products show a 404 page.', ['CODE'], 28, ['ns-catalogue']),
      ]),
      m('Cart and checkout', 'Weeks 5–6.', [
        t('ns-cart', 'Persistent cart store', 'Implement requirement 3 with unit tests for the store.', 'Quantities cannot exceed stock; totals are correct to the paisa; cart survives reload; store logic has unit tests.', ['CODE'], 35, ['ns-product']),
        t('ns-checkout', 'Mock checkout flow', 'Implement requirement 4.', 'Invalid fields show linked error messages; confirmation shows an order summary; cart empties after confirmation.', ['CODE'], 42, ['ns-cart']),
      ]),
      m('SEO, performance and delivery', 'Weeks 7–8.', [
        t('ns-seo', 'SEO and performance pass', 'Implement requirements 5 and 6. Commit before/after Lighthouse reports.', 'JSON-LD validates in the Rich Results test; sitemap lists all products; mobile Lighthouse scores meet the targets.', ['CODE', 'DOCUMENT'], 50, ['ns-checkout']),
        t('ns-delivery', 'Deployment and rendering-strategy write-up', 'Deploy and finalise the README and rendering note.', 'Preview URL works; README covers setup, architecture and known limitations.', ['LIVE_DEMO', 'DOCUMENT'], 56, ['ns-seo']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fe-design-system',
    domain: 'Frontend Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Frontend Internship: Accessible Design System and Component Library',
    projectTitle: 'Accessible Design System and Component Library with Storybook',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'HTML/CSS'],
    scenario: [
      'Scenario (fictional): three student-club websites each re-implement buttons, forms and modals differently, with inconsistent colours and many accessibility bugs.',
      'You will build a small, documented, accessible component library with design tokens, Storybook documentation and automated tests, packaged so another project can install it.',
      CAREER_NOTE,
    ],
    outcomes: [
      'define design tokens (colour, spacing, type) and support light and dark themes;',
      'build components that follow WAI-ARIA Authoring Practices for keyboard and screen-reader use;',
      'document components with Storybook and test them with Testing Library;',
      'package and version a library with a changelog.',
    ],
    requirements: [
      'Design tokens as CSS variables with light and dark themes; all text meets WCAG AA contrast in both.',
      'Components: Button, TextField (with label, hint, error), Select, Checkbox, Radio group, Modal dialog (focus trap, Esc to close), Tabs, Toast and Tooltip.',
      'Each component is typed, forwards refs, and follows the matching WAI-ARIA pattern for keyboard interaction.',
      'Storybook with one story per state (default, disabled, error, loading) and usage guidance.',
      'Tests with Testing Library + jest-axe (or vitest-axe) for every component, including keyboard behaviour.',
      'Build the library as an installable package (ESM + type declarations) and demonstrate it in a small example app.',
    ],
    prerequisites: [
      'You have built several React components and are comfortable with props, state and TypeScript basics.',
    ],
    deliverables: [
      'Public repository with the library, Storybook deployed to a free host, and the example app.',
      'An accessibility conformance table: component × keyboard, screen reader, contrast, tested with which tools.',
      'CHANGELOG.md with semantic versions for each release you cut.',
    ],
    qualityFocus: 'keyboard and screen-reader behaviour matching WAI-ARIA patterns, consistent tokens, and tests that actually exercise interactions.',
    milestones: [
      m('Foundations', 'Week 1: tokens, tooling and the first component.', [
        t('ds-tokens', 'Design tokens, themes and Button', 'Set up the library build, Storybook and tests. Implement tokens (requirement 1) and Button.', 'Theme toggle switches all tokens; Button stories cover every state; contrast checks pass in both themes.', ['CODE'], 7),
      ]),
      m('Form components', 'Weeks 2–3.', [
        t('ds-forms', 'TextField, Select, Checkbox and Radio group', 'Implement the form components with labels, hints and error states.', 'Errors are linked with aria-describedby; Radio group uses arrow keys; jest-axe passes for every story.', ['CODE'], 21, ['ds-tokens']),
      ]),
      m('Overlay and navigation components', 'Weeks 4–5.', [
        t('ds-overlays', 'Modal, Tabs, Toast and Tooltip', 'Implement the remaining components following WAI-ARIA patterns.', 'Modal traps and restores focus and closes on Esc; Tabs support arrow/Home/End keys; Toasts are announced via a live region.', ['CODE'], 32, ['ds-forms']),
        t('ds-a11y', 'Accessibility conformance audit', 'Test every component with keyboard, a screen reader (NVDA/VoiceOver/TalkBack) and axe. Fill the conformance table and fix issues.', 'Every component has a completed row; no critical axe violations remain; fixes are linked to commits.', ['DOCUMENT', 'CODE'], 36, ['ds-overlays']),
      ]),
      m('Packaging and delivery', 'Week 6.', [
        t('ds-package', 'Package, example app and Storybook deployment', 'Build the package with type declarations, consume it from an example app, and deploy Storybook.', 'Example app installs the package from a local tarball or registry and renders every component; Storybook URL loads.', ['CODE', 'LIVE_DEMO', 'DOCUMENT'], 42, ['ds-a11y']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fe-kanban-pwa',
    domain: 'Frontend Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Frontend Internship: Offline-First Kanban Board PWA',
    projectTitle: 'Offline-First Kanban Task Board (Progressive Web App)',
    skills: ['React', 'TypeScript', 'State Management (Redux, Zustand)', 'HTML/CSS'],
    scenario: [
      'Scenario (fictional): a college project team plans work on a whiteboard that nobody can see from home, and campus Wi-Fi is unreliable.',
      'You will build an installable, offline-first Kanban board with drag-and-drop that stores data locally and works without a network.',
      CAREER_NOTE,
    ],
    outcomes: [
      'implement accessible drag-and-drop with a keyboard alternative;',
      'persist structured data in IndexedDB and design for offline use;',
      'turn a web app into an installable PWA with a service worker;',
      'implement undo/redo with a predictable state model.',
    ],
    requirements: [
      'Multiple boards; each board has columns and cards (title, description, labels, due date, checklist).',
      'Drag-and-drop to reorder cards and move them between columns (dnd-kit or similar), plus a keyboard alternative ("Move to…").',
      'Filter by label and due date; highlight overdue cards; search across boards.',
      'All data in IndexedDB (Dexie or idb); export/import a board as JSON.',
      'PWA: web manifest, service worker caching the app shell, works fully offline, installable on Android/desktop.',
      'Undo/redo for the last 20 actions.',
    ],
    prerequisites: [
      'You have built a React app with state management and are comfortable with TypeScript basics.',
    ],
    deliverables: [
      'Public repository and a deployed HTTPS preview (required for service workers).',
      'A README with an architecture section (state model, persistence, caching strategy).',
      'A short screen recording showing offline use and installation.',
    ],
    qualityFocus: 'reliable offline behaviour, correct ordering after drag-and-drop, and a keyboard-accessible alternative to dragging.',
    milestones: [
      m('Model and boards', 'Weeks 1–2.', [
        t('kb-model', 'State model, IndexedDB persistence and boards', 'Implement requirement 1 and persistence from requirement 4.', 'Boards, columns and cards survive reload; data model is documented; unit tests cover the reducer/store.', ['CODE', 'DOCUMENT'], 12),
      ]),
      m('Interaction', 'Weeks 3–4.', [
        t('kb-dnd', 'Drag-and-drop with keyboard alternative', 'Implement requirement 2.', 'Order persists correctly after moves; every move is possible with keyboard only; screen readers announce moves.', ['CODE'], 22, ['kb-model']),
        t('kb-filters', 'Filters, search and undo/redo', 'Implement requirements 3 and 6.', 'Filters combine; undo/redo restores exact previous states including order.', ['CODE'], 28, ['kb-dnd']),
      ]),
      m('Offline and delivery', 'Weeks 5–6.', [
        t('kb-pwa', 'PWA, offline support and JSON export', 'Implement requirement 5 and export/import from requirement 4.', 'App loads and works in airplane mode after first visit; Lighthouse PWA installability passes; exported JSON re-imports.', ['CODE', 'LIVE_DEMO'], 36, ['kb-filters']),
        t('kb-delivery', 'README, architecture and demo recording', 'Finalise documentation and record the demo.', 'README explains the architecture and caching strategy; recording shows offline use and install.', ['DOCUMENT'], 42, ['kb-pwa']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fe-portfolio-blog',
    domain: 'Frontend Development',
    level: 'BEGINNER',
    weeks: 4,
    hours: '6–8',
    programTitle: 'Frontend Internship: Developer Portfolio and Technical Blog',
    projectTitle: 'Developer Portfolio and MDX Technical Blog',
    skills: ['Next.js', 'React', 'HTML/CSS', 'Tailwind CSS'],
    scenario: [
      'Most students apply for jobs with a résumé and a list of links. A fast, accessible personal site with case studies and technical write-ups makes a much stronger impression.',
      'You will build your own portfolio and blog with Next.js and MDX, write two technical articles, and reach high Lighthouse scores. This project is about you — use your real projects, not fictional ones.',
      CAREER_NOTE,
    ],
    outcomes: [
      'build a statically generated site with Next.js and MDX content;',
      'write clear technical articles with code samples;',
      'apply SEO and accessibility basics and measure them with Lighthouse;',
      'present projects as case studies (problem, approach, result).',
    ],
    requirements: [
      'Pages: home, projects (case studies), blog index with tags, blog post, about/résumé, and a 404 page.',
      'Blog posts written in MDX with syntax-highlighted code, reading time, and table of contents.',
      'Dark/light theme that respects the operating-system preference.',
      'SEO: metadata and Open Graph images per page, sitemap and RSS feed.',
      'Lighthouse mobile scores of 95+ for Performance, Accessibility, Best Practices and SEO on home and a blog post.',
      'Two original technical articles (800+ words each) about something you built or learned.',
    ],
    prerequisites: [
      'Basic HTML, CSS and JavaScript; at least one project of your own to showcase.',
    ],
    deliverables: [
      'Public repository and the site deployed on a free host, ideally on your own domain.',
      'Two published articles and at least two project case studies.',
      'Lighthouse reports committed to the repository.',
    ],
    qualityFocus: 'clean semantic markup, strong Lighthouse scores, and well-written case studies and articles.',
    milestones: [
      m('Structure', 'Week 1.', [
        t('pb-setup', 'Site structure, theme and layout', 'Scaffold Next.js with MDX support and build the page layout, navigation and theme toggle (requirements 1 and 3).', 'All pages exist with real content placeholders; theme follows OS preference; keyboard navigation works.', ['CODE'], 7),
      ]),
      m('Content', 'Weeks 2–3.', [
        t('pb-blog', 'MDX blog engine', 'Implement requirement 2 including tags and table of contents.', 'Posts render code with highlighting; tags filter the index; reading time is shown.', ['CODE'], 14, ['pb-setup']),
        t('pb-writing', 'Two articles and two case studies', 'Write and publish requirement 6 and at least two case studies.', 'Articles are original, 800+ words, with code samples; case studies state problem, approach and result.', ['DOCUMENT'], 22, ['pb-blog']),
      ]),
      m('Polish and delivery', 'Week 4.', [
        t('pb-delivery', 'SEO, performance and deployment', 'Implement requirements 4 and 5 and deploy.', 'Sitemap and RSS validate; Open Graph previews render; Lighthouse targets met and reports committed.', ['CODE', 'LIVE_DEMO'], 28, ['pb-writing']),
      ]),
    ],
  }),
];

/* ================================================================== */
/* BACKEND DEVELOPMENT                                                 */
/* ================================================================== */

const BACKEND: OpportunityContent[] = [
  opportunity({
    key: 'pf-be-url-shortener',
    domain: 'Backend Development',
    level: 'BEGINNER',
    weeks: 4,
    hours: '8–10',
    programTitle: 'Backend Internship: URL Shortener with Analytics and Caching',
    projectTitle: 'URL Shortener Service with Click Analytics, Redis Cache and Rate Limiting',
    skills: ['Node.js', 'Express.js', 'PostgreSQL', 'Redis', 'Docker'],
    scenario: [
      'Scenario (fictional): a college fest team shares long registration links on posters and wants short, trackable links.',
      'You will build a URL-shortener API with click analytics, Redis caching of hot links and per-IP rate limiting, packaged with Docker Compose.',
      CAREER_NOTE,
    ],
    outcomes: [
      'design a small REST API and relational schema;',
      'use a cache correctly (cache-aside, invalidation, TTLs);',
      'protect an API with input validation and rate limiting;',
      'containerise a service and its dependencies with Docker Compose.',
    ],
    requirements: [
      'POST /links creates a short code (random base62, or a custom alias if free) for a valid http(s) URL, with optional expiry.',
      'GET /:code redirects (302) and records a click (timestamp, referrer, user-agent family, country if available); expired or unknown codes return 404/410.',
      'GET /links/:code/stats returns total clicks, clicks per day for the last 30 days, and top referrers.',
      'Cache code→URL lookups in Redis (cache-aside); invalidate on update/delete.',
      'Rate limit link creation per IP (e.g. 20/hour) using Redis; return 429 with Retry-After.',
      'Validation and a consistent JSON error format; OpenAPI documentation.',
    ],
    prerequisites: [
      'Basic JavaScript/TypeScript and SQL; you have built at least one small Express or similar server.',
    ],
    deliverables: [
      'Public repository with docker-compose.yml (API, PostgreSQL, Redis) and a README.',
      'OpenAPI specification and integration tests.',
      'A short benchmark note comparing redirect latency with and without the cache (e.g. using autocannon or k6).',
    ],
    qualityFocus: 'correct redirects and status codes, a properly invalidated cache, working rate limiting, and tests for each endpoint.',
    milestones: [
      m('Design and core', 'Weeks 1–2.', [
        t('us-design', 'Schema, API contract and Docker Compose', 'Write the OpenAPI contract and schema; set up the service with PostgreSQL and Redis in Docker Compose.', '`docker compose up` starts everything; migrations run; the contract covers every endpoint.', ['CODE', 'DOCUMENT'], 7),
        t('us-core', 'Create and redirect endpoints', 'Implement requirements 1 and 2 with validation.', 'Invalid URLs and taken aliases are rejected with clear errors; expired links return 410; clicks are recorded.', ['CODE'], 14, ['us-design']),
      ]),
      m('Performance and protection', 'Week 3.', [
        t('us-cache', 'Stats, Redis cache and rate limiting', 'Implement requirements 3, 4 and 5.', 'Stats match the raw click table; cache hits avoid the database; the 21st creation in an hour returns 429 with Retry-After.', ['CODE'], 21, ['us-core']),
      ]),
      m('Quality and delivery', 'Week 4.', [
        t('us-delivery', 'Integration tests, benchmark and README', 'Write integration tests for all endpoints, run the cache benchmark and finalise the docs.', 'Tests run in CI or with one command; the benchmark note reports numbers and method; README explains setup.', ['CODE', 'DOCUMENT'], 28, ['us-cache']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-be-order-inventory',
    domain: 'Backend Development',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Backend Internship: Order and Inventory Service with Transactions',
    projectTitle: 'E-commerce Order and Inventory Service (Transactions, Idempotency, Concurrency)',
    skills: ['Node.js', 'PostgreSQL', 'Docker', 'Express.js'],
    scenario: [
      'Scenario (fictional): an online stationery shop oversells popular items during sales because two customers can buy the last unit at the same time, and retried payments create duplicate orders.',
      'You will build the order and inventory backend that guarantees stock correctness under concurrency, handles retries safely with idempotency keys, and models the order lifecycle explicitly.',
      CAREER_NOTE,
    ],
    outcomes: [
      'model an order lifecycle as a state machine with enforced transitions;',
      'use database transactions and row locking (or optimistic concurrency) to prevent overselling;',
      'make write endpoints idempotent;',
      'prove correctness with concurrency tests.',
    ],
    requirements: [
      'Products with stock levels; carts; orders with line items and price snapshots.',
      'Order lifecycle: PENDING → PAID → SHIPPED → DELIVERED, plus CANCELLED and REFUNDED, with only valid transitions allowed.',
      'Placing an order reserves stock atomically; concurrent orders for the last unit result in exactly one success.',
      'Idempotency-Key header on POST /orders and POST /payments: retries return the original result, never a duplicate.',
      'A mock payment webhook (signed with HMAC) that marks orders PAID; reservations expire after 15 minutes if unpaid and stock is released.',
      'Admin endpoints for stock adjustments with an audit trail; pagination and filtering on order lists.',
    ],
    prerequisites: [
      'Comfortable building REST APIs with Node.js/TypeScript and writing SQL joins and transactions.',
    ],
    deliverables: [
      'Public repository with Docker Compose, migrations, seed data and README.',
      'A design document: ER diagram, state machine diagram and the concurrency strategy you chose and why.',
      'An automated concurrency test that fires 50 parallel orders at 10 units of stock and asserts exactly 10 succeed.',
    ],
    qualityFocus: 'no overselling under concurrency, correct idempotency, enforced state transitions and a clear design document.',
    milestones: [
      m('Design', 'Week 1.', [
        t('oi-design', 'Data model, state machine and concurrency plan', 'Produce the design document and scaffold the service with migrations.', 'Design covers ER model, transitions table and locking strategy; migrations and seed run with one command.', ['DOCUMENT', 'CODE'], 7),
      ]),
      m('Catalogue and orders', 'Weeks 2–4.', [
        t('oi-catalogue', 'Products, stock and carts', 'Implement products, stock and carts with validation.', 'CRUD endpoints validated; stock can never go negative at the database level (constraint).', ['CODE'], 14, ['oi-design']),
        t('oi-orders', 'Atomic order placement and lifecycle', 'Implement requirements 2 and 3.', 'Invalid transitions return 409; the concurrency test shows exactly N successes for N units.', ['CODE'], 28, ['oi-catalogue']),
      ]),
      m('Payments and reliability', 'Weeks 5–6.', [
        t('oi-idempotency', 'Idempotency keys and signed payment webhook', 'Implement requirements 4 and 5, including reservation expiry.', 'Repeated requests with the same key return identical responses; unsigned webhooks are rejected; expired reservations release stock.', ['CODE'], 42, ['oi-orders']),
      ]),
      m('Operations and delivery', 'Weeks 7–8.', [
        t('oi-admin', 'Admin stock adjustments and audit trail', 'Implement requirement 6.', 'Every adjustment records who, when, before/after and reason; lists paginate and filter.', ['CODE'], 49, ['oi-idempotency']),
        t('oi-delivery', 'Test suite, final design doc and README', 'Complete integration and concurrency tests and finalise documentation.', 'Tests pass with one command; design doc matches the implementation; README explains how to run everything.', ['CODE', 'DOCUMENT'], 56, ['oi-admin']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-be-auth-service',
    domain: 'Backend Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '10–12',
    programTitle: 'Backend Internship: Secure Authentication and Authorization Service',
    projectTitle: 'Authentication Service with Refresh-Token Rotation, RBAC and Password Reset',
    skills: ['Node.js', 'Express.js', 'PostgreSQL', 'Redis'],
    scenario: [
      'Every product needs sign-up, sign-in and permissions, and auth bugs are among the most damaging security issues. Interviewers frequently ask candidates to explain sessions, JWTs and password storage.',
      'You will build a standalone auth service following OWASP guidance: secure password hashing, short-lived access tokens with rotating refresh tokens, role-based access control, email verification and password reset (emails captured by a local tool such as Mailpit).',
      CAREER_NOTE,
    ],
    outcomes: [
      'store passwords safely (argon2 or bcrypt) and explain why;',
      'implement access/refresh tokens with rotation and reuse detection;',
      'design RBAC with roles and permissions enforced by middleware;',
      'apply OWASP controls: rate limiting, account lockout, generic error messages, secure cookies.',
    ],
    requirements: [
      'Register, verify email (one-time token, 24h expiry), login, logout, logout-all-devices.',
      'Access token (15 min) + refresh token (7 days) in an httpOnly, Secure, SameSite cookie; refresh rotates the token and detects reuse (revokes the whole family).',
      'Password reset by email with single-use, hashed, expiring tokens; reset invalidates all sessions.',
      'RBAC: roles (user, moderator, admin) mapped to permissions; middleware enforces them; admin can change roles (audited).',
      'Login rate limiting per IP and per account, temporary lockout after repeated failures, and no user enumeration in responses.',
      'A protected sample resource API that demonstrates each role.',
    ],
    prerequisites: [
      'Comfortable building REST APIs and using a relational database; basic understanding of HTTP cookies.',
    ],
    deliverables: [
      'Public repository with Docker Compose (API, PostgreSQL, Redis, Mailpit) and README.',
      'A threat model document: assets, threats (STRIDE-style), and the control for each.',
      'Integration tests covering token rotation, reuse detection, reset flow and role checks.',
    ],
    qualityFocus: 'correct and secure token handling, no user enumeration, enforced permissions and a credible threat model.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('au-design', 'Threat model and data model', 'Write the threat model and schema; scaffold the service with Docker Compose.', 'Threat model lists at least 8 threats with controls; services start with one command.', ['DOCUMENT', 'CODE'], 7),
      ]),
      m('Core auth', 'Weeks 2–3.', [
        t('au-core', 'Registration, verification and login', 'Implement requirement 1 with argon2/bcrypt hashing.', 'Unverified users cannot log in; verification tokens are single-use and expire; error messages do not reveal whether an email exists.', ['CODE'], 14, ['au-design']),
        t('au-tokens', 'Access/refresh tokens with rotation and reuse detection', 'Implement requirement 2.', 'Reusing an old refresh token revokes the family; logout-all invalidates every session; cookies have the correct flags.', ['CODE'], 21, ['au-core']),
      ]),
      m('Authorization and hardening', 'Weeks 4–5.', [
        t('au-rbac', 'Password reset and RBAC', 'Implement requirements 3, 4 and 6.', 'Reset invalidates all sessions; each role can access exactly its permitted endpoints; role changes are audited.', ['CODE'], 30, ['au-tokens']),
        t('au-hardening', 'Rate limiting and lockout', 'Implement requirement 5.', 'Brute-force attempts are throttled and locked out; lockout expires; tests demonstrate both.', ['CODE'], 35, ['au-rbac']),
      ]),
      m('Delivery', 'Week 6.', [
        t('au-delivery', 'Test suite and documentation', 'Complete integration tests and README (including how each OWASP control is implemented).', 'All listed flows are tested; README explains setup and security decisions.', ['CODE', 'DOCUMENT'], 42, ['au-hardening']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-be-job-queue',
    domain: 'Backend Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Backend Internship: Notification Service with Background Job Queues',
    projectTitle: 'Notification Service with Background Jobs, Retries and Dead-Letter Queue',
    skills: ['Node.js', 'Redis', 'Docker', 'PostgreSQL'],
    scenario: [
      'Scenario (fictional): a campus events app sends reminders by email and in-app notification. Sending them inside the web request makes the app slow, and failures are silently lost.',
      'You will build a notification service that accepts requests over an API, processes them asynchronously with a Redis-backed queue (BullMQ), retries with backoff, and moves permanently failing jobs to a dead-letter queue. Email goes to a local capture tool such as Mailpit.',
      CAREER_NOTE,
    ],
    outcomes: [
      'decouple slow work from requests with a job queue and workers;',
      'design retries with exponential backoff and idempotent handlers;',
      'schedule delayed and recurring jobs;',
      'observe a system with structured logs, metrics and a queue dashboard.',
    ],
    requirements: [
      'POST /notifications accepts { userId, channel: email | in_app, template, data, sendAt? } and returns 202 with a job id.',
      'Worker processes jobs: renders templates, sends email via SMTP (Mailpit) or stores in-app notifications in PostgreSQL.',
      'Retries with exponential backoff (max 5); permanently failed jobs go to a dead-letter queue that can be inspected and replayed via an admin endpoint.',
      'Delayed jobs (sendAt) and a recurring daily digest job.',
      'Idempotency: a notification with the same dedupe key is sent at most once.',
      'Observability: structured JSON logs with job id, a /metrics endpoint (jobs processed, failed, queue depth) and Bull Board or a similar dashboard.',
    ],
    prerequisites: [
      'Comfortable with Node.js/TypeScript and REST APIs; basic Docker usage.',
    ],
    deliverables: [
      'Public repository with Docker Compose (API, worker, Redis, PostgreSQL, Mailpit) and README.',
      'An architecture diagram and a failure-handling note (what happens when SMTP is down, a worker crashes, Redis restarts).',
      'Tests for handlers, retry behaviour and deduplication.',
    ],
    qualityFocus: 'reliable delivery semantics (retries, DLQ, dedupe), clear separation of API and workers, and useful observability.',
    milestones: [
      m('Setup', 'Week 1.', [
        t('jq-setup', 'Architecture and service skeleton', 'Draw the architecture and set up API, worker and dependencies in Docker Compose.', 'All containers start with one command; diagram shows request → queue → worker → channel flow.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Processing', 'Weeks 2–4.', [
        t('jq-core', 'Enqueue endpoint and channel workers', 'Implement requirements 1 and 2.', 'Requests return 202 immediately; emails appear in Mailpit; in-app notifications are stored and listable.', ['CODE'], 16, ['jq-setup']),
        t('jq-retries', 'Retries, dead-letter queue and replay', 'Implement requirement 3; simulate failures to prove it.', 'A forced failure retries with increasing delays then lands in the DLQ; replay re-processes it successfully.', ['CODE'], 26, ['jq-core']),
      ]),
      m('Scheduling and reliability', 'Week 5.', [
        t('jq-schedule', 'Delayed jobs, daily digest and deduplication', 'Implement requirements 4 and 5.', 'Delayed jobs run at the right time; digest runs daily; duplicates with the same key are sent once.', ['CODE'], 35, ['jq-retries']),
      ]),
      m('Observability and delivery', 'Week 6.', [
        t('jq-delivery', 'Metrics, dashboard, failure note and README', 'Implement requirement 6 and write the failure-handling note.', 'Metrics reflect real counts; dashboard shows queues; failure note covers the three scenarios with evidence.', ['CODE', 'DOCUMENT'], 42, ['jq-schedule']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-be-realtime-chat',
    domain: 'Backend Development',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Backend Internship: Real-Time Chat API with WebSockets',
    projectTitle: 'Real-Time Chat Backend with WebSockets and MongoDB',
    skills: ['Node.js', 'Express.js', 'MongoDB', 'Docker'],
    scenario: [
      'Scenario (fictional): a study-group platform wants group chat rooms so members stop switching to personal messaging apps.',
      'You will build a chat backend with REST endpoints for rooms and history and a WebSocket (Socket.IO) channel for real-time messages, typing indicators and presence. A minimal test client is enough for the frontend.',
      CAREER_NOTE,
    ],
    outcomes: [
      'combine REST and WebSocket APIs in one service;',
      'authenticate WebSocket connections and authorise room access;',
      'model and index documents in MongoDB for paginated history;',
      'reason about delivery, ordering and reconnection.',
    ],
    requirements: [
      'Users authenticate with a JWT (simple username/password registration is fine).',
      'REST: create/join/leave rooms, list my rooms, paginated message history (cursor-based).',
      'WebSocket: send/receive messages in real time, typing indicators, online presence per room; only members can join a room channel.',
      'Messages persisted in MongoDB with indexes supporting history queries; unread counts per room.',
      'Basic moderation: room owner can remove members and delete messages; per-user message rate limit.',
      'Reconnection: clients that reconnect receive messages they missed since their last seen message id.',
    ],
    prerequisites: [
      'Basic Node.js and REST API knowledge; no prior WebSocket experience required.',
    ],
    deliverables: [
      'Public repository with Docker Compose (API + MongoDB), a minimal HTML test client and README.',
      'An events document listing every WebSocket event, its payload and who receives it.',
      'Integration tests for REST endpoints and at least one WebSocket flow.',
    ],
    qualityFocus: 'correct authorisation on both REST and sockets, efficient paginated history, and graceful reconnection.',
    milestones: [
      m('Foundations', 'Weeks 1–2.', [
        t('ch-setup', 'Auth, data model and rooms API', 'Set up the service, JWT auth and the rooms endpoints with MongoDB models and indexes.', 'Users can register/login; rooms can be created, joined and left; non-members cannot read room data.', ['CODE'], 12),
      ]),
      m('Real time', 'Weeks 3–4.', [
        t('ch-socket', 'Real-time messaging, typing and presence', 'Implement requirement 3 and persistence from requirement 4.', 'Two test clients exchange messages instantly; unauthenticated sockets are rejected; non-members cannot join a room channel.', ['CODE', 'LIVE_DEMO'], 24, ['ch-setup']),
        t('ch-history', 'Paginated history and unread counts', 'Implement cursor-based history and unread counts.', 'History pages are stable while new messages arrive; unread counts reset when read.', ['CODE'], 28, ['ch-socket']),
      ]),
      m('Robustness and delivery', 'Weeks 5–6.', [
        t('ch-moderation', 'Moderation, rate limiting and reconnection', 'Implement requirements 5 and 6.', 'Removed members lose access immediately; spam is throttled; reconnecting clients receive missed messages exactly once.', ['CODE'], 36, ['ch-history']),
        t('ch-delivery', 'Events document, tests and README', 'Write the events document, tests and README.', 'Every event is documented; tests pass with one command; README explains setup and architecture.', ['CODE', 'DOCUMENT'], 42, ['ch-moderation']),
      ]),
    ],
  }),
];

/* ================================================================== */
/* FULL STACK DEVELOPMENT                                              */
/* ================================================================== */

const FULL_STACK: OpportunityContent[] = [
  opportunity({
    key: 'pf-fs-job-tracker',
    domain: 'Full Stack Development',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Full-Stack Internship: Job Application Tracker',
    projectTitle: 'Job Application Tracker with Pipeline Board and Reminders',
    skills: ['Next.js Full Stack', 'Authentication/Authorization', 'Testing (Jest, Vitest, Cypress)'],
    scenario: [
      'Students applying for internships and jobs lose track of where they applied, which round they are in and when to follow up — usually in a messy spreadsheet.',
      'You will build a full-stack tracker you can use for your own job search: applications on a pipeline board, interview notes, contacts, reminders and simple analytics.',
      CAREER_NOTE,
    ],
    outcomes: [
      'build a full-stack app with Next.js, a relational database and an ORM (Prisma or Drizzle);',
      'implement authentication and per-user data isolation;',
      'design forms, validation and server actions or API routes end to end;',
      'write unit and end-to-end tests for core journeys.',
    ],
    requirements: [
      'Sign up / sign in (Auth.js or similar); every record belongs to one user and is never visible to others.',
      'Applications: company, role, link, location, salary range (optional), source, status (Wishlist → Applied → OA → Interview → Offer / Rejected), dates.',
      'Pipeline board with drag-and-drop between statuses plus a table view with search and filters.',
      'Per-application timeline: interview rounds, notes, contacts, and attached job description text.',
      'Reminders: follow-up dates with an in-app "due today" list (email optional).',
      'Dashboard: applications per week, response rate and stage conversion.',
    ],
    prerequisites: [
      'You have built a small web app with a frontend framework and know basic SQL.',
    ],
    deliverables: [
      'Public repository and a deployed preview (Vercel + a free Postgres such as Neon or Supabase).',
      'README with setup, data model and screenshots.',
      'Unit tests for business logic and at least two Playwright/Cypress end-to-end journeys.',
    ],
    qualityFocus: 'strict per-user data isolation, solid validation, a smooth board/table experience and meaningful tests.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('jt-setup', 'Data model, auth and project setup', 'Set up Next.js, database, ORM migrations and authentication.', 'Users can sign up/in/out; schema and migrations committed; a second user cannot see the first user’s data.', ['CODE'], 7),
      ]),
      m('Core features', 'Weeks 2–4.', [
        t('jt-crud', 'Applications CRUD with validation', 'Implement requirement 2 with server-side validation.', 'Invalid input shows field errors; status changes are recorded with dates.', ['CODE'], 14, ['jt-setup']),
        t('jt-board', 'Pipeline board and table view', 'Implement requirement 3.', 'Drag-and-drop updates status persistently; filters and search combine; works on mobile.', ['CODE'], 22, ['jt-crud']),
        t('jt-timeline', 'Timeline, notes, contacts and reminders', 'Implement requirements 4 and 5.', 'Timeline shows events in order; due reminders appear on the dashboard on the right day.', ['CODE'], 28, ['jt-board']),
      ]),
      m('Insights and quality', 'Week 5.', [
        t('jt-analytics', 'Dashboard analytics and tests', 'Implement requirement 6 and write unit and end-to-end tests.', 'Metrics match the underlying data; e2e tests cover sign-up → add application → move to Interview.', ['CODE'], 35, ['jt-timeline']),
      ]),
      m('Delivery', 'Week 6.', [
        t('jt-delivery', 'Deployment and README', 'Deploy and document.', 'Preview works with a fresh account; README includes setup, data model and screenshots.', ['LIVE_DEMO', 'DOCUMENT'], 42, ['jt-analytics']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fs-clinic-booking',
    domain: 'Full Stack Development',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Full-Stack Internship: Clinic Appointment Booking System',
    projectTitle: 'Clinic Appointment Booking System with Role-Based Dashboards',
    skills: ['MERN Stack', 'Authentication/Authorization', 'Testing (Jest, Vitest, Cypress)'],
    scenario: [
      'Scenario (fictional): a neighbourhood clinic with four doctors takes bookings by phone, which leads to double bookings and long waits.',
      'You will build a booking system with three roles — patient, doctor, receptionist/admin — covering doctor schedules, slot booking without conflicts, rescheduling, cancellations and reminders. Use only fictional data; no real medical information.',
      CAREER_NOTE,
    ],
    outcomes: [
      'design role-based access across UI and API;',
      'model schedules, time slots and time zones correctly;',
      'prevent double booking under concurrent requests;',
      'test multi-role journeys end to end.',
    ],
    requirements: [
      'Roles: patient, doctor, admin. Admin manages doctors and clinic hours; doctors set weekly availability and leave days.',
      'Patients search doctors by specialisation, see free slots for the next 14 days, and book a slot with a reason for visit.',
      'No double booking: concurrent attempts for the same slot result in one booking (unique constraint or transaction).',
      'Reschedule and cancel with rules (e.g. not within 2 hours of the appointment); doctor can mark no-show or completed.',
      'Doctor dashboard (today’s queue) and admin dashboard (utilisation per doctor, cancellations).',
      'Email reminders 24 hours before the appointment (captured locally with Mailpit or a free email API sandbox).',
    ],
    prerequisites: [
      'You have built a full-stack app with authentication and a database.',
    ],
    deliverables: [
      'Public repository, deployed preview and README with demo accounts for each role.',
      'A permissions matrix (role × action) and slot/time-zone design note.',
      'End-to-end tests for a patient booking, a doctor completing it and a conflicting double booking.',
    ],
    qualityFocus: 'correct slot generation and conflict prevention, enforced role permissions on the server, and multi-role tests.',
    milestones: [
      m('Plan', 'Week 1.', [
        t('cb-plan', 'Data model, permissions matrix and setup', 'Design the schema and permission matrix; scaffold the app with auth and roles.', 'Matrix covers every action; users of each role can log in and see only their area.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Schedules and booking', 'Weeks 2–4.', [
        t('cb-schedule', 'Clinic hours, doctor availability and slot generation', 'Implement requirement 1 and slot generation.', 'Slots respect clinic hours, availability and leave; times display correctly in IST.', ['CODE'], 16, ['cb-plan']),
        t('cb-booking', 'Search and conflict-free booking', 'Implement requirements 2 and 3 with a concurrency test.', 'Booked slots disappear for others; a parallel double-booking test yields exactly one booking.', ['CODE'], 28, ['cb-schedule']),
      ]),
      m('Lifecycle and dashboards', 'Weeks 5–6.', [
        t('cb-lifecycle', 'Reschedule, cancel and visit outcomes', 'Implement requirement 4.', 'Rules are enforced on the server; status history is recorded.', ['CODE'], 36, ['cb-booking']),
        t('cb-dashboards', 'Doctor and admin dashboards, reminders', 'Implement requirements 5 and 6.', 'Dashboards show correct counts; reminders are sent once, 24 hours ahead.', ['CODE'], 44, ['cb-lifecycle']),
      ]),
      m('Quality and delivery', 'Weeks 7–8.', [
        t('cb-tests', 'End-to-end tests', 'Write the three required end-to-end journeys plus API tests for permissions.', 'Tests pass with one command; each role is denied at least one forbidden action in tests.', ['CODE'], 50, ['cb-dashboards']),
        t('cb-delivery', 'Deployment and documentation', 'Deploy with demo accounts and finalise documentation.', 'Preview works for all three roles; README and design notes are complete.', ['LIVE_DEMO', 'DOCUMENT'], 56, ['cb-tests']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fs-quiz-platform',
    domain: 'Full Stack Development',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Full-Stack Internship: Online Quiz and Assessment Platform',
    projectTitle: 'Online Quiz and Assessment Platform with Timed Attempts and Auto-Grading',
    skills: ['Next.js Full Stack', 'Authentication/Authorization', 'Testing (Jest, Vitest, Cypress)'],
    scenario: [
      'Scenario (fictional): a coaching centre runs weekly practice tests on paper; grading takes days and students never see which topics they are weak in.',
      'You will build a quiz platform where teachers create question banks and timed quizzes and students take them online with automatic grading and topic-wise feedback.',
      CAREER_NOTE,
    ],
    outcomes: [
      'model question banks, quizzes, attempts and answers;',
      'enforce server-side timing and prevent answer leakage;',
      'implement auto-grading and analytics;',
      'build role-based dashboards for teachers and students.',
    ],
    requirements: [
      'Roles: teacher and student. Teachers create questions (single choice, multiple choice, numeric) tagged by topic and difficulty, and import questions from CSV.',
      'Quizzes: pick questions manually or randomly by topic/difficulty, set duration, start/end window and attempt limit; shuffle questions and options per attempt.',
      'Timed attempts enforced on the server (the deadline is stored server-side; late answers are rejected); autosave answers; resume after refresh.',
      'Correct answers are never sent to the browser before submission; auto-grading on submit or timeout.',
      'Student results: score, topic-wise breakdown and review of correct answers (if the teacher allows).',
      'Teacher analytics: score distribution, per-question difficulty (percentage correct) and CSV export of results.',
    ],
    prerequisites: [
      'You have built a full-stack app with authentication and a database.',
    ],
    deliverables: [
      'Public repository, deployed preview with demo accounts, and README.',
      'A security note explaining how timing and answer secrecy are enforced.',
      'Unit tests for grading and timing; end-to-end test of a full attempt.',
    ],
    qualityFocus: 'server-enforced timing and answer secrecy, correct grading for every question type, and useful analytics.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('qz-setup', 'Data model, roles and setup', 'Design the schema and scaffold the app with teacher/student roles.', 'Schema covers questions, quizzes, attempts and answers; role areas are protected.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Authoring', 'Weeks 2–3.', [
        t('qz-bank', 'Question bank with CSV import', 'Implement requirement 1.', 'All three question types can be created and edited; CSV import validates rows and reports errors.', ['CODE'], 18, ['qz-setup']),
        t('qz-quiz', 'Quiz builder and scheduling', 'Implement requirement 2.', 'Random selection respects topic/difficulty counts; windows and attempt limits are enforced.', ['CODE'], 24, ['qz-bank']),
      ]),
      m('Taking quizzes', 'Weeks 4–5.', [
        t('qz-attempt', 'Timed attempts with autosave and secure grading', 'Implement requirements 3 and 4.', 'Answers after the deadline are rejected server-side; refresh resumes the attempt; inspecting network responses never reveals correct answers before submission.', ['CODE'], 36, ['qz-quiz']),
      ]),
      m('Results and analytics', 'Weeks 6–7.', [
        t('qz-results', 'Student results and teacher analytics', 'Implement requirements 5 and 6.', 'Topic breakdown sums to the total score; per-question statistics are correct; CSV export opens in a spreadsheet.', ['CODE'], 48, ['qz-attempt']),
      ]),
      m('Delivery', 'Week 8.', [
        t('qz-delivery', 'Tests, security note and deployment', 'Complete the tests and the security note; deploy.', 'Grading and timing tests pass; e2e attempt passes; preview works with demo accounts.', ['CODE', 'LIVE_DEMO', 'DOCUMENT'], 56, ['qz-results']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fs-complaint-tracker',
    domain: 'Full Stack Development',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Full-Stack Internship: Hostel Complaint and Maintenance Tracker',
    projectTitle: 'Hostel Complaint and Maintenance Tracker (MERN)',
    skills: ['MERN Stack', 'Authentication/Authorization'],
    scenario: [
      'Scenario (fictional): hostel residents report broken fans, leaking taps and Wi-Fi issues in a register at the warden’s desk; complaints are forgotten and nobody knows their status.',
      'You will build a MERN application where residents raise complaints with photos, wardens assign them to maintenance staff, and everyone tracks status until resolution.',
      CAREER_NOTE,
    ],
    outcomes: [
      'build a complete MERN application with authentication and roles;',
      'implement a status workflow with history;',
      'handle file uploads safely;',
      'present operational data in a simple dashboard.',
    ],
    requirements: [
      'Roles: resident, staff, warden. Residents register with their room number; the warden approves accounts.',
      'Residents raise complaints (category, description, room, up to 3 photos) and see the status of their own complaints.',
      'Workflow: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (resident confirms) or REOPENED; every change is recorded with who and when.',
      'Warden assigns complaints to staff by category; staff see their queue and update status with a comment.',
      'Image upload with type/size validation (local storage or a free Cloudinary tier); no executable files accepted.',
      'Warden dashboard: open complaints by category, average resolution time, and complaints older than 3 days highlighted.',
    ],
    prerequisites: [
      'Basic React and Node.js/Express knowledge; you have used MongoDB or another database before.',
    ],
    deliverables: [
      'Public repository, deployed preview with demo accounts for each role, and README.',
      'A workflow diagram of complaint statuses and allowed transitions per role.',
      'API tests for the workflow transitions and permissions.',
    ],
    qualityFocus: 'correct workflow transitions per role, safe uploads, and an accurate dashboard.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('ct-setup', 'Auth, roles and data model', 'Set up the MERN project, authentication, roles and models.', 'Each role logs in to its own area; unapproved residents cannot raise complaints.', ['CODE'], 7),
      ]),
      m('Complaints', 'Weeks 2–4.', [
        t('ct-raise', 'Raising complaints with photo upload', 'Implement requirements 2 and 5.', 'Invalid file types and oversized files are rejected; residents only see their own complaints.', ['CODE'], 16, ['ct-setup']),
        t('ct-workflow', 'Status workflow, assignment and history', 'Implement requirements 3 and 4.', 'Invalid transitions are rejected by the API; history shows every change; staff see only assigned complaints.', ['CODE'], 28, ['ct-raise']),
      ]),
      m('Dashboard and quality', 'Week 5.', [
        t('ct-dashboard', 'Warden dashboard and API tests', 'Implement requirement 6 and write API tests.', 'Dashboard numbers match the data; tests cover each transition and role restriction.', ['CODE'], 35, ['ct-workflow']),
      ]),
      m('Delivery', 'Week 6.', [
        t('ct-delivery', 'Deployment and documentation', 'Deploy with demo accounts; write README and workflow diagram.', 'Preview works for all roles; README explains setup and roles.', ['LIVE_DEMO', 'DOCUMENT'], 42, ['ct-dashboard']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-fs-expense-splitter',
    domain: 'Full Stack Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Full-Stack Internship: Group Expense Splitter',
    projectTitle: 'Group Expense Splitter with Debt Simplification (T3 Stack)',
    skills: ['T3 Stack', 'Authentication/Authorization', 'Testing (Jest, Vitest, Cypress)'],
    scenario: [
      'Friends on trips and flatmates sharing rent constantly ask "who owes whom?". Getting the maths right with uneven splits and many payments is harder than it looks.',
      'You will build an expense-splitting app with groups, flexible splits, settlements and an algorithm that minimises the number of payments needed to settle up.',
      CAREER_NOTE,
    ],
    outcomes: [
      'build a type-safe full-stack app with the T3 stack (Next.js, tRPC, Prisma, Auth.js);',
      'handle money correctly (integer paise, rounding rules);',
      'implement and test a debt-simplification algorithm;',
      'design group membership and invitations securely.',
    ],
    requirements: [
      'Groups with members; invite by link that expires; only members see group data.',
      'Expenses with payer, amount, date, category and split type: equal, exact amounts, percentages or shares; validation that splits add up.',
      'Money stored as integer paise; rounding remainders assigned deterministically and documented.',
      'Balances per member and a "settle up" plan that minimises the number of transactions; record settlements.',
      'Activity feed and the ability to edit/delete expenses with history.',
      'Export a group’s ledger to CSV.',
    ],
    prerequisites: [
      'You have built a full-stack TypeScript app; tRPC experience not required.',
    ],
    deliverables: [
      'Public repository, deployed preview and README.',
      'An algorithm note explaining the debt-simplification approach with a worked example.',
      'Property-based or table-driven tests proving balances always sum to zero.',
    ],
    qualityFocus: 'exact money arithmetic, a correct and well-tested settle-up algorithm, and secure group membership.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('es-setup', 'T3 setup, schema and auth', 'Scaffold with create-t3-app, define the schema and authentication.', 'Users can sign in; schema stores money as integers; migrations committed.', ['CODE'], 7),
      ]),
      m('Groups and expenses', 'Weeks 2–3.', [
        t('es-groups', 'Groups and expiring invitations', 'Implement requirement 1.', 'Expired or reused-after-limit links are rejected; non-members get 403/404 from every procedure.', ['CODE'], 12, ['es-setup']),
        t('es-expenses', 'Expenses with flexible splits', 'Implement requirements 2 and 3.', 'Each split type validates; rounding remainders follow the documented rule; unit tests cover each type.', ['CODE'], 21, ['es-groups']),
      ]),
      m('Settling up', 'Weeks 4–5.', [
        t('es-settle', 'Balances and settle-up algorithm', 'Implement requirement 4 with tests and the algorithm note.', 'Balances always sum to zero in tests; the plan never needs more than (members − 1) payments.', ['CODE', 'DOCUMENT'], 30, ['es-expenses']),
        t('es-activity', 'Activity feed, edit history and CSV export', 'Implement requirements 5 and 6.', 'Edits are reflected in balances and history; CSV export matches the ledger.', ['CODE'], 36, ['es-settle']),
      ]),
      m('Delivery', 'Week 6.', [
        t('es-delivery', 'Deployment and documentation', 'Deploy and finalise README.', 'Preview works end to end; README explains setup and money handling.', ['LIVE_DEMO', 'DOCUMENT'], 42, ['es-activity']),
      ]),
    ],
  }),
];

/* ================================================================== */
/* PYTHON DEVELOPMENT                                                  */
/* ================================================================== */

const PYTHON: OpportunityContent[] = [
  opportunity({
    key: 'pf-py-recipe-django',
    domain: 'Python Development',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Python Internship: Recipe Sharing Web App with Django',
    projectTitle: 'Recipe Sharing Web Application with Django',
    skills: ['Django', 'Testing (pytest)'],
    scenario: [
      'Scenario (fictional): a college cooking club shares recipes in a chat group, where they get lost and cannot be searched or rated.',
      'You will build a Django web application where members publish recipes with ingredients and steps, search and filter them, save favourites and leave ratings and comments.',
      CAREER_NOTE,
    ],
    outcomes: [
      'model relational data with the Django ORM and migrations;',
      'use Django auth, forms, class-based views and the admin;',
      'implement search, filtering and pagination efficiently;',
      'test a Django app with pytest-django.',
    ],
    requirements: [
      'User registration, login and profile; only authors can edit or delete their recipes.',
      'Recipes: title, photo, prep/cook time, servings, cuisine, diet tags (veg, vegan, Jain, gluten-free), ingredients with quantities, and ordered steps.',
      'Search by title or ingredient; filter by cuisine, diet tag and max total time; paginated results.',
      'Favourites, 1–5 star ratings (one per user) and comments with moderation by the author.',
      'Servings scaler that recalculates ingredient quantities.',
      'Django admin configured for moderators; a small JSON API (Django REST Framework) listing recipes.',
    ],
    prerequisites: [
      'Basic Python and HTML; you have written a small Python program or script before.',
    ],
    deliverables: [
      'Public repository with requirements, migrations, seed fixtures (20+ fictional recipes) and README.',
      'Deployed preview (free tier such as PythonAnywhere or Render).',
      'pytest suite covering models, permissions and views.',
    ],
    qualityFocus: 'clean models and migrations, correct permissions, efficient queries (no N+1 on list pages) and tests.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('rd-setup', 'Project setup, models and admin', 'Create the Django project, recipe models, migrations, admin and seed fixtures.', 'Migrations run cleanly; admin manages all models; 20+ seed recipes load with one command.', ['CODE'], 7),
      ]),
      m('Core features', 'Weeks 2–4.', [
        t('rd-crud', 'Auth and recipe create/edit with permissions', 'Implement requirements 1 and 2 with forms and validation.', 'Only authors can edit/delete; ingredient and step forms validate; photos display.', ['CODE'], 16, ['rd-setup']),
        t('rd-search', 'Search, filters and pagination', 'Implement requirement 3.', 'Filters combine; list pages use select_related/prefetch_related (no N+1, shown with django-debug-toolbar or query counts in tests).', ['CODE'], 24, ['rd-crud']),
        t('rd-social', 'Favourites, ratings, comments and scaler', 'Implement requirements 4 and 5.', 'One rating per user is enforced; average rating is correct; scaler handles fractions sensibly.', ['CODE'], 30, ['rd-search']),
      ]),
      m('API and quality', 'Week 5.', [
        t('rd-api', 'REST endpoint and test suite', 'Implement requirement 6 and the pytest suite.', 'API lists recipes with pagination; tests cover models, permissions and key views.', ['CODE'], 36, ['rd-social']),
      ]),
      m('Delivery', 'Week 6.', [
        t('rd-delivery', 'Deployment and README', 'Deploy and document.', 'Preview works; README covers setup, models and screenshots.', ['LIVE_DEMO', 'DOCUMENT'], 42, ['rd-api']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-py-price-tracker',
    domain: 'Python Development',
    level: 'BEGINNER',
    weeks: 4,
    hours: '6–8',
    programTitle: 'Python Internship: Ethical Web Scraper and Price Tracker',
    projectTitle: 'Ethical Web Scraper and Price-Drop Alert Tool',
    skills: ['Pandas', 'Testing (pytest)'],
    scenario: [
      'Students often wait for a laptop or book to go on sale. Automating that check is a classic, practical Python project that teaches HTTP, parsing, scheduling and data handling.',
      'You will build a command-line tool that tracks product prices on sites designed for scraping practice (for example books.toscrape.com) or via public APIs, stores the history, charts it and alerts on price drops. You must respect robots.txt and terms of use; do not scrape sites that forbid it.',
      CAREER_NOTE,
    ],
    outcomes: [
      'make HTTP requests responsibly (robots.txt, rate limiting, user agent, retries);',
      'parse HTML with BeautifulSoup and handle missing data;',
      'store and analyse time series with SQLite and pandas;',
      'build and test a CLI application.',
    ],
    requirements: [
      'CLI (Typer or argparse): add/remove/list tracked items by URL with a target price.',
      'Scraper checks robots.txt, waits between requests, retries with backoff and logs failures without crashing.',
      'Store price history in SQLite; skip unchanged prices sensibly.',
      'Scheduled runs (cron/Task Scheduler instructions, or an in-process scheduler).',
      'Alerts when the price falls below target or drops by more than X% (console + email via a test SMTP server, or a desktop notification).',
      'Report command: price history chart (matplotlib) and summary statistics with pandas.',
    ],
    prerequisites: [
      'Basic Python (functions, lists, dictionaries) and comfort using a terminal.',
    ],
    deliverables: [
      'Public repository with pyproject.toml, README and usage examples.',
      'pytest tests using saved HTML fixtures (no live network calls in tests).',
      'An ethics note: what you scraped, how you respected robots.txt and rate limits.',
    ],
    qualityFocus: 'responsible scraping, robust parsing with tests on fixtures, and a usable CLI.',
    milestones: [
      m('Scraper', 'Weeks 1–2.', [
        t('pt-scraper', 'Responsible scraper with parsing tests', 'Implement requirement 2 and HTML parsing with saved fixtures.', 'robots.txt is honoured; parser tests pass offline; network errors are logged and retried.', ['CODE'], 10),
        t('pt-cli', 'CLI and SQLite storage', 'Implement requirements 1 and 3.', 'Items can be added/listed/removed; history is stored without duplicates.', ['CODE'], 14, ['pt-scraper']),
      ]),
      m('Automation', 'Week 3.', [
        t('pt-alerts', 'Scheduling and alerts', 'Implement requirements 4 and 5.', 'A scheduled run detects a simulated price drop and sends an alert once.', ['CODE'], 21, ['pt-cli']),
      ]),
      m('Reporting and delivery', 'Week 4.', [
        t('pt-delivery', 'Reports, ethics note and README', 'Implement requirement 6 and write the documentation.', 'Chart and summary are generated from stored data; README and ethics note complete.', ['CODE', 'DOCUMENT'], 28, ['pt-alerts']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-py-spam-classifier',
    domain: 'Python Development',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Python Internship: SMS Spam Classifier Served as an API',
    projectTitle: 'SMS Spam Classifier with scikit-learn and a FastAPI Inference Service',
    skills: ['Machine Learning (scikit-learn)', 'FastAPI', 'Pandas', 'Testing (pytest)'],
    scenario: [
      'Many ML projects stop at a notebook. Employers want to see that you can take a model from data to a tested, documented service.',
      'Using the public UCI "SMS Spam Collection" dataset (check and cite its licence on the dataset page), you will build, evaluate and compare text classifiers, then serve the best one through a FastAPI service with tests and Docker.',
      CAREER_NOTE,
    ],
    outcomes: [
      'clean and explore a text dataset and build reproducible scikit-learn pipelines;',
      'evaluate classifiers with appropriate metrics for imbalanced data;',
      'serve a model with FastAPI, input validation and versioning;',
      'test and containerise an ML service.',
    ],
    requirements: [
      'Exploratory analysis: class balance, message lengths, common tokens; documented in a notebook.',
      'At least three models (e.g. Multinomial Naive Bayes, Logistic Regression, Linear SVM) in scikit-learn Pipelines with TF-IDF; cross-validated hyper-parameter search.',
      'Evaluation: precision, recall, F1, PR curve and confusion matrix on a held-out test set; choose a decision threshold and justify it.',
      'Error analysis: inspect false positives/negatives and document patterns.',
      'FastAPI service: POST /predict (single and batch) returning label and probability, GET /health and model version; Pydantic validation.',
      'Training script that saves a versioned model artefact; Dockerfile for the service; pytest tests for preprocessing and the API.',
    ],
    prerequisites: [
      'Comfortable with Python and pandas; you have trained at least one scikit-learn model before.',
    ],
    deliverables: [
      'Public repository with notebook, training script, service, Dockerfile and README.',
      'A model card: data, intended use, metrics, limitations and ethical considerations.',
      'Tests that run in CI or with one command.',
    ],
    qualityFocus: 'sound evaluation for imbalanced data, a reproducible pipeline, and a clean, tested inference API.',
    milestones: [
      m('Data', 'Week 1.', [
        t('sc-eda', 'Dataset, licence check and EDA', 'Download the dataset, record its licence and citation, and complete requirement 1.', 'Notebook runs top to bottom; licence and citation documented; findings summarised.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Modelling', 'Weeks 2–3.', [
        t('sc-models', 'Pipelines, model comparison and tuning', 'Implement requirements 2 and 3.', 'Results table compares models with CV scores; test-set metrics reported once; threshold justified.', ['CODE', 'DOCUMENT'], 21, ['sc-eda']),
        t('sc-errors', 'Error analysis', 'Complete requirement 4.', 'At least 20 misclassified messages analysed with identified patterns and proposed fixes.', ['DOCUMENT'], 24, ['sc-models']),
      ]),
      m('Serving', 'Weeks 4–5.', [
        t('sc-api', 'FastAPI inference service with tests', 'Implement requirements 5 and 6.', 'API validates input and returns probabilities; model version is exposed; tests cover preprocessing and endpoints; Docker image runs.', ['CODE'], 35, ['sc-errors']),
      ]),
      m('Delivery', 'Week 6.', [
        t('sc-delivery', 'Model card and README', 'Write the model card and README.', 'Model card covers data, metrics, limitations and ethics; README explains training and serving.', ['DOCUMENT'], 42, ['sc-api']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-py-cli-package',
    domain: 'Python Development',
    level: 'BEGINNER',
    weeks: 4,
    hours: '6–8',
    programTitle: 'Python Internship: Publishable Command-Line Tool and Package',
    projectTitle: 'Command-Line Study Planner Packaged and Tested like Production Software',
    skills: ['Testing (pytest)'],
    scenario: [
      'Writing a script is easy; shipping a tool other people can install, use and trust is a professional skill — packaging, tests, linting, CI and documentation.',
      'You will build a command-line study planner (subjects, topics, study sessions, spaced-repetition review reminders and progress stats) and package it properly so anyone can install it with pip.',
      CAREER_NOTE,
    ],
    outcomes: [
      'structure a Python project with pyproject.toml and a src layout;',
      'build a friendly CLI with Typer and Rich;',
      'write unit tests with pytest, including fixtures and parametrisation;',
      'set up linting, type checking and continuous integration.',
    ],
    requirements: [
      'Commands: add subject/topic, log a study session (duration, notes), list what is due today, mark a review done, and show stats.',
      'Spaced-repetition scheduling for topics (e.g. intervals 1, 3, 7, 14, 30 days) with the logic in a pure, tested module.',
      'Data stored in a local SQLite file in the user’s data directory (platformdirs); export/import as JSON.',
      'Rich terminal output (tables, colours) and helpful --help text for every command.',
      'Quality tooling: ruff, mypy (or pyright) and pytest with coverage ≥ 80% for the core module.',
      'GitHub Actions CI running lint, type check and tests on Python 3.10–3.12; build a wheel and install it in CI.',
    ],
    prerequisites: [
      'Basic Python (functions, classes, files) and Git.',
    ],
    deliverables: [
      'Public repository with pyproject.toml, src layout, tests, CI workflow and README with a demo GIF or asciinema recording.',
      'A built wheel attached to a GitHub release (publishing to TestPyPI is a welcome stretch goal).',
      'CHANGELOG.md with semantic versions.',
    ],
    qualityFocus: 'clean package structure, well-tested scheduling logic, passing CI and a helpful CLI experience.',
    milestones: [
      m('Foundations', 'Week 1.', [
        t('cp-setup', 'Project layout, tooling and CI', 'Set up pyproject.toml, src layout, ruff, mypy, pytest and the CI workflow.', 'CI runs on every push across three Python versions and passes on an initial test.', ['CODE'], 7),
      ]),
      m('Core logic', 'Week 2.', [
        t('cp-core', 'Data storage and spaced-repetition engine', 'Implement requirements 2 and 3 with tests.', 'Scheduling logic is pure and parametrised-tested; coverage ≥ 80% for the core module.', ['CODE'], 14, ['cp-setup']),
      ]),
      m('CLI', 'Week 3.', [
        t('cp-cli', 'CLI commands and Rich output', 'Implement requirements 1 and 4 with CLI tests (Typer’s CliRunner).', 'Every command has help text and a test; errors are friendly, not tracebacks.', ['CODE'], 21, ['cp-core']),
      ]),
      m('Release', 'Week 4.', [
        t('cp-release', 'Wheel, release and documentation', 'Build the wheel in CI, cut a GitHub release, and complete README and CHANGELOG.', 'Wheel installs in a clean virtual environment and the CLI runs; README has install and usage sections with a demo recording.', ['CODE', 'DOCUMENT'], 28, ['cp-cli']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-py-movie-recommender',
    domain: 'Python Development',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Python Internship: Movie Recommendation Engine',
    projectTitle: 'Movie Recommendation Engine with Collaborative Filtering and Offline Evaluation',
    skills: ['Pandas', 'NumPy', 'Machine Learning (scikit-learn)', 'FastAPI'],
    scenario: [
      'Recommendation systems power most consumer apps and are a common interview topic for data and ML roles.',
      'Using the MovieLens "latest-small" dataset from GroupLens (read and follow its usage licence, which permits research/education use with citation), you will build popularity, content-based and collaborative-filtering recommenders, evaluate them offline, and serve recommendations through a small API.',
      CAREER_NOTE,
    ],
    outcomes: [
      'prepare user–item interaction data and split it without leakage;',
      'implement baseline, content-based and matrix-factorisation recommenders;',
      'evaluate with ranking metrics (precision@k, recall@k, NDCG@k) and coverage;',
      'serve recommendations and handle cold-start users.',
    ],
    requirements: [
      'EDA of ratings: distribution, sparsity, long tail; time-based train/test split per user.',
      'Baselines: most popular and highest-rated (with a minimum-ratings threshold).',
      'Content-based recommender using genres and tags (TF-IDF + cosine similarity).',
      'Collaborative filtering: item–item kNN and matrix factorisation (truncated SVD or ALS via the implicit/surprise library).',
      'Offline evaluation comparing all models on precision@10, recall@10, NDCG@10, catalogue coverage and novelty; discuss trade-offs.',
      'FastAPI service: recommendations for a user id, "similar movies" for a movie id, and an onboarding flow for new users who rate 5 movies (cold start).',
    ],
    prerequisites: [
      'Comfortable with Python, pandas and NumPy; basic linear algebra helps.',
    ],
    deliverables: [
      'Public repository with notebooks, a reusable Python package for the models, the API and README (including the MovieLens citation).',
      'An evaluation report with a results table, charts and recommendations for which model to ship and why.',
      'pytest tests for data splitting and metrics.',
    ],
    qualityFocus: 'leakage-free evaluation, correct ranking metrics, clear model comparison and a working cold-start path.',
    milestones: [
      m('Data', 'Week 1.', [
        t('mr-eda', 'EDA and leakage-free split', 'Complete requirement 1 and document the licence and citation.', 'Split is per user and time-based; tests prove no test interactions appear in training.', ['CODE', 'DOCUMENT'], 7),
      ]),
      m('Models', 'Weeks 2–5.', [
        t('mr-baselines', 'Baselines and metrics module', 'Implement requirement 2 and a tested metrics module.', 'Metric functions are unit-tested against hand-computed examples.', ['CODE'], 14, ['mr-eda']),
        t('mr-content', 'Content-based recommender', 'Implement requirement 3.', 'Similar-movie results are sensible for 5 hand-checked examples documented in the notebook.', ['CODE'], 24, ['mr-baselines']),
        t('mr-cf', 'Collaborative filtering models', 'Implement requirement 4 with hyper-parameter tuning on a validation split.', 'Both CF models train reproducibly (fixed seeds) and produce top-k lists for every test user.', ['CODE'], 35, ['mr-content']),
      ]),
      m('Evaluation', 'Week 6.', [
        t('mr-eval', 'Offline evaluation report', 'Complete requirement 5.', 'Report compares all models on all metrics with a reasoned recommendation.', ['DOCUMENT', 'CODE'], 42, ['mr-cf']),
      ]),
      m('Serving and delivery', 'Weeks 7–8.', [
        t('mr-api', 'Recommendation API with cold start', 'Implement requirement 6 with tests.', 'Unknown users get the onboarding path; responses return within 200 ms locally for top-10.', ['CODE'], 50, ['mr-eval']),
        t('mr-delivery', 'Documentation and final review', 'Finalise README, package structure and the evaluation report.', 'A new user can reproduce the results from the README.', ['DOCUMENT'], 56, ['mr-api']),
      ]),
    ],
  }),
];

/* ================================================================== */
/* DATA & ANALYTICS                                                    */
/* ================================================================== */

const DATA: OpportunityContent[] = [
  opportunity({
    key: 'pf-da-retail-sql',
    domain: 'Data & Analytics',
    level: 'BEGINNER',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Data Analytics Internship: Retail Sales Analysis with SQL and Power BI',
    projectTitle: 'Retail Sales Analysis with SQL and an Interactive Power BI Dashboard',
    skills: ['SQL', 'Power BI', 'Statistics'],
    scenario: [
      'Scenario (fictional brief, real data): a gift retailer wants to know which products, customers and countries drive revenue, and how sales change over the year.',
      'Using the UCI "Online Retail II" dataset (CC BY 4.0 — confirm on the dataset page and cite it), you will load the data into PostgreSQL or SQLite, clean it with SQL, answer business questions, and build an interactive Power BI dashboard (Tableau Public is an acceptable alternative).',
      CAREER_NOTE,
    ],
    outcomes: [
      'load, clean and model raw transactional data in SQL;',
      'write analytical SQL with joins, CTEs and window functions;',
      'perform an RFM customer segmentation;',
      'build a dashboard and communicate findings to non-technical readers.',
    ],
    requirements: [
      'Load the raw data; document data-quality issues (cancellations, negative quantities, missing customer ids, duplicates) and how you handle each.',
      'Build a clean star schema: fact_sales with dim_product, dim_customer, dim_date and dim_country.',
      'Answer at least 10 business questions in SQL (e.g. monthly revenue and growth, top products, repeat-purchase rate, average order value by country), using CTEs and window functions.',
      'RFM segmentation of customers with SQL and a short interpretation of each segment.',
      'Interactive dashboard: KPI cards, revenue trend, top products, country map/table, customer segments, with slicers for date and country.',
      'A 2-page executive summary with three evidence-backed recommendations and stated limitations.',
    ],
    prerequisites: [
      'Basic SQL (SELECT, WHERE, GROUP BY) and spreadsheet skills.',
    ],
    deliverables: [
      'Public repository with SQL scripts (load, clean, model, analysis), the .pbix file or a published dashboard link, and README.',
      'Data-quality log and executive summary (PDF or Markdown).',
      'Screenshots of every dashboard page in the repository.',
    ],
    qualityFocus: 'correct cleaning decisions, accurate SQL results that reconcile with the dashboard, and clear business communication.',
    milestones: [
      m('Data preparation', 'Weeks 1–2.', [
        t('rs-load', 'Load data and data-quality log', 'Complete requirement 1 and cite the dataset licence.', 'Row counts before/after each cleaning step recorded; every issue has a documented decision.', ['CODE', 'DOCUMENT'], 10),
        t('rs-model', 'Star schema', 'Complete requirement 2.', 'Schema scripts run from scratch; fact totals reconcile with the cleaned source.', ['CODE'], 14, ['rs-load']),
      ]),
      m('Analysis', 'Weeks 3–4.', [
        t('rs-sql', 'Business questions in SQL', 'Complete requirement 3.', 'Each question has its query, result and one-line interpretation; at least 3 queries use window functions.', ['CODE', 'DOCUMENT'], 24, ['rs-model']),
        t('rs-rfm', 'RFM segmentation', 'Complete requirement 4.', 'Segments are defined with clear rules; segment sizes and revenue shares are reported and interpreted.', ['CODE', 'DOCUMENT'], 28, ['rs-sql']),
      ]),
      m('Dashboard and story', 'Weeks 5–6.', [
        t('rs-dashboard', 'Interactive dashboard', 'Complete requirement 5.', 'Dashboard numbers match SQL results; slicers work across pages; layout is readable.', ['LIVE_DEMO', 'DOCUMENT'], 36, ['rs-rfm']),
        t('rs-summary', 'Executive summary', 'Complete requirement 6 and the README.', 'Recommendations cite specific figures; limitations are honest; README explains how to reproduce.', ['DOCUMENT'], 42, ['rs-dashboard']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-da-bank-marketing',
    domain: 'Data & Analytics',
    level: 'INTERMEDIATE',
    weeks: 6,
    hours: '8–10',
    programTitle: 'Data Analytics Internship: Bank Marketing Campaign Analysis and Prediction',
    projectTitle: 'Bank Marketing Campaign Analysis and Subscription Prediction',
    skills: ['Python for Data Analysis', 'Basic Machine Learning', 'Statistics'],
    scenario: [
      'Scenario (fictional brief, real data): a bank’s phone-marketing team wants to call fewer customers while still reaching those most likely to open a term deposit.',
      'Using the UCI "Bank Marketing" dataset (CC BY 4.0 — confirm and cite), you will analyse what drives subscription, build an interpretable predictive model, and translate it into a calling strategy with an estimated business impact.',
      CAREER_NOTE,
    ],
    outcomes: [
      'perform hypothesis-driven exploratory analysis with appropriate statistical tests;',
      'avoid data leakage (the "duration" feature) and handle class imbalance;',
      'build and interpret logistic regression and tree-based models;',
      'convert model output into a business decision with lift and cost analysis.',
    ],
    requirements: [
      'EDA with at least 6 stated hypotheses tested statistically (chi-square, t-test/Mann–Whitney) with effect sizes.',
      'Explain why "duration" leaks the target and exclude it from the predictive model.',
      'Models: logistic regression baseline and a gradient-boosting or random-forest model, with cross-validation and class-imbalance handling.',
      'Evaluation: ROC-AUC, PR-AUC, calibration, and a lift/gains chart by decile.',
      'Interpretation: coefficients/odds ratios and permutation importance or SHAP; describe the top drivers in plain language.',
      'Business recommendation: who to call, expected conversions vs calling everyone, with assumptions stated.',
    ],
    prerequisites: [
      'Comfortable with Python, pandas and basic statistics; some exposure to scikit-learn.',
    ],
    deliverables: [
      'Public repository with clean notebooks (or scripts), requirements file and README citing the dataset.',
      'A slide deck (8–12 slides) for a non-technical marketing manager.',
      'A technical appendix with methodology and limitations.',
    ],
    qualityFocus: 'correct statistics, leakage awareness, honest evaluation and a clear, quantified business recommendation.',
    milestones: [
      m('Exploration', 'Weeks 1–2.', [
        t('bm-eda', 'Data audit and hypothesis-driven EDA', 'Complete requirements 1 and 2.', 'Each hypothesis has a test, p-value, effect size and plain-language conclusion; leakage explanation is correct.', ['CODE', 'DOCUMENT'], 14),
      ]),
      m('Modelling', 'Weeks 3–4.', [
        t('bm-models', 'Predictive models and evaluation', 'Complete requirements 3 and 4.', 'No leakage; CV results reported; test set used once; lift chart by decile included.', ['CODE'], 26, ['bm-eda']),
        t('bm-interpret', 'Model interpretation', 'Complete requirement 5.', 'Top drivers explained in plain language with direction and magnitude.', ['CODE', 'DOCUMENT'], 30, ['bm-models']),
      ]),
      m('Recommendation and delivery', 'Weeks 5–6.', [
        t('bm-strategy', 'Calling strategy and impact estimate', 'Complete requirement 6.', 'Strategy states the target segment, expected conversions and assumptions; sensitivity to assumptions shown.', ['DOCUMENT'], 36, ['bm-interpret']),
        t('bm-delivery', 'Slide deck, appendix and README', 'Prepare the deck and technical appendix.', 'Deck tells a clear story for a non-technical reader; appendix documents methods and limitations.', ['DOCUMENT'], 42, ['bm-strategy']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-da-ab-testing',
    domain: 'Data & Analytics',
    level: 'INTERMEDIATE',
    weeks: 4,
    hours: '8–10',
    programTitle: 'Data Analytics Internship: A/B Test Design and Analysis',
    projectTitle: 'A/B Test Design, Simulation and Analysis for a Checkout Experiment',
    skills: ['Statistics', 'Python for Data Analysis', 'SQL'],
    scenario: [
      'Scenario (fictional): an online learning platform wants to test a new one-page checkout. Product analysts are expected to design such experiments correctly and explain the results without overclaiming.',
      'You will design the experiment, generate a realistic synthetic event dataset with a documented generator (including traps such as sample-ratio mismatch and novelty effects), analyse it with SQL and Python, and write a decision memo.',
      CAREER_NOTE,
    ],
    outcomes: [
      'write an experiment design: hypothesis, primary and guardrail metrics, unit of randomisation;',
      'compute sample size and test duration from power analysis;',
      'analyse conversion experiments with frequentist (and optionally Bayesian) methods;',
      'detect common pitfalls and communicate a decision.',
    ],
    requirements: [
      'Experiment design document: hypothesis, primary metric (checkout conversion), guardrails (refund rate, page load), minimum detectable effect, randomisation unit.',
      'Power analysis for sample size and duration given a baseline conversion you justify.',
      'A seeded Python generator producing user-level assignment and event tables with configurable effect size, a sample-ratio mismatch option and a novelty effect.',
      'SQL to compute metrics per variant per day from the raw event tables.',
      'Analysis: SRM check (chi-square), two-proportion z-test and confidence intervals, segment analysis with a multiple-testing correction, and a novelty check over time.',
      'A one-page decision memo: ship, don’t ship or extend, with reasoning and risks.',
    ],
    prerequisites: [
      'Basic statistics (means, variance, hypothesis tests), Python with pandas, and SQL.',
    ],
    deliverables: [
      'Public repository with the design document, generator, SQL, analysis notebook and README.',
      'Decision memo and a short "pitfalls" note showing how each injected trap was detected.',
      'Tests for the generator (assignment ratio, reproducibility with a seed).',
    ],
    qualityFocus: 'a correct design and power analysis, correct tests and intervals, and detection of the injected pitfalls.',
    milestones: [
      m('Design', 'Week 1.', [
        t('ab-design', 'Experiment design and power analysis', 'Complete requirements 1 and 2.', 'Design names primary and guardrail metrics; sample size calculation is shown and correct.', ['DOCUMENT'], 7),
      ]),
      m('Data', 'Week 2.', [
        t('ab-generator', 'Synthetic data generator and SQL metrics', 'Complete requirements 3 and 4.', 'Generator is seeded and tested; SQL daily metrics match pandas calculations.', ['CODE'], 14, ['ab-design']),
      ]),
      m('Analysis', 'Week 3.', [
        t('ab-analysis', 'Statistical analysis and pitfall detection', 'Complete requirement 5 on clean data and on data with each trap enabled.', 'SRM is detected when injected; intervals are correct; segment results use a correction; novelty effect identified.', ['CODE', 'DOCUMENT'], 21, ['ab-generator']),
      ]),
      m('Decision', 'Week 4.', [
        t('ab-memo', 'Decision memo and README', 'Complete requirement 6 and the documentation.', 'Memo gives a clear decision with uncertainty stated; README explains how to reproduce every figure.', ['DOCUMENT'], 28, ['ab-analysis']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-da-air-quality',
    domain: 'Data & Analytics',
    level: 'BEGINNER',
    weeks: 6,
    hours: '6–8',
    programTitle: 'Data Analytics Internship: Indian City Air Quality Trends Dashboard',
    projectTitle: 'Air Quality Trends Analysis and Tableau Dashboard for Indian Cities',
    skills: ['Tableau', 'Python for Data Analysis', 'Statistics'],
    scenario: [
      'Air pollution is a major public-health issue in Indian cities, and the data is openly published. Turning it into a clear, honest dashboard is a strong, socially relevant portfolio piece.',
      'Using open air-quality data published on data.gov.in (Open Government Data Licence – India) or the CPCB portal — confirm the licence for the exact files you use and cite them — you will clean multi-city pollutant data, analyse seasonal and city-level trends, and publish a Tableau Public dashboard (Power BI is an acceptable alternative).',
      CAREER_NOTE,
    ],
    outcomes: [
      'source, combine and clean messy public data with pandas;',
      'handle missing values and outliers transparently;',
      'analyse seasonality and compare groups with descriptive statistics;',
      'design an honest, accessible dashboard with clear annotations.',
    ],
    requirements: [
      'Collect data for at least 5 cities and 2 years; document sources, licence and download dates.',
      'Clean and combine with pandas: consistent units, station-to-city aggregation, missing-data report and a stated imputation (or exclusion) policy.',
      'Compute AQI category days per city per month using the official Indian AQI breakpoints, citing the source of the breakpoints.',
      'Analysis: seasonal patterns, worst months per city, weekday vs weekend comparison, and pollutant correlations.',
      'Tableau Public dashboard: city selector, calendar heatmap, monthly trends, AQI category distribution, with annotations and a colour-blind-safe palette.',
      'A short article (blog post or README) explaining findings and data limitations to a general audience.',
    ],
    prerequisites: [
      'Basic Python and pandas, or strong spreadsheet skills with willingness to learn pandas.',
    ],
    deliverables: [
      'Public repository with download notes, cleaning notebook, cleaned dataset (if the licence allows redistribution) and README.',
      'Published Tableau Public dashboard link plus screenshots.',
      'The findings article.',
    ],
    qualityFocus: 'transparent cleaning decisions, correct AQI computation, and a clear, accessible, honest dashboard.',
    milestones: [
      m('Data collection and cleaning', 'Weeks 1–2.', [
        t('aq-collect', 'Data collection and source log', 'Complete requirement 1.', 'Source log lists URLs, licence and download dates for every file.', ['DOCUMENT'], 7),
        t('aq-clean', 'Cleaning and missing-data policy', 'Complete requirement 2.', 'Notebook runs end to end; missing-data report per city; policy justified.', ['CODE', 'DOCUMENT'], 14, ['aq-collect']),
      ]),
      m('Analysis', 'Weeks 3–4.', [
        t('aq-aqi', 'AQI categorisation', 'Complete requirement 3.', 'AQI calculation matches the official method on 5 hand-checked days.', ['CODE'], 20, ['aq-clean']),
        t('aq-analysis', 'Seasonal and city-level analysis', 'Complete requirement 4.', 'Each finding is backed by a chart or table; correlation is not presented as causation.', ['CODE', 'DOCUMENT'], 28, ['aq-aqi']),
      ]),
      m('Dashboard and story', 'Weeks 5–6.', [
        t('aq-dashboard', 'Tableau Public dashboard', 'Complete requirement 5.', 'Dashboard is published, interactive and annotated; palette is colour-blind safe.', ['LIVE_DEMO'], 36, ['aq-analysis']),
        t('aq-article', 'Findings article and README', 'Complete requirement 6.', 'Article is understandable to a non-expert and states limitations; README explains reproduction.', ['DOCUMENT'], 42, ['aq-dashboard']),
      ]),
    ],
  }),

  opportunity({
    key: 'pf-da-energy-forecast',
    domain: 'Data & Analytics',
    level: 'INTERMEDIATE',
    weeks: 8,
    hours: '10–12',
    programTitle: 'Data Analytics Internship: Household Electricity Demand Forecasting',
    projectTitle: 'Household Electricity Demand Forecasting with Time-Series Models',
    skills: ['Python for Data Analysis', 'Statistics', 'Basic Machine Learning'],
    scenario: [
      'Scenario (fictional brief, real data): an energy-efficiency startup wants to forecast household electricity use a day ahead so it can warn users before expensive peak periods.',
      'Using the UCI "Individual Household Electric Power Consumption" dataset (CC BY 4.0 — confirm and cite), you will clean minute-level data, analyse patterns, and build and compare forecasting models with proper time-series validation.',
      CAREER_NOTE,
    ],
    outcomes: [
      'clean and resample high-frequency time-series data;',
      'decompose series into trend and seasonality and test stationarity;',
      'build statistical (SARIMA/ETS) and ML (gradient boosting with lag features) forecasters;',
      'evaluate forecasts with walk-forward validation and communicate uncertainty.',
    ],
    requirements: [
      'Clean the data (missing minutes, units), resample to hourly and daily series, and document every decision.',
      'EDA: daily/weekly/annual seasonality, sub-metering breakdown, decomposition (STL) and stationarity tests (ADF/KPSS).',
      'Baselines: naive and seasonal-naive forecasts.',
      'Models: SARIMA or ETS (statsmodels) and a gradient-boosting model with lag, rolling and calendar features (and Prophet optionally).',
      'Walk-forward (rolling-origin) validation; report MAE, RMSE and MAPE per horizon; prediction intervals for the best model.',
      'A small Streamlit app showing history, forecast and intervals for a chosen period, plus a findings report.',
    ],
    prerequisites: [
      'Comfortable with Python and pandas; basic statistics; no prior time-series experience required.',
    ],
    deliverables: [
      'Public repository with notebooks, a reusable forecasting module, the Streamlit app and README citing the dataset.',
      'A findings report comparing models with charts and a recommendation.',
      'Tests for feature engineering (no future information leaks into features).',
    ],
    qualityFocus: 'leakage-free features, correct walk-forward evaluation, honest comparison against baselines, and clear uncertainty communication.',
    milestones: [
      m('Data', 'Weeks 1–2.', [
        t('ef-clean', 'Cleaning and resampling', 'Complete requirement 1 and cite the dataset.', 'Missing-data handling documented; hourly and daily series saved; row counts reconcile.', ['CODE', 'DOCUMENT'], 10),
        t('ef-eda', 'Time-series EDA', 'Complete requirement 2.', 'Seasonality and decomposition plots interpreted; stationarity test results explained.', ['CODE', 'DOCUMENT'], 14, ['ef-clean']),
      ]),
      m('Modelling', 'Weeks 3–5.', [
        t('ef-baselines', 'Baselines and validation framework', 'Complete requirement 3 and implement walk-forward validation.', 'Validation never trains on future data (tested); baseline errors reported per horizon.', ['CODE'], 21, ['ef-eda']),
        t('ef-models', 'Statistical and ML forecasters', 'Complete requirement 4.', 'Feature tests prove no leakage; both model families evaluated with the same framework.', ['CODE'], 35, ['ef-baselines']),
      ]),
      m('Evaluation', 'Week 6.', [
        t('ef-eval', 'Model comparison and prediction intervals', 'Complete requirement 5.', 'Results table per horizon; best model beats seasonal-naive or the report explains why not; intervals are calibrated (coverage reported).', ['CODE', 'DOCUMENT'], 42, ['ef-models']),
      ]),
      m('App and delivery', 'Weeks 7–8.', [
        t('ef-app', 'Streamlit forecast app', 'Build the app from requirement 6.', 'App runs locally (and optionally on Streamlit Community Cloud) and shows forecasts with intervals.', ['CODE', 'LIVE_DEMO'], 50, ['ef-eval']),
        t('ef-delivery', 'Findings report and README', 'Write the report and finalise documentation.', 'Report gives a clear recommendation with limitations; README explains how to reproduce.', ['DOCUMENT'], 56, ['ef-app']),
      ]),
    ],
  }),
];

export const OPPORTUNITIES: ReadonlyArray<OpportunityContent> = [
  ...FRONTEND,
  ...BACKEND,
  ...FULL_STACK,
  ...PYTHON,
  ...DATA,
];
