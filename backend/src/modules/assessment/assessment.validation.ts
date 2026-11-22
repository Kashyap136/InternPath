// Assessment Validation
// Zod schemas for question bank and assessment attempts

import { z } from 'zod';

const questionBodySchema = z.object({
  text: z.string().min(1).max(1000),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctOption: z.number().int().min(0),
  skillId: z.string().cuid(),
}).refine((data) => data.correctOption < data.options.length, {
  message: 'correctOption index must be within options array',
  path: ['correctOption'],
});

const updateQuestionBodySchema = z.object({
  text: z.string().min(1).max(1000).optional(),
  options: z.array(z.string().min(1).max(200)).min(2).max(6).optional(),
  correctOption: z.number().int().min(0).optional(),
  skillId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
}).refine((data) => {
  if (data.options && data.correctOption !== undefined) {
    return data.correctOption < data.options.length;
  }
  return true;
}, {
  message: 'correctOption index must be within options array',
  path: ['correctOption'],
});

export const createQuestionSchema = z.object({
  params: z.object({
    domainId: z.string().cuid(),
  }),
  body: questionBodySchema,
});

export const updateQuestionSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: updateQuestionBodySchema,
});

export const questionIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const domainIdParamSchema = z.object({
  params: z.object({
    domainId: z.string().cuid(),
  }),
});

export const startAttemptSchema = z.object({
  params: z.object({
    domainId: z.string().cuid(),
  }),
});

export const submitAnswerSchema = z.object({
  params: z.object({
    attemptId: z.string().cuid(),
  }),
  body: z.object({
    questionId: z.string().cuid(),
    selectedOption: z.number().int().min(0),
  }),
});

export const submitAttemptSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const attemptIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>['body'];
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>['body'];
export type QuestionIdParam = z.infer<typeof questionIdParamSchema>['params'];
export type DomainIdParam = z.infer<typeof domainIdParamSchema>['params'];
export type StartAttemptInput = z.infer<typeof startAttemptSchema>['params'];
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>['body'];
export type AttemptIdParam = z.infer<typeof attemptIdParamSchema>['params'];