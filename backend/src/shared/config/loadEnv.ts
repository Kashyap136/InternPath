// Environment Loader
// Loads the backend `.env` file before configuration validation runs.
//
// The path is resolved relative to this module, so it works for both the
// TypeScript dev entry point (`src/shared/config`) and the compiled production
// entry point (`dist/shared/config`) regardless of the current working
// directory. In production, injected environment variables always win: dotenv
// never overrides variables that are already set.

import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

// __dirname is `backend/src/shared/config` (dev) or `backend/dist/shared/config`
// (compiled). Three levels up is the backend package root in both cases.
const envPath = path.resolve(__dirname, '../../../.env');

if (fs.existsSync(envPath)) {
  loadDotenv({ path: envPath });
} else {
  // No local .env file: rely on injected environment variables.
  loadDotenv();
}

// Diagnostic only: report whether required variables are present, never values.
const REQUIRED_KEYS = ['DATABASE_URL', 'JWT_SECRET', 'COOKIE_SECRET'] as const;
if (process.env.NODE_ENV !== 'test') {
  const status = REQUIRED_KEYS.map(
    (key) => `${key}:${process.env[key] ? 'set' : 'MISSING'}`
  ).join(', ');
  console.log(`[env] Loaded environment (${status})`);
}
