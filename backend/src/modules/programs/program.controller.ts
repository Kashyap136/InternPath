// Program Controller
// HTTP handlers for program management

import type { Request, Response } from 'express';
import { programService } from './program.service';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { createAuditLog, AuditAction } from '../../shared/utils/audit';
import type { CreateProgramInput, UpdateProgramInput, ChangeProgramStatusInput } from './program.validation';

export const listPrograms = asyncHandler(async (req: Request, res: Response) => {
  // Public listing - only show OPEN programs by default.
  // BE-11 fix (audit 2026-10-20): DRAFT programs are unpublished and cannot
  // be filtered for through the public list either; admins use listAll.
  const query = req.query as Record<string, string>;
  const requestedStatus = query.status as 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED' | undefined;
  const result = await programService.list({
    ...query,
    // BE-11: DRAFT programs are unpublished — an explicit `status=DRAFT` query
    // falls back to the public default (OPEN) instead of unfiltered (which
    // leaked DRAFT rows). Admin list endpoint serves DRAFT visibility.
    status: requestedStatus === 'DRAFT' ? 'OPEN' : requestedStatus ?? 'OPEN',
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });
  res.json(result);
});

export const listAllPrograms = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const result = await programService.listAll({
    domainId: query.domainId,
    status: query.status as 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED' | undefined,
    level: query.level,
    durationWeeks: query.durationWeeks ? parseInt(query.durationWeeks) : undefined,
    page: query.page ? parseInt(query.page) : 1,
    limit: query.limit ? parseInt(query.limit) : 20,
  });
  res.json(result);
});

export const getProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await programService.getPublicById(req.params.id as string);
  res.json({ data: program });
});

// BE-04 fix: admin detail view keeps full access including DRAFT programs
// (service.getById, no public DRAFT filter).
export const getProgramAdmin = asyncHandler(async (req: Request, res: Response) => {
  const program = await programService.getById(req.params.id as string);
  res.json({ data: program });
});

export const createProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await programService.create(req.body as CreateProgramInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.PROGRAM_CREATED,
    entityType: 'Program',
    entityId: program.id,
    newValue: { id: program.id, title: (program as { title?: string }).title, domainId: program.domainId, status: program.status },
  });
  res.status(201).json({ data: program, message: 'Program created' });
});

export const updateProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await programService.update(req.params.id as string, req.body as UpdateProgramInput);
  // BE-10: admin catalog changes are audited (actor + entity)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.PROGRAM_UPDATED,
    entityType: 'Program',
    entityId: program.id,
    newValue: { id: program.id, status: program.status },
  });
  res.json({ data: program, message: 'Program updated' });
});

export const changeProgramStatus = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangeProgramStatusInput & { reason?: string };
  const program = await programService.changeStatus(req.params.id as string, body.status);
  // BE-10: status transitions are audited (actor + entity + target status)
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.PROGRAM_STATUS_CHANGED,
    entityType: 'Program',
    entityId: program.id,
    newValue: { id: program.id, status: program.status },
    reason: body.reason ?? undefined,
  });
  res.json({ data: program, message: `Program status changed to ${body.status}` });
});

export const archiveProgram = asyncHandler(async (req: Request, res: Response) => {
  const program = await programService.archive(req.params.id as string);
  // BE-10: archiving is a status transition and is audited
  await createAuditLog({
    actorId: req.user!.id,
    action: AuditAction.PROGRAM_STATUS_CHANGED,
    entityType: 'Program',
    entityId: program.id,
    newValue: { id: program.id, status: (program as { status?: string } | null)?.status ?? 'ARCHIVED' },
    reason: 'Program archived',
  });
  res.json({ message: 'Program archived' });
});
