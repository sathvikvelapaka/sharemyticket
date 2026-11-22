import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/database';
import { authenticate, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import { logAuditEvent } from '../../utils/audit';

export const adminRouter = Router();

// Enforce admin role for all routes in this router
adminRouter.use(authenticate, requireRole(['admin']));

// GET /api/v1/admin/users
adminRouter.get('/users', (req: AuthenticatedRequest, res: Response): void => {
  const users = db.prepare(`
    SELECT id, full_name, email, phone, role, email_verified, phone_verified, account_status, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();

  res.json({ users });
});

// POST /api/v1/admin/users/:id/suspend
adminRouter.post('/users/:id/suspend', (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.params.id;
  const { reason = 'Suspended for security or fraud review.' } = req.body;

  db.prepare(`
    UPDATE users
    SET account_status = 'suspended', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);

  // Revoke active sessions for security
  db.prepare(`
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(userId);

  logAuditEvent({
    actorId: req.user!.id,
    action: 'ADMIN_SUSPENDED_USER',
    resourceType: 'user',
    resourceId: String(userId),
    outcome: 'SUCCESS',
    details: { reason },
  });

  res.json({ message: 'User suspended successfully and active sessions revoked.' });
});

// POST /api/v1/admin/users/:id/activate
adminRouter.post('/users/:id/activate', (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.params.id;

  db.prepare(`
    UPDATE users
    SET account_status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId);

  logAuditEvent({
    actorId: req.user!.id,
    action: 'ADMIN_ACTIVATED_USER',
    resourceType: 'user',
    resourceId: String(userId),
    outcome: 'SUCCESS',
  });

  res.json({ message: 'User activated successfully.' });
});

// GET /api/v1/admin/fraud-alerts
adminRouter.get('/fraud-alerts', (req: AuthenticatedRequest, res: Response): void => {
  const alerts = db.prepare(`
    SELECT fa.*, u.full_name as user_name, u.email as user_email
    FROM fraud_alerts fa
    JOIN users u ON fa.user_id = u.id
    ORDER BY fa.created_at DESC
  `).all();

  res.json({ alerts });
});

// POST /api/v1/admin/fraud-alerts/:id/review
adminRouter.post('/fraud-alerts/:id/review', (req: AuthenticatedRequest, res: Response): void => {
  const alertId = req.params.id;
  const { status = 'reviewed' } = req.body;

  db.prepare(`
    UPDATE fraud_alerts
    SET review_status = ?
    WHERE id = ?
  `).run(status, alertId);

  res.json({ message: 'Fraud alert status updated.' });
});

// GET /api/v1/admin/disputes
adminRouter.get('/disputes', (req: AuthenticatedRequest, res: Response): void => {
  const disputes = db.prepare(`
    SELECT d.*, u.full_name as raised_by_name, tx.buyer_id, tx.seller_id, tx.total_amount, tx.transaction_status
    FROM disputes d
    JOIN users u ON d.raised_by = u.id
    JOIN transactions tx ON d.transaction_id = tx.id
    ORDER BY d.created_at DESC
  `).all();

  res.json({ disputes });
});

// PATCH /api/v1/admin/disputes/:id (Admin resolves dispute)
adminRouter.patch('/disputes/:id', (req: AuthenticatedRequest, res: Response): void => {
  const disputeId = req.params.id;
  const { decision, adminNotes } = req.body; // 'resolved_refund' | 'resolved_seller_paid' | 'rejected'

  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(disputeId) as any;
  if (!dispute) {
    res.status(404).json({ error: 'Dispute not found.' });
    return;
  }

  const resolveDispute = db.transaction(() => {
    // 1. Update dispute record
    db.prepare(`
      UPDATE disputes
      SET dispute_status = ?, admin_decision = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, adminNotes || `Admin decision: ${decision}`, disputeId);

    // 2. Take appropriate transactional action
    if (decision === 'resolved_refund') {
      const refundId = uuidv4();
      const gatewayRefundRef = `rfnd_${uuidv4().substring(0, 10)}`;

      // Record refund
      db.prepare(`
        INSERT INTO refunds (id, transaction_id, gateway_refund_reference, refund_amount, refund_status)
        VALUES (?, ?, ?, (SELECT total_amount FROM transactions WHERE id = ?), 'processed')
      `).run(refundId, dispute.transaction_id, gatewayRefundRef, dispute.transaction_id);

      // Update payment to refunded
      db.prepare(`
        UPDATE payments
        SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(dispute.transaction_id);

      // Update transaction status
      db.prepare(`
        UPDATE transactions
        SET transaction_status = 'refunded'
        WHERE id = ?
      `).run(dispute.transaction_id);

      // Notify parties
      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, (SELECT buyer_id FROM transactions WHERE id = ?), 'REFUND_PROCESSED', 'Your dispute was resolved. A full refund has been credited via the payment gateway.')
      `).run(uuidv4(), dispute.transaction_id);
    } else if (decision === 'resolved_seller_paid') {
      db.prepare(`
        UPDATE payments
        SET payment_status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(dispute.transaction_id);

      db.prepare(`
        UPDATE transactions
        SET transaction_status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(dispute.transaction_id);
    }

    logAuditEvent({
      actorId: req.user!.id,
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
adminRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response): void => {
  const logs = db.prepare(`
    SELECT * FROM audit_logs
    ORDER BY timestamp DESC
    LIMIT 100
  `).all();

  res.json({ logs });
});

// GET /api/v1/admin/transactions
adminRouter.get('/transactions', (req: AuthenticatedRequest, res: Response): void => {
  const transactions = db.prepare(`
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
