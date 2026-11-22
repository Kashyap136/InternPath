// Program Validation
// Zod schemas for program CRUD and status operations

import { z } from 'zod';

const programStatuses = ['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;

export const createProgramSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    domainId: z.string().cuid(),
    durationWeeks: z.number().int().positive().refine((v) => [2, 4, 6, 8].includes(v), {
      message: 'Duration must be 2, 4, 6, or 8 weeks',
    }),
    level: z.string().min(1).max(50),
    requiredLevel: z.string().max(50).optional().nullable(),
    seats: z.number().int().positive(),
    applicationDeadline: z.string().datetime(),
    startDate: z.string().datetime(),
  }),
});

export const updateProgramSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    domainId: z.string().cuid().optional(),
    durationWeeks: z.number().int().positive().refine((v) => [2, 4, 6, 8].includes(v), {
      message: 'Duration must be 2, 4, 6, or 8 weeks',
    }).optional(),
    level: z.string().min(1).max(50).optional(),
    requiredLevel: z.string().max(50).optional().nullable(),
    seats: z.number().int().positive().optional(),
    applicationDeadline: z.string().datetime().optional(),
    startDate: z.string().datetime().optional(),
  }),
});

export const changeProgramStatusSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    status: z.enum(programStatuses),
  }),
});

export const programIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const listProgramsQuerySchema = z.object({
  query: z.object({
    domainId: z.string().cuid().optional(),
    status: z.enum(programStatuses).optional(),
    level: z.string().optional(),
    durationWeeks: z.coerce.number().int().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>['body'];
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>['body'];
export type ChangeProgramStatusInput = z.infer<typeof changeProgramStatusSchema>['body'];
export type ProgramIdParam = z.infer<typeof programIdParamSchema>['params'];
export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>['query'];