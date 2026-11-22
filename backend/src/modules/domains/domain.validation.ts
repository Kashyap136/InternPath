// Domain Validation
// Zod schemas for domain CRUD operations

import { z } from 'zod';

export const createDomainSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  }),
});

export const updateDomainSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const domainIdParamSchema = z.object({
  params: z.object({
    id: z.string().cuid(),
  }),
});

export type CreateDomainInput = z.infer<typeof createDomainSchema>['body'];
export type UpdateDomainInput = z.infer<typeof updateDomainSchema>['body'];
export type DomainIdParam = z.infer<typeof domainIdParamSchema>['params'];