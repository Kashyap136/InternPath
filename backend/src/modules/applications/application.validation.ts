// Application Validation
// Zod schemas for application lifecycle

import { z } from 'zod';

const applicationStatuses = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'WITHDRAWN',
] as const;

export const createApplicationSchema = z.object({
  body: z.object({
    programId: z.string().cuid(),
    statementOfInterest: z.string().max(2000).optional(),
  }),
});

export const submitApplicationSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const updateApplicationSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    statementOfInterest: z.string().max(2000).optional(),
  }),
});

export const withdrawApplicationSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
});

export const acceptApplicationSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const declineApplicationSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const adminDecisionBodySchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().min(1).max(500).optional(),
}).refine((data) => {
  if (data.status === 'REJECTED' && !data.reason) {
    return false;
  }
  return true;
}, {
  message: 'Reason required for rejection',
  path: ['reason'],
});

export const adminDecisionSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: adminDecisionBodySchema,
});

export const applicationIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const listApplicationsQuerySchema = z.object({
  query: z.object({
    status: z.enum(applicationStatuses).optional(),
    programId: z.string().cuid().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>['body'];
export type ApplicationIdParam = z.infer<typeof applicationIdParamSchema>['params'];
export type AdminDecisionInput = z.infer<typeof adminDecisionSchema>['body'];
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>['query'];