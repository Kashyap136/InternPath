import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { certificateService } from './certificate.service';

export const getCertificateStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await certificateService.statusForStudent(req.user!.id, req.params.id as string);
  res.json(result);
});

export const listMyCertificates = asyncHandler(async (req: Request, res: Response) => {
  const result = await certificateService.listMine(req.user!.id, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const adminListCertificates = asyncHandler(async (req: Request, res: Response) => {
  const result = await certificateService.adminList({
    type: req.query.type as string | undefined,
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

/** COMPLETED internships still awaiting a certificate (incl. older completions). */
export const listEligibleInternships = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await certificateService.eligible());
});

export const issueCertificate = asyncHandler(async (req: Request, res: Response) => {
  const { internshipId, type, remarks } = req.body as {
    internshipId: string;
    type: 'COMPLETION' | 'APPRECIATION';
    remarks?: string;
  };
  const certificate = await certificateService.issue(req.user!.id, internshipId, type, remarks);
  res.status(201).json({ data: certificate, message: `Certificate ${certificate.certificateNumber} issued` });
});

/** Backfill: issue every pending certificate in one action. */
export const issuePendingCertificates = asyncHandler(async (req: Request, res: Response) => {
  const { includeAppreciation } = req.body as { includeAppreciation: boolean };
  const result = await certificateService.issuePending(req.user!.id, includeAppreciation);
  res.json({
    data: result,
    message: `${result.issued.length} certificate(s) issued${result.failed.length ? `, ${result.failed.length} failed` : ''}`,
  });
});

export const revokeCertificate = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body as { reason: string };
  const result = await certificateService.revoke(req.user!.id, req.params.id as string, reason);
  res.json({ data: result, message: 'Certificate revoked' });
});

/** FR-090: student downloads own certificate (admins may download any). */
export const downloadCertificate = asyncHandler(async (req: Request, res: Response) => {
  await certificateService.downloadFor(req.user!.id, req.user!.role, req.params.id as string, res);
});

/** FR-091: PUBLIC verification — no authentication required. */
export const verifyCertificate = asyncHandler(async (req: Request, res: Response) => {
  const result = await certificateService.verify(req.params.certificateNumber as string);
  if (!result.found) {
    res.json({ data: { status: 'NOT_FOUND', certificateNumber: result.certificateNumber } });
    return;
  }
  res.json({
    data: { status: result.data.status, certificateNumber: result.data.certificateNumber, certificate: result.data },
  });
});
