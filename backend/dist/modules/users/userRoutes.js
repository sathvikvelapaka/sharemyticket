"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRouter = void 0;
const express_1 = require("express");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
exports.userRouter = (0, express_1.Router)();
// GET /api/v1/users/me
exports.userRouter.get('/me', auth_1.authenticate, (req, res) => {
    const user = database_1.db.prepare(`
    SELECT id, full_name, email, phone, role, email_verified, phone_verified, account_status, created_at
    FROM users
    WHERE id = ?
  `).get(req.user.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    // Get completed transaction count and average rating
    const stats = database_1.db.prepare(`
    SELECT 
      COUNT(DISTINCT t.id) as completedTransactions,
      AVG(r.rating) as avgRating,
      COUNT(r.id) as totalReviews
    FROM transactions t
    LEFT JOIN ratings r ON r.reviewee_id = ?
    WHERE (t.buyer_id = ? OR t.seller_id = ?) AND t.transaction_status = 'completed'
  `).get(req.user.id, req.user.id, req.user.id);
    res.json({
        user,
        stats: {
            completedTransactions: stats?.completedTransactions || 0,
            avgRating: stats?.avgRating ? Number(stats.avgRating.toFixed(1)) : 5.0,
            totalReviews: stats?.totalReviews || 0,
        },
    });
});
// GET /api/v1/users/:id/public-profile
exports.userRouter.get('/:id/public-profile', (req, res) => {
    const user = database_1.db.prepare(`
    SELECT id, full_name, role, email_verified, phone_verified, account_status, created_at
    FROM users
    WHERE id = ?
  `).get(req.params.id);
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const ratings = database_1.db.prepare(`
    SELECT 
      COUNT(r.id) as reviewCount,
      AVG(r.rating) as avgRating,
      AVG(r.communication_rating) as avgComm,
      AVG(r.timely_transfer_rating) as avgTransfer,
      AVG(r.listing_accuracy_rating) as avgAccuracy
    FROM ratings r
    WHERE r.reviewee_id = ?
  `).get(req.params.id);
    res.json({
        profile: {
            id: user.id,
            fullName: user.full_name,
            role: user.role,
            verified: Boolean(user.email_verified && user.phone_verified),
            memberSince: user.created_at,
            reviewsCount: ratings?.reviewCount || 0,
            avgRating: ratings?.avgRating ? Number(ratings.avgRating.toFixed(1)) : 5.0,
            categoryScores: {
                communication: ratings?.avgComm ? Number(ratings.avgComm.toFixed(1)) : 5.0,
                timelyTransfer: ratings?.avgTransfer ? Number(ratings.avgTransfer.toFixed(1)) : 5.0,
                listingAccuracy: ratings?.avgAccuracy ? Number(ratings.avgAccuracy.toFixed(1)) : 5.0,
            },
        },
    });
});
// GET /api/v1/users/me/sessions
exports.userRouter.get('/me/sessions', auth_1.authenticate, (req, res) => {
    const sessions = database_1.db.prepare(`
    SELECT id, device_information, created_at, expires_at, revoked_at
    FROM user_sessions
    WHERE user_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).all(req.user.id);
    res.json({ sessions });
});
// DELETE /api/v1/users/me/sessions/:sessionId
exports.userRouter.delete('/me/sessions/:sessionId', auth_1.authenticate, (req, res) => {
    const stmt = database_1.db.prepare(`
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);
    const result = stmt.run(req.params.sessionId, req.user.id);
    if (result.changes === 0) {
        res.status(404).json({ error: 'Session not found or already revoked' });
        return;
    }
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'SESSION_REVOKED',
        resourceType: 'session',
        resourceId: String(req.params.sessionId),
        outcome: 'SUCCESS',
    });
    res.json({ message: 'Session revoked successfully' });
});
