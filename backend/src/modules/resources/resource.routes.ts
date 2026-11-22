// Resource Module (Sprint 6 â€” FR-CAND-101/102)
// Mentors and administrators add learning resources as external links, linked
// to a domain, a project (source definition) or a task (source definition).
// Resources linked to a task appear on that task's detail view.
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { prisma } from '../../shared/prisma/client';
import { AppError } from '../../shared/utils/AppError';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';

// P2-04 fix (comprehensive audit 2026-11-15): URLs are restricted to
// http/https so `javascript:` (and other non-web schemes) can never be
// stored; the update body is validated with a partial schema instead of
// reaching Prisma unvalidated.
const httpUrl = z
  .string()
  .url('Resource URL must be a valid URL')
  .refine((url) => /^https?:\/\//i.test(url), 'Only http(s) URLs are allowed');

const resourceSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(150),
    type: z.enum(['ARTICLE', 'VIDEO', 'DOCUMENTATION', 'BOOK', 'COURSE', 'TUTORIAL', 'TOOL', 'OTHER']),
    url: httpUrl,
    tags: z.array(z.string().min(1).max(40)).max(10).default([]),
    domainId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    taskId: z.string().cuid().optional(),
    skillId: z.string().cuid().optional(),
  }),
});

const resourceUpdateSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: resourceSchema.shape.body.partial(),
});

const resourceIdParams = z.object({
  params: z.object({ id: z.string().cuid() }),
});

const listQuery = z.object({
  query: z.object({
    domainId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
    taskId: z.string().cuid().optional(),
    skillId: z.string().cuid().optional(),
    type: z.enum(['ARTICLE', 'VIDEO', 'DOCUMENTATION', 'BOOK', 'COURSE', 'TUTORIAL', 'TOOL', 'OTHER']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

async function createResource(req: Request, res: Response) {
  const data = req.body as z.infer<typeof resourceSchema>['body'];
  if (!data.domainId && !data.projectId && !data.taskId && !data.skillId) {
    throw new AppError('Link the resource to a domain, project, task or skill', 400, 'RESOURCE_LINK_REQUIRED');
  }
  if (data.projectId && !(await prisma.project.findUnique({ where: { id: data.projectId } }))) {
    throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
  }
  if (data.domainId && !(await prisma.domain.findUnique({ where: { id: data.domainId } }))) {
    throw new AppError('Domain not found', 404, 'DOMAIN_NOT_FOUND');
  }
  if (data.taskId && !(await prisma.task.findUnique({ where: { id: data.taskId } }))) {
    throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  }

  const resource = await prisma.resource.create({
    data: {
      title: data.title,
      type: data.type,
      url: data.url,
      tags: data.tags,
      domainId: data.domainId ?? null,
      projectId: data.projectId ?? null,
      taskId: data.taskId ?? null,
      skillId: data.skillId ?? null,
    },
  });

  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.RESOURCE_CREATED,
    entityType: 'Resource',
    entityId: resource.id,
    newValue: { title: resource.title, type: resource.type, url: resource.url },
  });

  res.status(201).json({ data: resource, message: 'Resource added' });
}

async function updateResource(req: Request, res: Response) {
  const existing = await prisma.resource.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  // P2-04: the body is now validated by resourceUpdateSchema; only the
  // editable fields pass through (link-target re-pointing is not an update
  // concern and previously allowed silently re-linking resources).
  const data = req.body as Partial<z.infer<typeof resourceSchema>['body']>;

  const resource = await prisma.resource.update({
    where: { id: req.params.id as string },
    data: {
      title: data.title,
      type: data.type,
      url: data.url,
      tags: data.tags,
    },
  });

  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.RESOURCE_UPDATED,
    entityType: 'Resource',
    entityId: resource.id,
    oldValue: { title: existing.title, url: existing.url },
    newValue: { title: resource.title, url: resource.url },
  });

  res.json({ data: resource, message: 'Resource updated' });
}

async function deleteResource(req: Request, res: Response) {
  const existing = await prisma.resource.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  await prisma.resource.delete({ where: { id: req.params.id as string } });

  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.RESOURCE_DELETED,
    entityType: 'Resource',
    entityId: req.params.id as string,
    oldValue: { title: existing.title, url: existing.url },
  });

  res.json({ data: { deleted: true }, message: 'Resource deleted' });
}

async function listResources(req: Request, res: Response) {
  const q = req.query as unknown as z.infer<typeof listQuery>['query'];
  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 50, 100);
  const where: Record<string, unknown> = {};
  if (q.domainId) where.domainId = q.domainId;
  if (q.projectId) where.projectId = q.projectId;
  if (q.taskId) where.taskId = q.taskId;
  if (q.skillId) where.skillId = q.skillId;
  if (q.type) where.type = q.type;

  const [data, total] = await Promise.all([
    prisma.resource.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.resource.count({ where }),
  ]);

  res.json({ data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } });
}

const router: Router = Router();

// Read â€” any authenticated user (students consume resources on task views)
router.get('/', authMiddleware, validate(listQuery), asyncHandler(listResources));

// Write â€” mentors and administrators (FR-101). Update/delete: P2-04 interim
// ownership control (fail-closed pending owner decision OD-10) â€” the Resource
// model has no creator column, so any-mentor edits could silently rewrite or
// delete resources authored by administrators or other mentors. Until the
// owner approves an author-or-admin policy (which needs a creator column and
// a schema change), edits and deletions are restricted to ADMIN. Creation
// stays open to mentors so the documented workflow keeps working.
router.post('/', authMiddleware, requireRole('MENTOR', 'ADMIN'), validate(resourceSchema), asyncHandler(createResource));
// PUT /:id - Update a resource (ADMIN only, pending owner decision OD-10).
// The body is validated here: the previous session defined
// `resourceUpdateSchema` but the route still validated only `params`,
// letting arbitrary bodies reach Prisma (P2-04 regression).
router.put('/:id', authMiddleware, requireRole('ADMIN'), validate(resourceUpdateSchema), asyncHandler(updateResource));
router.delete('/:id', authMiddleware, requireRole('ADMIN'), validate(resourceIdParams), asyncHandler(deleteResource));

export default router;
