// Project Validation (Sprint 3 — FR-CAND-037-046)
import { z } from 'zod';

export const PROJECT_SOURCE_TYPES = ['MENTOR_CREATED', 'SIMULATED', 'OPEN_SOURCE', 'COMMUNITY', 'CLIENT'] as const;
const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE'] as const;

const cuidOrEmpty = z.string().cuid();

/** FR-CAND-039: source-specific details required before review submission. */
export function validateSourceDetails(data: {
  sourceType: (typeof PROJECT_SOURCE_TYPES)[number];
  organizationName?: string;
  consentEvidenceRef?: string;
  upstreamRepoUrl?: string;
  licence?: string;
  contributionGuidelineRef?: string;
}): string | null {
  if (data.sourceType === 'CLIENT' || data.sourceType === 'COMMUNITY') {
    if (!data.organizationName?.trim()) return 'Organization name is required for CLIENT and COMMUNITY projects';
    if (!data.consentEvidenceRef?.trim()) return 'A reference to recorded consent evidence is required for CLIENT and COMMUNITY projects';
    return null;
  }
  if (data.sourceType === 'OPEN_SOURCE') {
    if (!data.upstreamRepoUrl?.trim()) return 'Upstream repository URL is required for OPEN_SOURCE projects';
    if (!data.licence?.trim()) return 'Licence is required for OPEN_SOURCE projects';
    if (!data.contributionGuidelineRef?.trim()) return 'Contribution guideline reference is required for OPEN_SOURCE projects';
    return null;
  }
  return null;
}

const baseProjectFields = {
  title: z.string().min(5, 'Title must be at least 5 characters').max(150),
  sourceType: z.enum(PROJECT_SOURCE_TYPES),
  domainId: cuidOrEmpty,
  difficulty: z.enum(DIFFICULTIES),
  durationWeeks: z.number().int().min(2, 'Minimum duration is 2 weeks').max(26, 'Maximum duration is 26 weeks'),
  requiredSkills: z.array(z.string().min(1).max(60)).max(20),
  problemStatement: z.string().min(30, 'Problem statement must be at least 30 characters').max(4000),
  objectives: z.string().min(20).max(4000),
  requirements: z.string().min(20).max(6000),
  expectedDeliverables: z.string().min(20).max(4000),
  evaluationCriteria: z.string().min(20).max(4000),
  submissionGuidelines: z.string().min(20).max(4000),
  // Source-specific optional fields (completed validation happens in the service)
  organizationName: z.string().max(150).optional(),
  consentEvidenceRef: z.string().max(300).optional(),
  consentConfirmedBy: z.string().max(150).optional(),
  upstreamRepoUrl: z.string().url('Upstream repository URL must be valid').optional(),
  licence: z.string().max(100).optional(),
  contributionGuidelineRef: z.string().max(300).optional(),
};

const baseProjectSchema = z.object(baseProjectFields);

export const createProjectSchema = z.object({ body: baseProjectSchema });

export const updateProjectSchema = z.object({
  params: z.object({ id: cuidOrEmpty }),
  body: baseProjectSchema.partial(),
});

export const projectIdParams = z.object({ params: z.object({ id: cuidOrEmpty }) });

export const projectReviewSchema = z.object({
  params: z.object({ id: cuidOrEmpty }),
  body: z.object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    comments: z
      .string()
      .max(2000)
      .optional()
      .refine((v) => v === undefined || v.trim().length > 0, 'Comments cannot be empty'),
  }),
});

export const listProjectsQuery = z.object({
  query: z.object({
    domainId: cuidOrEmpty.optional(),
    sourceType: z.enum(PROJECT_SOURCE_TYPES).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    minDurationWeeks: z.coerce.number().int().positive().optional(),
    maxDurationWeeks: z.coerce.number().int().positive().optional(),
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    mine: z.coerce.boolean().optional(),
  }),
});

// ---- Milestones & tasks (FR-CAND-052-055) — draft projects only ----

export const createMilestoneSchema = z.object({
  params: z.object({ projectId: cuidOrEmpty }),
  body: z.object({
    title: z.string().min(3).max(150),
    description: z.string().max(2000).optional(),
    order: z.number().int().min(1).max(50),
    isRequired: z.boolean().default(true),
  }),
});

export const updateMilestoneSchema = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty }),
  body: z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().max(2000).optional(),
    order: z.number().int().min(1).max(50).optional(),
    isRequired: z.boolean().optional(),
  }),
});

export const milestoneParams = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty }),
});

export const createTaskSchema = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty }),
  body: z.object({
    title: z.string().min(3).max(150),
    description: z.string().max(3000).optional(),
    acceptanceCriteria: z.string().max(3000).optional(),
    isMandatory: z.boolean().default(true),
    evidenceTypes: z.array(z.enum(['CODE', 'DOCUMENT', 'LIVE_DEMO'])).min(1, 'At least one evidence type is required'),
    dueOffsetDays: z.number().int().min(1).max(365),
    order: z.number().int().min(1).max(100),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty, taskId: cuidOrEmpty }),
  body: z.object({
    title: z.string().min(3).max(150).optional(),
    description: z.string().max(3000).optional(),
    acceptanceCriteria: z.string().max(3000).optional(),
    isMandatory: z.boolean().optional(),
    evidenceTypes: z.array(z.enum(['CODE', 'DOCUMENT', 'LIVE_DEMO'])).min(1).optional(),
    dueOffsetDays: z.number().int().min(1).max(365).optional(),
    order: z.number().int().min(1).max(100).optional(),
  }),
});

export const taskParams = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty, taskId: cuidOrEmpty }),
});

export const createDependencySchema = z.object({
  params: z.object({ projectId: cuidOrEmpty, milestoneId: cuidOrEmpty, taskId: cuidOrEmpty }),
  body: z.object({ prerequisiteTaskId: cuidOrEmpty }),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>['body'];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>['body'];
export type ListProjectsQuery = z.infer<typeof listProjectsQuery>['query'];
