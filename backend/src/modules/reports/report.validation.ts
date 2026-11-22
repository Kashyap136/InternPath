// Report Validation (Sprint 6 — FR-CAND-094-097)
import { z } from 'zod';

const cuid = z.string().cuid();

export const createReportSchema = z.object({
  body: z.object({
    category: z.enum([
      'PAYMENT_REQUEST',
      'FAKE_PROJECT',
      'MISLEADING_INTERNSHIP',
      'MENTOR_MISCONDUCT',
      'UNREASONABLE_WORKLOAD',
      'SUSPICIOUS_BEHAVIOUR',
      'EVALUATION_DISPUTE',
      'OTHER',
    ]),
    description: z.string().min(20, 'Describe the issue in at least 20 characters').max(5000),
    evidenceLinks: z.array(z.string().url('Evidence links must be valid URLs')).max(10).default([]),
    targetUserId: cuid.optional(),
    targetProjectId: cuid.optional(),
    targetInternshipId: cuid.optional(),
  }),
});

export const listReportsQuery = z.object({
  query: z.object({
    status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']).optional(),
    category: z
      .enum([
        'PAYMENT_REQUEST',
        'FAKE_PROJECT',
        'MISLEADING_INTERNSHIP',
        'MENTOR_MISCONDUCT',
        'UNREASONABLE_WORKLOAD',
        'SUSPICIOUS_BEHAVIOUR',
        'EVALUATION_DISPUTE',
        'OTHER',
      ])
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const reportStatusSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'REJECTED']),
    resolutionNote: z.string().max(2000).optional(),
  }),
});
