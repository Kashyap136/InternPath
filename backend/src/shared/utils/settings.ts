// Platform Settings Utilities
// Provides type-safe access to PlatformSetting records

import { prisma } from '../prisma/client';
import type { Prisma } from '@prisma/client';
import { createAuditLog, AuditAction } from './audit';

/**
 * Setting value types
 * All values are stored as JSON strings in the database
 */
export type SettingValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, unknown>;

/**
 * Default settings for Sprint 0
 * TEMP values are marked and must remain configurable
 */
export const DEFAULT_SETTINGS: Record<string, { value: SettingValue; description: string; temp: boolean }> = {
  // Authentication & Security
  passwordMinLength: {
    value: 8,
    description: 'Minimum password length (TEMP)',
    temp: true,
  },
  sessionInactivityTimeout: {
    value: 3600,
    description: 'Session inactivity timeout in seconds (TEMP)',
    temp: true,
  },
  tempPasswordValidityHours: {
    value: 24,
    description: 'Temporary password validity in hours (TEMP)',
    temp: true,
  },

  // Rate Limiting
  rateLimitWindowMs: {
    value: 900000,
    description: 'Rate limit window in milliseconds (TEMP)',
    temp: true,
  },
  rateLimitMaxRequests: {
    value: 100,
    description: 'Maximum requests per rate limit window (TEMP)',
    temp: true,
  },

  // Application Lifecycle
  acceptancePeriodDays: {
    value: 3,
    description: 'Application acceptance period in days (TEMP, MD proposed)',
    temp: true,
  },

  // Review & Feedback
  reviewPeriodDays: {
    value: 3,
    description: 'Review period in calendar days (TEMP)',
    temp: true,
  },

  // Assessment
  assessmentTimeLimitMinutes: {
    value: 30,
    description: 'Assessment time limit in minutes (TEMP, MD proposed)',
    temp: true,
  },
  assessmentQuestionSelection: {
    value: 'all_active',
    description: 'Question selection strategy: all_active | random:N (TEMP)',
    temp: true,
  },
  retakeIntervalDays: {
    value: 7,
    description: 'Assessment retake interval in days (TEMP)',
    temp: true,
  },

  // Submissions
  resubmissionLimit: {
    value: -1, // -1 = unlimited
    description: 'Maximum resubmissions per task (-1 = unlimited) (TEMP)',
    temp: true,
  },
  lateSubmissionPolicy: {
    value: 'allow_flag',
    description: 'Late submission policy: allow_flag | reject (TEMP)',
    temp: true,
  },

  // Internship Extension
  extensionMaxDays: {
    value: 7,
    description: 'Maximum internship extension in days (TEMP)',
    temp: true,
  },

  // Skills & Assessment
  weakSkillThreshold: {
    value: 4,
    description: 'Skill score threshold for weak skill recommendation (TEMP)',
    temp: true,
  },

  // Code Hosting
  permittedCodeHosts: {
    value: ['github.com', 'gitlab.com', 'bitbucket.org'],
    description: 'Permitted code hosting domains (MD §21.1)',
    temp: false, // Documented requirement, not TEMP
  },

  // Completion & Certificates
  completionThreshold: {
    value: 60,
    description: 'Completion threshold percentage (USER-APPROVED, Guide confirmation pending GC-03)',
    temp: true, // Marked TEMP because Guide confirmation pending
  },
  appreciationThreshold: {
    value: 85,
    description: 'Appreciation threshold percentage (DEF, not Guide-approved)',
    temp: true, // Marked TEMP because deferred
  },

  // Project Matching (DEC-011)
  projectMatchingMode: {
    value: 'domain_only',
    description: 'Project matching: domain_only | domain_difficulty_duration (DEF/UND)',
    temp: true, // Difficulty/duration matching is UND/GUIDE CONFIRMATION
  },
};

/**
 * P2-01 fix (comprehensive audit 2026-11-15): per-key type and range schemas.
 * Previously an admin could store e.g. `sessionInactivityTimeout: 0`, which
 * would expire every session on the next request — a platform-wide lockout
 * only recoverable through direct database access. Every write is now
 * validated against these bounds (see admin.routes.ts).
 */
import { z } from 'zod';

export const SETTING_VALUE_SCHEMAS: Record<string, z.ZodType<SettingValue>> = {
  passwordMinLength: z.number().int().min(8).max(128),
  sessionInactivityTimeout: z.number().int().min(300, 'Minimum 5 minutes — lower values lock every user out').max(86400, 'Maximum 24 hours'),
  tempPasswordValidityHours: z.number().int().min(1).max(168),
  rateLimitWindowMs: z.number().int().min(1000),
  rateLimitMaxRequests: z.number().int().min(1),
  acceptancePeriodDays: z.number().int().min(1).max(14),
  reviewPeriodDays: z.number().int().min(1).max(30),
  assessmentTimeLimitMinutes: z.number().int().min(5).max(180),
  assessmentQuestionSelection: z.union([
    z.literal('all_active'),
    z.string().regex(/^random:\d+$/, 'Must be "all_active" or "random:N"'),
  ]),
  retakeIntervalDays: z.number().int().min(0).max(365),
  resubmissionLimit: z.number().int().min(-1),
  lateSubmissionPolicy: z.enum(['allow_flag', 'reject']),
  extensionMaxDays: z.number().int().min(1).max(90),
  weakSkillThreshold: z.number().min(0).max(10),
  permittedCodeHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/i, 'Must be a hostname')).min(1),
  completionThreshold: z.number().min(0).max(100),
  appreciationThreshold: z.number().min(0).max(100),
  projectMatchingMode: z.enum(['domain_only', 'domain_difficulty_duration']),
};

/**
 * Keys actually consumed by runtime behaviour. The remaining keys are shown
 * in the admin UI as disabled ("not yet enforced") pending owner decision
 * OD-7 — displaying editable controls for them would be misleading.
 */
export const ENFORCED_SETTING_KEYS = new Set([
  'sessionInactivityTimeout',
  'tempPasswordValidityHours',
  'acceptancePeriodDays',
  'reviewPeriodDays',
  'assessmentTimeLimitMinutes',
  'assessmentQuestionSelection',
  'retakeIntervalDays',
  'resubmissionLimit',
  'extensionMaxDays',
  'permittedCodeHosts',
  'completionThreshold',
  'appreciationThreshold',
]);

/** Validate a candidate value for a key; returns an error message or null. */
export function validateSettingValue(key: string, value: unknown): string | null {
  const schema = SETTING_VALUE_SCHEMAS[key];
  if (!schema) return `Unknown setting key: ${key}`;
  const result = schema.safeParse(value);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return issue ? `${key}: ${issue.message}` : `${key}: invalid value`;
}

/**
 * Get a setting value with type safety
 */
export async function getSetting<T extends SettingValue>(key: string, defaultValue?: T): Promise<T> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key },
  });

  if (!setting) {
    if (defaultValue !== undefined) return defaultValue;
    const defaultSetting = DEFAULT_SETTINGS[key];
    if (defaultSetting) return defaultSetting.value as T;
    throw new Error(`Setting not found: ${key}`);
  }

  try {
    return JSON.parse(setting.value) as T;
  } catch {
    // If not valid JSON, return as string
    return setting.value as unknown as T;
  }
}

/**
 * Get multiple settings at once
 */
export async function getSettings(keys: string[]): Promise<Record<string, SettingValue>> {
  const settings = await prisma.platformSetting.findMany({
    where: { key: { in: keys } },
  });

  const result: Record<string, SettingValue> = {};
  for (const setting of settings) {
    try {
      result[setting.key] = JSON.parse(setting.value) as SettingValue;
    } catch {
      result[setting.key] = setting.value;
    }
  }

  // Fill in defaults for missing keys
  for (const key of keys) {
    if (!(key in result)) {
      const defaultSetting = DEFAULT_SETTINGS[key];
      if (defaultSetting) {
        result[key] = defaultSetting.value;
      }
    }
  }

  return result;
}

/**
 * Set a setting value (admin only)
 * Creates audit log entry. Accepts an optional transaction client so a
 * multi-key update can be applied atomically (P2-01).
 */
export async function setSetting(
  key: string,
  value: SettingValue,
  actorId: string,
  reason: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  const existing = await client.platformSetting.findUnique({ where: { key } });
  const oldValue = existing ? (JSON.parse(existing.value) as SettingValue) : null;

  const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

  await client.platformSetting.upsert({
    where: { key },
    update: { value: jsonValue },
    create: { key, value: jsonValue },
  });

  await createAuditLog({
    actorId,
    action: existing ? AuditAction.SETTING_UPDATED : AuditAction.SETTING_CREATED,
    entityType: 'PlatformSetting',
    entityId: key,
    oldValue: oldValue as Record<string, unknown> | null,
    newValue: value as Record<string, unknown>,
    reason,
    client,
  });
}

/**
 * Initialize default settings (idempotent)
 * Used by seed script
 */
export async function initializeDefaultSettings(actorId?: string): Promise<void> {
  for (const [key, { value, description, temp }] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await prisma.platformSetting.findUnique({ where: { key } });
    if (!existing) {
      const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
      await prisma.platformSetting.create({
        data: { key, value: jsonValue },
      });
      await createAuditLog({
        actorId,
        action: AuditAction.SETTING_CREATED,
        entityType: 'PlatformSetting',
        entityId: key,
        newValue: { key, value, description, temp },
        reason: 'Initial default setting from seed',
      });
    }
  }
}

/**
 * Get all settings with metadata (for admin UI)
 */
export async function getAllSettingsWithMeta(): Promise<
  Array<{ key: string; value: SettingValue; description: string; temp: boolean; enforced: boolean }>
> {
  const settings = await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  const settingMap = new Map(settings.map((s) => [s.key, s]));

  return Object.entries(DEFAULT_SETTINGS).map(([key, meta]) => {
    const setting = settingMap.get(key);
    let value: SettingValue;
    if (setting) {
      try {
        value = JSON.parse(setting.value) as SettingValue;
      } catch {
        value = setting.value;
      }
    } else {
      value = meta.value;
    }
    return {
      key,
      value,
      description: meta.description,
      temp: meta.temp,
      // P2-01: the admin UI disables controls whose keys no runtime code
      // consumes, so it never offers a control that does nothing (OD-7).
      enforced: ENFORCED_SETTING_KEYS.has(key),
    };
  });
}