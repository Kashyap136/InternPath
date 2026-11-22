// Notification Controller (FR-CAND-099)

import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { notificationService } from './notification.service';

export const listMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await notificationService.listMine(userId, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    unreadOnly: req.query.unreadOnly === 'true',
  });
  res.json(result);
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const notification = await notificationService.markRead(userId, req.params.id as string);
  res.json({ data: notification, message: 'Notification marked as read' });
});

export const markAllNotificationsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await notificationService.markAllRead(userId);
  res.json({ data: result, message: 'All notifications marked as read' });
});
