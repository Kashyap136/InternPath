// Certificate Routes (Sprint 5)
//
// Student surface  /api/certificates        — own certificates + download (FR-090)
// Admin surface    /api/admin/certificates  — issue (FR-087), revoke (FR-092), list
// Public surface   /api/verify/:number      — public verification, no login (FR-091);
//                                             protected only by the global rate limiter

import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { createVerificationRateLimiter } from '../../shared/middleware/security';
import {
  getCertificateStatus,
  listMyCertificates,
  adminListCertificates,
  issueCertificate,
  revokeCertificate,
  downloadCertificate,
  verifyCertificate,
} from './certificate.controller';
import {
  issueCertificateSchema,
  certificateIdParams,
  revokeCertificateSchema,
  verifyParams,
  listCertificatesQuery,
} from './certificate.validation';
import { z } from 'zod';

const studentRouter: Router = Router();

studentRouter.use(authMiddleware, requireRole('STUDENT'));
studentRouter.get('/', validate(listCertificatesQuery), asyncHandler(listMyCertificates));
// Availability indicator per internship (no issuance — BR-CAND-032)
studentRouter.get(
  '/status/:id',
  validate(z.object({ params: z.object({ id: z.string().cuid() }) })),
  asyncHandler(getCertificateStatus)
);
studentRouter.get('/:id/download', validate(certificateIdParams), asyncHandler(downloadCertificate));

const adminRouter: Router = Router();

adminRouter.use(authMiddleware, requireRole('ADMIN'));
adminRouter.get('/', validate(listCertificatesQuery), asyncHandler(adminListCertificates));
adminRouter.post('/issue', validate(issueCertificateSchema), asyncHandler(issueCertificate));
adminRouter.post('/:id/revoke', validate(revokeCertificateSchema), asyncHandler(revokeCertificate));
adminRouter.get('/:id/download', validate(certificateIdParams), asyncHandler(downloadCertificate));

const publicRouter: Router = Router();

// P1-02 (comprehensive audit 2026-11-15): NFR-CAND-005 requires a limit on
// public certificate verification too — a separate, generous read budget.
publicRouter.get(
  '/:certificateNumber',
  createVerificationRateLimiter(),
  validate(verifyParams),
  asyncHandler(verifyCertificate)
);

export { studentRouter as certificateRoutes, adminRouter as certificateAdminRouter, publicRouter as certificateVerifyRouter };
