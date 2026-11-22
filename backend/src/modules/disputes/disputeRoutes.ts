import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../../db/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { logAuditEvent } from '../../utils/audit';

export const disputeRouter = Router();

const DisputeSchema = z.object({
  transactionId: z.string(),
  disputeCategory: z.string(),
  description: z.string().min(10),
});

// POST /api/v1/disputes (User raises dispute)
disputeRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const data = DisputeSchema.parse(req.body);
    const userId = req.user!.id;

    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(data.transactionId) as any;
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (tx.buyer_id !== userId && tx.seller_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: You are not a participant in this transaction.' });
      return;
    }

    const disputeId = uuidv4();

    db.prepare(`
      INSERT INTO disputes (id, transaction_id, raised_by, dispute_category, description, dispute_status)
      VALUES (?, ?, ?, ?, ?, 'opened')
    `).run(disputeId, data.transactionId, userId, data.disputeCategory, data.description);

    // Update transaction state to disputed
    db.prepare(`
      UPDATE transactions
      SET transaction_status = 'disputed'
      WHERE id = ?
    `).run(data.transactionId);

    // Alert admin and opposing party
    const counterpartyId = (userId === tx.buyer_id) ? tx.seller_id : tx.buyer_id;
    db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'DISPUTE_RAISED', ?)
    `).run(
      uuidv4(),
      counterpartyId,
      `A dispute was raised regarding transaction #${tx.id.substring(0, 8)}. Platform administration is reviewing.`
    );

    logAuditEvent({
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
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: (err as any).issues || (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to open dispute', message: err.message });
  }
});

// GET /api/v1/disputes/:id
disputeRouter.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const dispute = db.prepare(`
    SELECT d.*, u.full_name as raised_by_name, tx.buyer_id, tx.seller_id, tx.total_amount
    FROM disputes d
    JOIN users u ON d.raised_by = u.id
    JOIN transactions tx ON d.transaction_id = tx.id
    WHERE d.id = ?
  `).get(req.params.id) as any;

  if (!dispute) {
    res.status(404).json({ error: 'Dispute not found.' });
    return;
  }

  res.json({ dispute });
});
