// Idempotent seed primitives with an injectable Prisma client.
//
// Design notes:
//  - Every function here takes a client so the unit suite can exercise the
//    idempotency logic offline against an in-memory fake (src/seed-idempotency
//    .test.ts) while `prisma/seed.ts` passes the real PrismaClient bound to
//    DATABASE_URL.
//  - Idempotency is keyed on *natural keys* rather than database unique
//    constraints, because those constraints come from the approved schema:
//      Domain.name (unique)                     -> findUnique
//      Skill (domainId, name) (unique)          -> findUnique (compound)
//      LevelRule (level, domainId) (NO unique)  -> findFirst   [single-process]
//      LevelRuleSkillMinimum (levelRuleId, skillId) (unique) -> findUnique
//      Program (title, domainId) (NO unique)    -> findFirst   [single-process]
//      AssessmentQuestion (text, domainId)      -> findFirst   [single-process]
//      User.email (unique)                      -> findUnique
//    For the models without a database unique constraint, "run twice" safety
//    holds as long as the seed runs from a single process (the documented
//    `npx prisma db seed` pattern).
//  - Password hashing stays in the *adapter* (prisma/seed.ts); this core only
//    performs creates/skips so tests run without bcrypt cost.
//  - No row is ever seeded with a client-supplied ID: Prisma generates CUIDs
//    via @default(cuid()), matching the API validators (MC-26).

import {
  AssessmentQuestion,
  Domain,
  LevelRule,
  LevelRuleSkillMinimum,
  Program,
  ProgramStatus,
  Skill,
  User,
  UserStatus,
  UserRole,
} from '@prisma/client';
import {
  DEMO_DOMAINS,
  DEMO_LEVEL_RULES,
  DEMO_PROGRAMS,
  DEMO_QUESTIONS,
  DEMO_SKILLS,
} from './seed-data';

/* ------------------------------------------------------------------ */
/* Minimal structural client interface (subset actually used)          */
/* ------------------------------------------------------------------ */

export interface SeedPrisma {
  user: {
    findUnique(args: { where: { email: string } }): Promise<User | null>;
    create(args: {
      data: {
        email: string;
        passwordHash: string;
        fullName: string;
        role: UserRole;
        status: UserStatus;
        privacyAcceptedAt: Date;
        mustChangePassword: boolean;
      };
    }): Promise<User>;
  };
  domain: {
    findUnique(args: { where: { name: string } }): Promise<Domain | null>;
    create(args: {
      data: { name: string; description: string };
    }): Promise<Domain>;
  };
  skill: {
    findUnique(args: {
      where: { domainId_name: { domainId: string; name: string } };
    }): Promise<Skill | null>;
    create(args: {
      data: { name: string; domainId: string };
    }): Promise<Skill>;
  };
  levelRule: {
    findFirst(args: {
      where: { level: string; domainId: string };
    }): Promise<LevelRule | null>;
    create(args: {
      data: { level: string; domainId: string };
    }): Promise<LevelRule>;
  };
  levelRuleSkillMinimum: {
    findUnique(args: {
      where: {
        levelRuleId_skillId: {
          levelRuleId: string;
          skillId: string;
        };
      };
    }): Promise<LevelRuleSkillMinimum | null>;
    create(args: {
      data: {
        levelRuleId: string;
        skillId: string;
        minimumScore: number;
      };
    }): Promise<LevelRuleSkillMinimum>;
  };
  program: {
    findFirst(args: {
      where: { title: string; domainId: string };
    }): Promise<Program | null>;
    create(args: {
      data: {
        title: string;
        domainId: string;
        durationWeeks: number;
        level: string;
        seats: number;
        applicationDeadline: Date;
        startDate: Date;
        status: ProgramStatus;
      };
    }): Promise<Program>;
  };
  assessmentQuestion: {
    findFirst(args: {
      where: { text: string; domainId: string };
    }): Promise<AssessmentQuestion | null>;
    create(args: {
      data: {
        text: string;
        options: string[];
        correctOption: number;
        domainId: string;
        skillId: string;
      };
    }): Promise<AssessmentQuestion>;
  };
}

export interface SeedLogger {
  log(message: string): void;
  warn(message: string): void;
}

/**
 * Production demo-seed guard (Phase 8, owner-approved).
 *
 * Fail-closed: demo seeding is refused whenever NODE_ENV=production unless the
 * operator passes an explicit, intentional override flag. The demo seed creates
 * fictional accounts with publicly documented credentials and must never run
 * against a production database by accident.
 */
export function assertSeedAllowed(env: {
  NODE_ENV?: string | undefined;
  INTERNPATH_ALLOW_DEMO_SEED?: string | undefined;
}): void {
  const isProduction = (env.NODE_ENV ?? '').toLowerCase() === 'production';
  const explicitOverride = (env.INTERNPATH_ALLOW_DEMO_SEED ?? '').toLowerCase() === 'true';
  if (isProduction && !explicitOverride) {
    throw new Error(
      'SEED BLOCKED: demo seeding is refused in production (NODE_ENV=production). ' +
        'This seed creates fictional demo accounts with publicly documented ' +
        'credentials plus demo catalog data. If — and only if — demo data is ' +
        'intentionally wanted in a production environment, re-run with ' +
        'INTERNPATH_ALLOW_DEMO_SEED=true.'
    );
  }
}

/**
 * Demo-account password resolution (deployment sprint 2026-11-22).
 *
 * The committed defaults are public (repository, README), so they are refused
 * whenever NODE_ENV=production: any hosted seeding must provide a fresh value
 * through the named environment variable (>= 12 characters). Outside
 * production the env value still wins when present, else the dev default.
 */
export function resolveDemoPassword(
  env: Record<string, string | undefined>,
  key: string,
  devDefault: string
): { password: string; fromEnv: boolean } {
  const value = env[key];
  if (value !== undefined && value !== '') {
    if (value.length < 12) {
      throw new Error(`SEED BLOCKED: ${key} must be at least 12 characters.`);
    }
    if (value === devDefault && (env.NODE_ENV ?? '').toLowerCase() === 'production') {
      throw new Error(`SEED BLOCKED: ${key} equals the public repository default.`);
    }
    return { password: value, fromEnv: true };
  }
  if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
    throw new Error(
      `SEED BLOCKED: ${key} must be set for production/hosted seeding — the ` +
        'repository default demo password is public and is refused.'
    );
  }
  return { password: devDefault, fromEnv: false };
}

export interface SeedCounts {
  created: number;
  existing: number;
}

const EMPTY_COUNTS: Readonly<SeedCounts> = { created: 0, existing: 0 };

function mergeCounts(a: Readonly<SeedCounts>, b: Readonly<SeedCounts>): SeedCounts {
  return { created: a.created + b.created, existing: a.existing + b.existing };
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface DemoUserSeed {
  email: string;
  passwordHash: string; // already hashed by the adapter (bcrypt cost 12)
  fullName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

/** Seeds one user keyed on the unique `email`. Returns true if created. */
export async function createUserIfNotExists(
  prisma: SeedPrisma,
  spec: DemoUserSeed,
  logger: SeedLogger = console
): Promise<SeedCounts> {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  if (existing) {
    logger.log(`  ✓ User already exists: ${spec.email} (${spec.role})`);
    return { created: 0, existing: 1 };
  }
  await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash: spec.passwordHash,
      fullName: spec.fullName,
      role: spec.role,
      status: UserStatus.ACTIVE, // fail-closed default: only ACTIVE demo accounts
      privacyAcceptedAt: new Date(),
      mustChangePassword: spec.mustChangePassword,
      // Seeded demo addresses (e.g. *.demo) cannot receive mail, so they are
      // created as already verified.
      emailVerifiedAt: new Date(),
    },
  });
  logger.log(`  ✅ Created user: ${spec.email} (${spec.role})`);
  return { created: 1, existing: 0 };
}

/* ------------------------------------------------------------------ */
/* Catalog: domains, skills, level rules, programs, questions          */
/* ------------------------------------------------------------------ */

function offsetDate(now: Date, days: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Seeds the demo catalog (domains → skills → level rules → programs →
 * questions) idempotently. Programs/questions are seeded only when their
 * domain exists in this catalog; dates are computed from the seed-run time
 * so deadlines always start in the future.
 */
export async function seedCatalog(
  prisma: SeedPrisma,
  logger: SeedLogger = console,
  now: Date = new Date()
): Promise<SeedCounts> {
  let counts: SeedCounts = EMPTY_COUNTS;

  // 1. Domains (keyed on unique name)
  const domainIdByName = new Map<string, string>();
  for (const domain of DEMO_DOMAINS) {
    const existing = await prisma.domain.findUnique({ where: { name: domain.name } });
    if (existing) {
      domainIdByName.set(domain.name, existing.id);
      logger.log(`  ✓ Domain already exists: ${domain.name}`);
      counts = mergeCounts(counts, { created: 0, existing: 1 });
      continue;
    }
    const created = await prisma.domain.create({
      data: { name: domain.name, description: domain.description },
    });
    domainIdByName.set(domain.name, created.id);
    logger.log(`  ✅ Created domain: ${domain.name}`);
    counts = mergeCounts(counts, { created: 1, existing: 0 });
  }

  // 2. Skills (keyed on compound unique (domainId, name))
  for (const group of DEMO_SKILLS) {
    const domainId = domainIdByName.get(group.domain);
    if (!domainId) {
      logger.warn(`  ⚠️ Skills "${group.domain}" skipped — domain missing`);
      continue;
    }
    for (const name of group.skills) {
      const existing = await prisma.skill.findUnique({
        where: { domainId_name: { domainId, name } },
      });
      if (existing) {
        logger.log(`  ✓ Skill already exists: ${name} (${group.domain})`);
        counts = mergeCounts(counts, { created: 0, existing: 1 });
        continue;
      }
      await prisma.skill.create({ data: { name, domainId } });
      logger.log(`  ✅ Created skill: ${name} (${group.domain})`);
      counts = mergeCounts(counts, { created: 1, existing: 0 });
    }
  }

  // 3. Level rules — one per (level, domain); a LevelRuleSkillMinimum row is
  //    created for EVERY skill of that domain (mirrors the historical 66 rows).
  for (const rule of DEMO_LEVEL_RULES) {
    const domainId = domainIdByName.get(rule.domain);
    if (!domainId) {
      logger.warn(`  ⚠️ Level rule ${rule.level}/${rule.domain} skipped — domain missing`);
      continue;
    }
    let existingRule = await prisma.levelRule.findFirst({
      where: { level: rule.level, domainId },
    });
    if (!existingRule) {
      existingRule = await prisma.levelRule.create({
        data: { level: rule.level, domainId },
      });
      logger.log(`  ✅ Created level rule: ${rule.level} / ${rule.domain}`);
      counts = mergeCounts(counts, { created: 1, existing: 0 });
    } else {
      logger.log(`  ✓ Level rule already exists: ${rule.level} / ${rule.domain}`);
      counts = mergeCounts(counts, { created: 0, existing: 1 });
    }

    const skills = DEMO_SKILLS.find((s) => s.domain === rule.domain)?.skills ?? [];
    for (const skillName of skills) {
      const skill = await prisma.skill.findUnique({
        where: { domainId_name: { domainId, name: skillName } },
      });
      if (!skill) {
        logger.warn(
          `  ⚠️ Skill minimum for "${skillName}" (${rule.domain}) skipped — skill missing`
        );
        continue;
      }
      const existingMinimum = await prisma.levelRuleSkillMinimum.findUnique({
        where: { levelRuleId_skillId: { levelRuleId: existingRule.id, skillId: skill.id } },
      });
      if (existingMinimum) {
        counts = mergeCounts(counts, { created: 0, existing: 1 });
        continue;
      }
      await prisma.levelRuleSkillMinimum.create({
        data: {
          levelRuleId: existingRule.id,
          skillId: skill.id,
          minimumScore: rule.minimumScore,
        },
      });
      counts = mergeCounts(counts, { created: 1, existing: 0 });
    }
  }

  // 4. Demo programs (keyed on (title, domainId); no DB unique — single-process)
  for (const program of DEMO_PROGRAMS) {
    const domainId = domainIdByName.get(program.domain);
    if (!domainId) {
      logger.warn(`  ⚠️ Program "${program.title}" skipped — domain missing`);
      continue;
    }
    const existing = await prisma.program.findFirst({
      where: { title: program.title, domainId },
    });
    if (existing) {
      logger.log(`  ✓ Program already exists: ${program.title}`);
      counts = mergeCounts(counts, { created: 0, existing: 1 });
      continue;
    }
    await prisma.program.create({
      data: {
        title: program.title,
        domainId,
        durationWeeks: program.durationWeeks,
        level: program.level,
        seats: program.seats,
        applicationDeadline: offsetDate(now, program.applicationDeadlineOffsetDays),
        startDate: offsetDate(now, program.startDateOffsetDays),
        status: ProgramStatus.OPEN, // OPEN so student demo workflows work immediately
      },
    });
    logger.log(`  ✅ Created program: ${program.title}`);
    counts = mergeCounts(counts, { created: 1, existing: 0 });
  }

  // 5. Demo assessment questions (keyed on (text, domainId); no DB unique —
  //    single-process). correctOption is server-side data only (NFR-DRV-001).
  for (const question of DEMO_QUESTIONS) {
    const domainId = domainIdByName.get(question.domain);
    if (!domainId) {
      logger.warn(`  ⚠️ Question "${question.text.slice(0, 40)}…" skipped — domain missing`);
      continue;
    }
    const existing = await prisma.assessmentQuestion.findFirst({
      where: { text: question.text, domainId },
    });
    if (existing) {
      logger.log(`  ✓ Question already exists: ${question.text.slice(0, 40)}…`);
      counts = mergeCounts(counts, { created: 0, existing: 1 });
      continue;
    }
    const skill = await prisma.skill.findUnique({
      where: { domainId_name: { domainId, name: question.skill } },
    });
    if (!skill) {
      logger.warn(`  ⚠️ Question "${question.text.slice(0, 40)}…" skipped — skill "${question.skill}" missing`);
      continue;
    }
    await prisma.assessmentQuestion.create({
      data: {
        text: question.text,
        options: [...question.options],
        correctOption: question.correctOption,
        domainId,
        skillId: skill.id,
      },
    });
    logger.log(`  ✅ Created question: ${question.text.slice(0, 40)}…`);
    counts = mergeCounts(counts, { created: 1, existing: 0 });
  }

  return counts;
}

/** Total number of catalog rows a single fresh seed must create. */
export function expectedCatalogCounts(): {
  domains: number;
  skills: number;
  levelRules: number;
  levelRuleSkillMinimums: number;
  programs: number;
  questions: number;
} {
  const skills = DEMO_SKILLS.reduce((sum, g) => sum + g.skills.length, 0);
  const levelRuleSkillMinimums = DEMO_LEVEL_RULES.reduce((sum, rule) => {
    const group = DEMO_SKILLS.find((s) => s.domain === rule.domain);
    return sum + (group?.skills.length ?? 0);
  }, 0);
  return {
    domains: DEMO_DOMAINS.length,
    skills,
    levelRules: DEMO_LEVEL_RULES.length,
    levelRuleSkillMinimums,
    programs: DEMO_PROGRAMS.length,
    questions: DEMO_QUESTIONS.length,
  };
}
