// Domain Controller
// HTTP handlers for domain management

import type { Request, Response } from 'express';
import { domainService } from './domain.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import type { CreateDomainInput, UpdateDomainInput } from './domain.validation';

export const listDomains = asyncHandler(async (_req: Request, res: Response) => {
  const domains = await domainService.listActive();
  res.json({ data: domains });
});

export const listAllDomains = asyncHandler(async (_req: Request, res: Response) => {
  const domains = await domainService.listAll();
  res.json({ data: domains });
});

export const getDomain = asyncHandler(async (req: Request, res: Response) => {
  const domain = await domainService.getById(req.params.id as string);
  res.json({ data: domain });
});

export const createDomain = asyncHandler(async (req: Request, res: Response) => {
  const domain = await domainService.create(req.body as CreateDomainInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.DOMAIN_CREATED,
    entityType: 'Domain',
    entityId: domain.id,
    newValue: { id: domain.id, name: domain.name, isActive: domain.isActive },
  });
  res.status(201).json({ data: domain, message: 'Domain created' });
});

export const updateDomain = asyncHandler(async (req: Request, res: Response) => {
  const domain = await domainService.update(req.params.id as string, req.body as UpdateDomainInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.DOMAIN_UPDATED,
    entityType: 'Domain',
    entityId: domain.id,
    newValue: { id: domain.id, name: domain.name, isActive: domain.isActive },
  });
  res.json({ data: domain, message: 'Domain updated' });
});

export const deactivateDomain = asyncHandler(async (req: Request, res: Response) => {
  const domain = await domainService.deactivate(req.params.id as string);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.DOMAIN_DEACTIVATED,
    entityType: 'Domain',
    entityId: domain.id,
    newValue: { id: domain.id, name: domain.name, isActive: false },
  });
  res.json({ message: 'Domain deactivated' });
});
