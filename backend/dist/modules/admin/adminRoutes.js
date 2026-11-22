"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
exports.adminRouter = (0, express_1.Router)();
// Enforce admin role for all routes in this router
exports.adminRouter.use(auth_1.authenticate, (0, auth_1.requireRole)(['admin']));
// GET /api/v1/admin/users
exports.adminRouter.get('/users', (req, res) => {
    const users = database_1.db.prepare(`
    SELECT id, full_name, email, phone, role, email_verified, phone_verified, account_status, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
    res.json({ users });
});
// POST /api/v1/admin/users/:id/suspend
exports.adminRouter.post('/users/:id/suspend', (req, res) => {
    const userId = req.params.id;
    const { reason = 'Suspended for security or fraud review.' } = req.body;
    database_1.db.prepare(`
    UPDATE users
    SET account_status = 'suspended', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);
    // Revoke active sessions for security
    database_1.db.prepare(`
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(userId);
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'ADMIN_SUSPENDED_USER',
        resourceType: 'user',
        resourceId: String(userId),
        outcome: 'SUCCESS',
        details: { reason },
    });
    res.json({ message: 'User suspended successfully and active sessions revoked.' });
});
// POST /api/v1/admin/users/:id/activate
exports.adminRouter.post('/users/:id/activate', (req, res) => {
    const userId = req.params.id;
    database_1.db.prepare(`
    UPDATE users
    SET account_status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'ADMIN_ACTIVATED_USER',
        resourceType: 'user',
        resourceId: String(userId),
        outcome: 'SUCCESS',
    });
    res.json({ message: 'User activated successfully.' });
});
// GET /api/v1/admin/fraud-alerts
exports.adminRouter.get('/fraud-alerts', (req, res) => {
    const alerts = database_1.db.prepare(`
    SELECT fa.*, u.full_name as user_name, u.email as user_email
    FROM fraud_alerts fa
    JOIN users u ON fa.user_id = u.id
    ORDER BY fa.created_at DESC
  `).all();
    res.json({ alerts });
});
// POST /api/v1/admin/fraud-alerts/:id/review
exports.adminRouter.post('/fraud-alerts/:id/review', (req, res) => {
    const alertId = req.params.id;
    const { status = 'reviewed' } = req.body;
    database_1.db.prepare(`
    UPDATE fraud_alerts
    SET review_status = ?
    WHERE id = ?
  `).run(status, alertId);
    res.json({ message: 'Fraud alert status updated.' });
});
// GET /api/v1/admin/disputes
exports.adminRouter.get('/disputes', (req, res) => {
    const disputes = database_1.db.prepare(`
    SELECT d.*, u.full_name as raised_by_name, tx.buyer_id, tx.seller_id, tx.total_amount, tx.transaction_status
    FROM disputes d
    JOIN users u ON d.raised_by = u.id
    JOIN transactions tx ON d.transaction_id = tx.id
    ORDER BY d.created_at DESC
  `).all();
    res.json({ disputes });
});
// PATCH /api/v1/admin/disputes/:id (Admin resolves dispute)
exports.adminRouter.patch('/disputes/:id', (req, res) => {
    const disputeId = req.params.id;
    const { decision, adminNotes } = req.body; // 'resolved_refund' | 'resolved_seller_paid' | 'rejected'
    const dispute = database_1.db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeId);
    if (!dispute) {
        res.status(404).json({ error: 'Dispute not found.' });
        return;
    }
    const resolveDispute = database_1.db.transaction(() => {
        // 1. Update dispute record
        database_1.db.prepare(`
      UPDATE disputes
      SET dispute_status = ?, admin_decision = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, adminNotes || `Admin decision: ${decision}`, disputeId);
        // 2. Take appropriate transactional action
        if (decision === 'resolved_refund') {
            const refundId = (0, uuid_1.v4)();
            const gatewayRefundRef = `rfnd_${(0, uuid_1.v4)().substring(0, 10)}`;
            // Record refund
            database_1.db.prepare(`
        INSERT INTO refunds (id, transaction_id, gateway_refund_reference, refund_amount, refund_status)
        VALUES (?, ?, ?, (SELECT total_amount FROM transactions WHERE id = ?), 'processed')
      `).run(refundId, dispute.transaction_id, gatewayRefundRef, dispute.transaction_id);
            // Update payment to refunded
            database_1.db.prepare(`
        UPDATE payments
        SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(dispute.transaction_id);
            // Update transaction status
            database_1.db.prepare(`
        UPDATE transactions
        SET transaction_status = 'refunded'
        WHERE id = ?
      `).run(dispute.transaction_id);
            // Notify parties
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, (SELECT buyer_id FROM transactions WHERE id = ?), 'REFUND_PROCESSED', 'Your dispute was resolved. A full refund has been credited via the payment gateway.')
      `).run((0, uuid_1.v4)(), dispute.transaction_id);
        }
        else if (decision === 'resolved_seller_paid') {
            database_1.db.prepare(`
        UPDATE payments
        SET payment_status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(dispute.transaction_id);
            database_1.db.prepare(`
        UPDATE transactions
        SET transaction_status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(dispute.transaction_id);
        }
        (0, audit_1.logAuditEvent)({
            actorId: req.user.id,
            action: 'ADMIN_RESOLVED_DISPUTE',
            resourceType: 'dispute',
            resourceId: String(disputeId),
            outcome: 'SUCCESS',
            details: { decision, transactionId: dispute.transaction_id, notes: adminNotes },
        });
    });
    resolveDispute();
    res.json({ message: `Dispute resolved as ${decision}.` });
});
// GET /api/v1/admin/audit-logs
exports.adminRouter.get('/audit-logs', (req, res) => {
    const logs = database_1.db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT 100
  `).all();
    res.json({ logs });
});
// GET /api/v1/admin/transactions
exports.adminRouter.get('/transactions', (req, res) => {
    const transactions = database_1.db.prepare(`
    SELECT 
      tx.*, 
      b.full_name as buyer_name, b.email as buyer_email,
      s.full_name as seller_name, s.email as seller_email,
      e.event_name, v.venue_name,
      p.payment_status, p.gateway_order_id, p.gateway_payment_id,
      tr.transfer_status, tr.provider_transfer_reference
    FROM transactions tx
    JOIN users b ON tx.buyer_id = b.id
    JOIN users s ON tx.seller_id = s.id
    JOIN listings l ON tx.listing_id = l.id
    JOIN tickets tk ON l.ticket_id = tk.id
    JOIN events e ON tk.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    LEFT JOIN payments p ON p.transaction_id = tx.id
    LEFT JOIN transfers tr ON tr.transaction_id = tx.id
    ORDER BY tx.created_at DESC
  `).all();
    res.json({ transactions });
});
