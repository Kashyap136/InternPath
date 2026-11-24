// Apply committed Prisma migrations before the server starts serving.
//
// Why this lives in the app and not in the host's start command: the hosted
// backend's dashboard settings are not guaranteed to follow render.yaml, and
// when a release added a column (User.emailVerifiedAt) the deployed code ran
// against the old schema — every user lookup failed with DATABASE_ERROR and
// Google sign-in showed "Google sign-in failed". Running the migration here
// guarantees code and schema ship together, whatever the start command is.
//
// `prisma migrate deploy` only applies committed, not-yet-applied migration
// files; it never resets, drops or re-seeds data.
//
// Enabled automatically on Render (RENDER=true is set by the platform).
// AUTO_MIGRATE=true forces it on elsewhere; AUTO_MIGRATE=false turns it off.
// Local development is unaffected unless explicitly enabled.

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.resolve(__dirname, '../../../prisma/schema.prisma');
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../prisma/migrations');

function isEnabled(): boolean {
  const flag = (process.env.AUTO_MIGRATE ?? '').toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return process.env.RENDER === 'true';
}

function runPrisma(args: string[]): { ok: boolean; output: string } {
  const cli = require.resolve('prisma/build/index.js');
  const result = spawnSync(process.execPath, [cli, ...args, '--schema', SCHEMA_PATH], {
    encoding: 'utf8',
    env: process.env,
    timeout: 120_000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  return { ok: result.status === 0, output: output.trim() };
}

/** The oldest committed migration: the schema baseline. */
function baselineMigrationName(): string | null {
  try {
    const dirs = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    return dirs[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Never throws: a migration failure is logged loudly and the server still
 * starts, so a bad migration cannot take the whole API offline.
 */
export function applyPendingMigrations(): void {
  if (!isEnabled()) return;

  console.log('🗄️  Applying pending database migrations (prisma migrate deploy)...');
  let result = runPrisma(['migrate', 'deploy']);

  // P3005: the database already has tables but no Prisma migration history
  // (it was created with `db push` or by running the baseline SQL by hand).
  // Record the baseline as already applied, then apply the newer migrations.
  if (!result.ok && result.output.includes('P3005')) {
    const baseline = baselineMigrationName();
    if (baseline) {
      console.warn(`⚠️  Database has no migration history; marking baseline "${baseline}" as applied.`);
      const resolved = runPrisma(['migrate', 'resolve', '--applied', baseline]);
      console.log(resolved.output);
      if (resolved.ok) result = runPrisma(['migrate', 'deploy']);
    }
  }

  console.log(result.output);
  if (result.ok) {
    console.log('✅ Database schema is up to date');
  } else {
    console.error('❌ prisma migrate deploy FAILED — the database schema may be out of date. Output above.');
  }
}
