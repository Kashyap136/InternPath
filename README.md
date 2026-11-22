# InternPath

**Free Project-Based Technical Internship Management Platform**

## Overview

InternPath is a web-based platform that manages structured, mentor-supervised, project-based technical internships end-to-end: assessment, programs, applications, project repository, assignment, tasks, link-based submissions, review, rubric evaluation, completion, certificates and public verification.

Students register free of charge, take a timed skills assessment in a technical domain, and apply to open programs. Accepted students complete a real project under a dedicated mentor — submitting work through linked repositories and documents, receiving structured feedback, and revising until each milestone is approved. Administrators publish programs, match mentors and students, verify completion and issue verifiable completion certificates. Internships on the platform are unpaid learning engagements; the participation policy documents exactly what the platform does and does not charge for.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js 22, Express 5, TypeScript |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 5 |
| Validation | Zod |

## Project Structure

```
internpath/
├── backend/                 # Express API
│   ├── prisma/             # Prisma schema, migrations, seed
│   └── src/
│       ├── modules/        # Feature modules (Sprint 1+)
│       ├── shared/         # Shared utilities, middleware, config
│       ├── app.ts          # Express app setup
│       └── server.ts       # Server entry point
├── frontend/               # Next.js App Router
│   ├── src/
│   │   ├── app/           # Pages & layouts
│   │   ├── components/    # Shared UI components
│   │   ├── lib/           # API client, utilities
│   │   ├── hooks/         # React hooks
│   │   ├── types/         # TypeScript types
│   │   └── styles/        # Global styles
│   └── public/
├── package.json            # Root workspace (npm workspaces: backend, frontend)
└── package-lock.json       # npm lockfile (single lockfile for the workspace)
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- A Supabase PostgreSQL project (local PostgreSQL is not part of the
  documented environment; connection settings live in `backend/.env`, which is
  never committed)

### Installation

```bash
# Install dependencies for all workspaces from the repository root
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Generate Prisma client
npm run db:generate

# Apply the verified baseline migration (Phase 5+ uses a single verified
# baseline; `prisma migrate dev` is NOT part of the documented flow)
npm run db:migrate:deploy

# Seed the database — creates the three controlled demo accounts
# (admin/mentor/student @internpath.demo), the domain/skill/assessment
# catalogue and three demo-labelled programs. Fail-closed in production:
# seeding there requires INTERNPATH_ALLOW_DEMO_SEED=true.
npm run db:seed
```

> Dependencies are managed with **npm workspaces** from the repository root.
> Always run installs from the root so the single root `package-lock.json`
> stays authoritative — do not create lockfiles inside `backend/` or `frontend/`.

### Development

```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:backend
npm run dev:frontend
```

> On Windows the combined `npm run dev` cannot keep two watch processes alive
> in one terminal. Start the backend and frontend in two separate terminals
> using `npm run dev:backend` and `npm run dev:frontend`.

### Environment Loading

The backend loads `backend/.env` before configuration validation, resolving
the file relative to the backend package so it works for both `dev` (tsx) and
the compiled `start` command, regardless of the current working directory.
In production, injected environment variables take precedence over any local
`.env`; missing required variables still cause a clear startup failure.

### Building

```bash
# Build both frontend and backend
npm run build

# Backend only
npm run build --workspace=@internpath/backend

# Frontend only
npm run build --workspace=@internpath/frontend
```

## Current Status

> **Updated (2026-11-18, public-release preparation):** the authoritative
> status documents are the public-release set in `docs/07-final/` —
> `InternPath_Final_Production_Readiness_Report.md` (readiness gates),
> `InternPath_Security_and_Privacy_Audit.md`,
> `InternPath_End_to_End_Acceptance_Test_Report.md`,
> `InternPath_Production_Deployment_and_Operations_Runbook.md` and
> `InternPath_Release_Blockers_and_Owner_Decisions.md`. The historical
> "Sprint 0" foundation checklist that used to live here is preserved
> unmodified in the git-tracked history and in the phase reports for
> traceability.

The platform's core workflows (registration, assessment, application,
mentor-supervised project work, evaluation, certificates, public
verification) are implemented and verified end to end. Deployment readiness
is gated on the owner decisions documented in
`InternPath_Release_Blockers_and_Owner_Decisions.md`.

## Demo Environment (Development Only)

The repository's development environment doubles as the controlled **demo
environment**: it contains exactly three demo accounts plus the seed
catalogue. Demo credentials are intentionally public **in this development
environment only** — production never receives seeded demo accounts (the
seed is fail-closed there), no demo credentials exist in any frontend bundle,
and demo passwords must be rotated per the operations runbook before any
shared or staging use.

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@internpath.demo | Demo-738bfa6b91c241a1a2504cbe-Ax9 |
| Student | student@internpath.demo | Demo-6a2ff3c391e9feb133fa8208-Ax9 |
| Mentor | mentor@internpath.demo | Demo-2e24c83815dd7275aeb28f7c-Ax9 |

⚠️ **Demo environment notice**: this repository's development database is the
controlled demo environment — its three accounts and records exist for
testing and presentation only, are clearly demo-labelled, and are not the
production database. Production is provisioned per the operations runbook
with no seeded accounts.

## Documentation

Authoritative documents (in order):
1. `docs/02-requirements/InternPath_Requirement_Engineering_and_Stakeholder_Analysis.docx`
2. `docs/02-requirements/InternPath_Blocking_Decision_Sheet.md` (Version 3 — approved)
3. `docs/03-srs/InternPath_Software_Requirements_Specification_v1.0.md`
4. `docs/03-srs/InternPath_Implementation_Baseline.md`

Current operational guides and reports:

| Topic | Document |
|-------|----------|
| Local setup & run | `docs/07-final/InternPath_Local_Development_Setup_Guide.md` |
| **Fresh production-readiness audit (2026-11-21, current)** | `docs/07-final/InternPath_Fresh_Comprehensive_Production_Readiness_Audit.md`. Supersedes the readiness claims below where they differ |
| **Opportunity content package (2027 Summer Cohort, DRAFT)** | `docs/07-final/InternPath_2027_Summer_Cohort_Opportunity_Content_Package.md` |
| **Production readiness gates** | `docs/07-final/InternPath_Final_Production_Readiness_Report.md` |
| **Security & privacy audit** | `docs/07-final/InternPath_Security_and_Privacy_Audit.md` |
| **End-to-end acceptance tests** | `docs/07-final/InternPath_End_to_End_Acceptance_Test_Report.md` |
| **Deployment & operations** | `docs/07-final/InternPath_Production_Deployment_and_Operations_Runbook.md` |
| **Release blockers & owner decisions** | `docs/07-final/InternPath_Release_Blockers_and_Owner_Decisions.md` |
| **Demo & test data policy** | `docs/07-final/InternPath_Demo_and_Test_Data_Management_Report.md` |
| **Public product transformation** | `docs/07-final/InternPath_Public_Product_Transformation_Report.md` |
| **Git preservation & staging plan** | `docs/07-final/InternPath_Final_Git_Preservation_Report.md` |
| Examiner presentation runbook | `docs/07-final/InternPath_Phase_13_Examiner_Presentation_Runbook.md` |
| Owner decisions & open items | `docs/07-final/InternPath_Phase_13_Owner_Decisions_and_Open_Items.md` |
| UI/UX design system | `docs/08-ui-ux/InternPath_UI_UX_Design_Specification.md` |
| UI overhaul evidence (2026-11) | `docs/07-final/InternPath_UI_Frontend_Backend_Audit_Report.md` (+ page inventory, responsive verification, integration reports) |
| Phase history (Phases 1–13) | `docs/07-final/InternPath_Phase_*` reports — historical evidence, retained |

Root-level documents `BASELINE_REPORT.md`, `IMPLEMENTATION_PLAN.md`,
`IMPLEMENTATION_SUMMARY.md` and `UI_UX_IMPLEMENTATION_CHECKLIST.md` are
**historical** (October 2026 planning/baseline records; each carries a status
banner or addendum). They are cited by name in several audit reports and are
preserved at the root for traceability — do not use them as current guidance.

## Deployment

The production deployment procedure — hosting recommendations, environment
variable checklist, database migration execution, backup/restore, monitoring
and rollback — is documented in
`docs/07-final/InternPath_Production_Deployment_and_Operations_Runbook.md`.
Do not deploy without resolving the owner decisions listed in
`docs/07-final/InternPath_Release_Blockers_and_Owner_Decisions.md`.

## License

InternPath is a privately maintained product; see the operations runbook for
ownership and operational requirements before deploying or operating it.
