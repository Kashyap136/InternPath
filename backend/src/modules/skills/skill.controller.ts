// Skill Controller
// HTTP handlers for skill management

import type { Request, Response } from 'express';
import { skillService } from './skill.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import type { CreateSkillInput, UpdateSkillInput } from './skill.validation';

export const listSkills = asyncHandler(async (req: Request, res: Response) => {
  const skills = await skillService.listByDomain(req.params.domainId as string);
  res.json({ data: skills });
});

export const getSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await skillService.getById(req.params.id as string);
  res.json({ data: skill });
});

export const createSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await skillService.create(req.params.domainId as string, req.body as CreateSkillInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.SKILL_CREATED,
    entityType: 'Skill',
    entityId: skill.id,
    newValue: { id: skill.id, name: skill.name, domainId: skill.domainId },
  });
  res.status(201).json({ data: skill, message: 'Skill created' });
});

export const updateSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await skillService.update(req.params.id as string, req.body as UpdateSkillInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.SKILL_UPDATED,
    entityType: 'Skill',
    entityId: skill.id,
    newValue: { id: skill.id, name: skill.name, domainId: skill.domainId },
  });
  res.json({ data: skill, message: 'Skill updated' });
});

export const deleteSkill = asyncHandler(async (req: Request, res: Response) => {
  const skill = await skillService.delete(req.params.id as string);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.SKILL_DELETED,
    entityType: 'Skill',
    entityId: skill.id,
    oldValue: { id: skill.id, name: skill.name, domainId: skill.domainId },
  });
  res.json({ message: 'Skill deleted' });
});
