"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disputeRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
exports.disputeRouter = (0, express_1.Router)();
const DisputeSchema = zod_1.z.object({
    transactionId: zod_1.z.string(),
    disputeCategory: zod_1.z.string(),
    description: zod_1.z.string().min(10),
});
// POST /api/v1/disputes (User raises dispute)
exports.disputeRouter.post('/', auth_1.authenticate, (req, res) => {
    try {
        const data = DisputeSchema.parse(req.body);
        const userId = req.user.id;
        const tx = database_1.db.prepare('SELECT * FROM transactions WHERE id = ?').get(data.transactionId);
        if (!tx) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }
        if (tx.buyer_id !== userId && tx.seller_id !== userId && req.user.role !== 'admin') {
            res.status(403).json({ error: 'Unauthorized: You are not a participant in this transaction.' });
            return;
        }
        const disputeId = (0, uuid_1.v4)();
        database_1.db.prepare(`
      INSERT INTO disputes (id, transaction_id, raised_by, dispute_category, description, dispute_status)
      VALUES (?, ?, ?, ?, ?, 'opened')
    `).run(disputeId, data.transactionId, userId, data.disputeCategory, data.description);
        // Update transaction state to disputed
        database_1.db.prepare(`
      UPDATE transactions
      SET transaction_status = 'disputed'
      WHERE id = ?
    `).run(data.transactionId);
        // Alert admin and opposing party
        const counterpartyId = (userId === tx.buyer_id) ? tx.seller_id : tx.buyer_id;
        database_1.db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'DISPUTE_RAISED', ?)
    `).run((0, uuid_1.v4)(), counterpartyId, `A dispute was raised regarding transaction #${tx.id.substring(0, 8)}. Platform administration is reviewing.`);
        (0, audit_1.logAuditEvent)({
            actorId: userId,
            action: 'DISPUTE_OPENED',
            resourceType: 'dispute',
            resourceId: disputeId,
            outcome: 'FLAGGED',
            details: { transactionId: data.transactionId, category: data.disputeCategory },
        });
        res.status(201).json({
            message: 'Dispute opened successfully. An administrator has been notified to investigate.',
            disputeId,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Validation error', details: err.issues || err.errors });
            return;
        }
        res.status(500).json({ error: 'Failed to open dispute', message: err.message });
    }
});
// GET /api/v1/disputes/:id
exports.disputeRouter.get('/:id', auth_1.authenticate, (req, res) => {
    const dispute = database_1.db.prepare(`
    SELECT d.*, u.full_name as raised_by_name, tx.buyer_id, tx.seller_id, tx.total_amount
    FROM disputes d
    JOIN users u ON d.raised_by = u.id
    JOIN transactions tx ON d.transaction_id = tx.id
    WHERE d.id = ?
  `).get(req.params.id);
    if (!dispute) {
        res.status(404).json({ error: 'Dispute not found.' });
        return;
    }
    res.json({ dispute });
});
