// Report Controller + Routes (Sprint 6)
import type { Request, Response } from 'express';
import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { validate } from '../../shared/middleware/validation';
import { authMiddleware, requireRole } from '../../shared/middleware/auth';
import { reportService } from './report.service';
import { createReportSchema, listReportsQuery, reportStatusSchema } from './report.validation';

export const createReport = asyncHandler(async (req: Request, res: Response) => {
  const report = await reportService.create(req.user!.id, req.body as { category: string; description: string; evidenceLinks: string[]; targetUserId?: string; targetProjectId?: string; targetInternshipId?: string });
  res.status(201).json({ data: report, message: 'Report submitted â€” administrators have been notified' });
});

export const listMyReports = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.listMine(req.user!.id, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const adminListReports = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportService.adminList({
    status: req.query.status as string | undefined,
    category: req.query.category as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const changeReportStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status, resolutionNote } = req.body as { status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED'; resolutionNote?: string };
  const report = await reportService.changeStatus(req.user!.id, req.params.id as string, status, resolutionNote);
  res.json({ data: report, message: `Report moved to ${status}` });
});

const router: Router = Router();

// Students AND mentors may file and view their own reports (FR-094)
router.post('/', authMiddleware, requireRole('STUDENT', 'MENTOR'), validate(createReportSchema), asyncHandler(createReport));
router.get('/mine', authMiddleware, requireRole('STUDENT', 'MENTOR'), asyncHandler(listMyReports));

const adminRouter: Router = Router();

adminRouter.use(authMiddleware, requireRole('ADMIN'));
adminRouter.get('/', validate(listReportsQuery), asyncHandler(adminListReports));
adminRouter.patch('/:id/status', validate(reportStatusSchema), asyncHandler(changeReportStatus));

export default router;
export { adminRouter as reportAdminRouter };
