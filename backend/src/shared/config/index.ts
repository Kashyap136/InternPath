// Configuration Module
// Centralizes environment variable access with validation

// Ensure the environment file is loaded before validation runs. This import
// must stay first so that `config` below always sees the loaded variables.
import './loadEnv';

import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Server
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Session
  SESSION_TIMEOUT: z.coerce.number().default(3600),

  // Security
  JWT_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),

  // Frontend origin (CORS, OAuth callback default, redirects). Trailing
  // slashes are stripped: CORS compares origins exactly, so a pasted
  // "https://host/" would otherwise reject every credentialed request.
  FRONTEND_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((value) => value.replace(/\/+$/, '')),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Demo Notice
  DEMO_NOTICE_ENABLED: z.coerce.boolean().default(true),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

/**
 * Hosted-deployment safety checks (deployment sprint 2026-11-22). Runs only
 * when NODE_ENV=production and returns human-readable problems (never values):
 *  - FRONTEND_URL must be set explicitly to an https:// origin — the localhost
 *    default would silently break CORS, cookies and the OAuth callback.
 *  - DATABASE_URL must not target the shared development database
 *    (internpath_dev) or a test database; a deliberate exception requires
 *    INTERNPATH_ALLOW_DEV_DATABASE=true.
 */
export function assertProductionEnv(env: Record<string, string | undefined>): string[] {
  if ((env.NODE_ENV ?? '').toLowerCase() !== 'production') return [];
  const problems: string[] = [];
  const frontend = env.FRONTEND_URL;
  if (!frontend) {
    problems.push('FRONTEND_URL must be set explicitly in production (the exact https:// frontend origin).');
  } else if (!/^https:\/\//i.test(frontend)) {
    problems.push('FRONTEND_URL must be an https:// origin in production.');
  }
  let dbName = '';
  try {
    dbName = decodeURIComponent(new URL(env.DATABASE_URL ?? '').pathname.replace(/^\//, ''));
  } catch {
    // An unparseable URL is reported by the schema validation instead.
  }
  const allowDev = (env.INTERNPATH_ALLOW_DEV_DATABASE ?? '').toLowerCase() === 'true';
  if (!allowDev && /^internpath_dev$|test/i.test(dbName)) {
    problems.push(
      `DATABASE_URL targets the "${dbName}" database, which is reserved for development/testing. ` +
        'Point the hosted deployment at its own database (or set INTERNPATH_ALLOW_DEV_DATABASE=true to accept this deliberately).'
    );
  }
  return problems;
}

export function getConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }

  const productionProblems = assertProductionEnv(process.env);
  if (productionProblems.length > 0) {
    console.error('❌ Unsafe production configuration:');
    for (const problem of productionProblems) console.error(`  - ${problem}`);
    throw new Error('Unsafe production configuration');
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export const config = getConfig();