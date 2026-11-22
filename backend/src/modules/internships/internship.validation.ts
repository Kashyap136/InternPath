// Internship Validation (Sprint 3/4 — FR-CAND-047-066, 080-084)
import { z } from 'zod';

const cuid = z.string().cuid();
export const listInternshipsQuery = z.object({
  query: z.object({
    status: z.enum(['PENDING_START', 'ACTIVE', 'UNDER_EVALUATION', 'COMPLETED', 'WITHDRAWN', 'TERMINATED']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

/** Admin oversight (Phase 12 3.9): delayed = past expected completion, still running. */
export const adminListInternshipsQuery = listInternshipsQuery.extend({
  query: listInternshipsQuery.shape.query.extend({
    delayed: z.enum(['true', 'false']).optional(),
  }),
});

export const internshipIdParams = z.object({ params: z.object({ id: cuid }) });

export const withdrawSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({ reason: z.string().min(5, 'A withdrawal reason is required').max(1000) }),
});

// ---- Task operations ----

export const internshipTaskParams = z.object({
  params: z.object({ id: cuid, taskId: cuid }),
});

export const internTaskIdParams = z.object({
  params: z.object({ internTaskId: cuid }),
});

export const reopenTaskSchema = z.object({
  params: z.object({ internTaskId: cuid }),
  body: z.object({
    reason: z.string().min(5, 'A justification is mandatory to reopen an approved task').max(1000),
  }),
});

export const submissionSchema = z.object({
  params: z.object({ id: cuid, taskId: cuid }),
  body: z.object({
    repositoryUrl: z.string().url('Repository URL must be a valid URL').optional(),
    commitRef: z.string().max(100).optional(),
    documentUrl: z.string().url('Document URL must be a valid URL').optional(),
    liveDemoUrl: z.string().url('Live demo URL must be a valid URL').optional(),
    notes: z.string().max(4000).optional(),
    originalityDeclared: z.literal(true, {
      message: 'You must declare the work as your own original work',
    }),
  }),
});

export const reviewSchema = z.object({
  params: z.object({ internTaskId: cuid }),
  body: z.object({
    decision: z.enum(['APPROVED', 'CHANGES_REQUESTED']),
    comment: z.string().min(5, 'Review comment is required (mandatory for change requests)').max(4000),
  }),
});

export const changeDueDateSchema = z.object({
  params: z.object({ internTaskId: cuid }),
  body: z.object({
    dueDate: z.coerce.date(),
    reason: z.string().min(5, 'A reason for the due-date change is required').max(500),
  }),
});

export const replySchema = z.object({
  params: z.object({ internTaskId: cuid }),
  body: z.object({ reply: z.string().min(1).max(2000) }),
});

// ---- Admin: assignment & lifecycle ----

export const assignMentorSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    mentorId: cuid,
    // mandatory only on reassignment (enforced in the service)
    reason: z.string().max(500).optional(),
  }),
});

export const assignProjectSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({ projectId: cuid }),
});

export const extendSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    days: z.number().int().min(1, 'Extension must be at least 1 day'),
    reason: z.string().min(5, 'A documented reason is required for an extension').max(1000),
  }),
});

export const terminateSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({ reason: z.string().min(5, 'A termination reason is mandatory').max(1000) }),
});

export const completeSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    checklistConfirmed: z.literal(true, {
      message: 'You must confirm the completion checklist before marking the internship COMPLETED',
    }),
  }),
});

// ---- Evaluation (FR-CAND-074-077) ----

export const evaluationSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    criterionScores: z
      .array(z.object({ criterionId: cuid, score: z.number().min(0).max(10) }))
      .min(1, 'Score every rubric criterion'),
    recommendation: z.enum(['COMPLETE', 'COMPLETE_WITH_APPRECIATION', 'NOT_COMPLETE']),
    remarks: z.string().max(4000).optional(),
  }),
});

export const reEvaluationSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({ reason: z.string().min(10, 'A detailed reason is required to approve a re-evaluation').max(1000) }),
});
