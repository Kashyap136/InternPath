// Skill Validation
// Zod schemas for skill CRUD operations

import { z } from 'zod';

export const createSkillSchema = z.object({
  params: z.object({
    domainId: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100),
  }),
});

export const updateSkillSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
  }),
});

export const skillIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export const domainIdParamSchema = z.object({
  params: z.object({
    domainId: z.string().cuid(),
  }),
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>['body'];
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>['body'];
export type SkillIdParam = z.infer<typeof skillIdParamSchema>['params'];