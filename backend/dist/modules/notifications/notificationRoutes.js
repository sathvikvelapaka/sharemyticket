"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
exports.notificationRouter = (0, express_1.Router)();
// GET /api/v1/notifications
exports.notificationRouter.get('/', auth_1.authenticate, (req, res) => {
    const notifications = database_1.db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
    res.json({ notifications });
});
// PATCH /api/v1/notifications/:id/read
exports.notificationRouter.patch('/:id/read', auth_1.authenticate, (req, res) => {
    database_1.db.prepare(`
    UPDATE notifications
    SET read_status = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);
    res.json({ message: 'Notification marked as read' });
});
// POST /api/v1/notifications/mark-all-read
exports.notificationRouter.post('/mark-all-read', auth_1.authenticate, (req, res) => {
    database_1.db.prepare(`
    UPDATE notifications
    SET read_status = 1
    WHERE user_id = ?
  `).run(req.user.id);
    res.json({ message: 'All notifications marked as read' });
});
