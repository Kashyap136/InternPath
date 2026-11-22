// Notification Routes (FR-CAND-099) — all authenticated, ownership enforced in service

import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { authMiddleware } from '../../shared/middleware/auth';
import { listMyNotifications, markNotificationRead, markAllNotificationsRead } from './notification.controller';

const router: Router = Router();

router.get('/', authMiddleware, asyncHandler(listMyNotifications));
router.post('/read-all', authMiddleware, asyncHandler(markAllNotificationsRead));
router.post('/:id/read', authMiddleware, asyncHandler(markNotificationRead));

export default router;
