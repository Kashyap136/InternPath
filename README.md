# InternPath Project

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
