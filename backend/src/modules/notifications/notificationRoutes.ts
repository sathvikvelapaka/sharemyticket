import { Router, Response } from 'express';
import { db } from '../../db/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';

export const notificationRouter = Router();

// GET /api/v1/notifications
notificationRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user!.id);

  res.json({ notifications });
});

// PATCH /api/v1/notifications/:id/read
notificationRouter.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  db.prepare(`
    UPDATE notifications
    SET read_status = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user!.id);

  res.json({ message: 'Notification marked as read' });
});

// POST /api/v1/notifications/mark-all-read
notificationRouter.post('/mark-all-read', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  db.prepare(`
    UPDATE notifications
    SET read_status = 1
    WHERE user_id = ?
  `).run(req.user!.id);

  res.json({ message: 'All notifications marked as read' });
});
