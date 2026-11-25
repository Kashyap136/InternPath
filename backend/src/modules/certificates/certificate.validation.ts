import { z } from 'zod';

const cuid = z.string().cuid();

export const issueCertificateSchema = z.object({
  body: z.object({
    internshipId: cuid,
    type: z.enum(['COMPLETION', 'APPRECIATION']).default('COMPLETION'),
    remarks: z.string().max(1000).optional(),
  }),
});

export const issuePendingSchema = z.object({
  body: z.object({
    includeAppreciation: z.boolean().default(true),
  }),
});

export const certificateIdParams = z.object({
  params: z.object({ id: cuid }),
});

export const revokeCertificateSchema = z.object({
  params: z.object({ id: cuid }),
  body: z.object({
    reason: z.string().min(5, 'A revocation reason is mandatory').max(1000),
  }),
});

export const verifyParams = z.object({
  params: z.object({
    certificateNumber: z.string().trim().min(6).max(40),
  }),
});

export const listCertificatesQuery = z.object({
  query: z.object({
    type: z.enum(['COMPLETION', 'APPRECIATION']).optional(),
    status: z.enum(['VALID', 'REVOKED']).optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
