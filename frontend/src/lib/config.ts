// Frontend Configuration
// Reads environment variables with defaults

// Same-origin API base path. Next.js rewrites `/api/backend/:path*` to the
// backend server (see next.config.js), so cookies are same-origin and no CORS
// is involved in dev or production (`next start`).
export const apiUrl = '/api/backend';

// Academic/demo notice (ASM-CAND-022).
// P1-04 fix (comprehensive audit 2026-11-15): the demo helper is now an
// explicit opt-in — it renders only when NEXT_PUBLIC_DEMO_NOTICE_ENABLED is
// exactly 'true' (set in the local, git-ignored frontend/.env.local). The
// previous default-on behaviour silently shipped demo UI (and, until the
// companion fix, demo credentials) into every build including production.
export const demoNoticeEnabled =
  process.env.NEXT_PUBLIC_DEMO_NOTICE_ENABLED === 'true';

export const appName = 'InternPath';
export const appDescription =
  'Free Project-Based Technical Internship Management Platform';