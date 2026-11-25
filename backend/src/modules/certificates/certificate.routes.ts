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
  issuePendingCertificates,
  listEligibleInternships,
  revokeCertificate,
  downloadCertificate,
  verifyCertificate,
} from './certificate.controller';
import {
  issueCertificateSchema,
  issuePendingSchema,
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
adminRouter.get('/eligible', asyncHandler(listEligibleInternships));
adminRouter.post('/issue', validate(issueCertificateSchema), asyncHandler(issueCertificate));
adminRouter.post('/issue-pending', validate(issuePendingSchema), asyncHandler(issuePendingCertificates));
adminRouter.post('/:id/revoke', validate(revokeCertificateSchema), asyncHandler(revokeCertificate));
adminRouter.get('/:id/download', validate(certificateIdParams), asyncHandler(downloadCertificate));

const publicRouter: Router = Router();

publicRouter.get(
  '/:certificateNumber',
  createVerificationRateLimiter(),
  validate(verifyParams),
  asyncHandler(verifyCertificate)
);

export { studentRouter as certificateRoutes, adminRouter as certificateAdminRouter, publicRouter as certificateVerifyRouter };
