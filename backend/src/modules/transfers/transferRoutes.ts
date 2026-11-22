import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { defaultProvider } from '../../providers/MockBookMyShowProvider';
import { decryptAES } from '../../utils/crypto';
import { logAuditEvent } from '../../utils/audit';

export const transferRouter = Router();

// POST /api/v1/transfers/initiate (Seller initiates official transfer via provider adapter)
transferRouter.post('/initiate', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.body;

    const tx = db.prepare(`
      SELECT t.*, l.ticket_id, tk.booking_reference_fingerprint, e.event_name
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN tickets tk ON l.ticket_id = tk.id
      JOIN events e ON tk.event_id = e.id
      WHERE t.id = ?
    `).get(transactionId) as any;

    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (tx.seller_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only the assigned seller can initiate ticket transfer.' });
      return;
    }

    if (tx.transaction_status !== 'paid_awaiting_transfer' && tx.transaction_status !== 'transfer_initiated') {
      res.status(400).json({
        error: `Cannot initiate transfer in current state: ${tx.transaction_status}. Payment must be captured first.`,
      });
      return;
    }

    // Retrieve buyer recipient details
    const rec = db.prepare('SELECT * FROM recipient_details WHERE transaction_id = ?').get(transactionId) as any;
    if (!rec) {
      res.status(400).json({ error: 'Buyer has not submitted recipient transfer information yet.' });
      return;
    }

    const recipientName = decryptAES(rec.encrypted_name);
    const recipientEmail = decryptAES(rec.encrypted_email);
    const recipientPhone = decryptAES(rec.encrypted_phone);

    // Call Ticket Provider Adapter to initiate official transfer
    const providerResult = await defaultProvider.initiateTransfer(
      tx.ticket_id,
      recipientName,
      recipientEmail,
      recipientPhone
    );

    if (!providerResult.success) {
      res.status(500).json({ error: 'Provider failed to initiate transfer', details: providerResult.message });
      return;
    }

    // Update transfers table
    let transfer = db.prepare('SELECT id FROM transfers WHERE transaction_id = ?').get(transactionId) as any;
    const transferId = transfer ? transfer.id : uuidv4();

    if (transfer) {
      db.prepare(`
        UPDATE transfers
        SET provider_transfer_reference = ?, transfer_status = 'awaiting_buyer_acceptance', initiated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(providerResult.providerTransferReference, transferId);
    } else {
      db.prepare(`
        INSERT INTO transfers (id, transaction_id, provider_id, provider_transfer_reference, transfer_status, initiated_at)
        VALUES (?, ?, 'provider-bms', ?, 'awaiting_buyer_acceptance', CURRENT_TIMESTAMP)
      `).run(transferId, transactionId, providerResult.providerTransferReference);
    }

    // Update transaction status to 'transfer_initiated'
    db.prepare(`
      UPDATE transactions
      SET transaction_status = 'transfer_initiated'
      WHERE id = ?
    `).run(transactionId);

    // Notify Buyer that transfer was initiated and needs their official acceptance
    db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'TRANSFER_INITIATED', ?)
    `).run(
      uuidv4(),
      tx.buyer_id,
      `Official transfer for "${tx.event_name}" initiated by seller! Reference: ${providerResult.providerTransferReference}. Please review and accept.`
    );

    logAuditEvent({
      actorId: req.user!.id,
      action: 'OFFICIAL_TRANSFER_INITIATED',
      resourceType: 'transfer',
      resourceId: transferId,
      outcome: 'SUCCESS',
      details: {
        transactionId,
        providerTransferReference: providerResult.providerTransferReference,
        invitationUrl: providerResult.invitationUrl,
      },
    });

    res.json({
      message: 'Official ticket transfer initiated through provider.',
      providerTransferReference: providerResult.providerTransferReference,
      status: 'awaiting_buyer_acceptance',
      invitationUrl: providerResult.invitationUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate transfer', message: err.message });
  }
});

// POST /api/v1/transfers/:id/accept (Buyer officially confirms & accepts provider ticket transfer)
transferRouter.post('/:id/accept', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const transferId = req.params.id;

    const transfer = db.prepare(`
      SELECT tr.*, tx.buyer_id, tx.seller_id, tx.listing_id, tx.id as transaction_id, tx.total_amount,
             l.ticket_id, tk.booking_reference_fingerprint, e.event_name
      FROM transfers tr
      JOIN transactions tx ON tr.transaction_id = tx.id
      JOIN listings l ON tx.listing_id = l.id
      JOIN tickets tk ON l.ticket_id = tk.id
      JOIN events e ON tk.event_id = e.id
      WHERE tr.id = ? OR tr.transaction_id = ?
    `).get(transferId, transferId) as any;

    if (!transfer) {
      res.status(404).json({ error: 'Transfer record not found.' });
      return;
    }

    if (transfer.buyer_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only the buyer can accept and confirm ticket transfer.' });
      return;
    }

    // Call provider adapter to officially confirm
    const providerStatus = await defaultProvider.acceptTransfer(
      transfer.provider_transfer_reference || 'SIM-REF',
      req.user!.email
    );

    // Final Atomic Completion Transaction
    const completeTransaction = db.transaction(() => {
      // 1. Mark transfer confirmed
      db.prepare(`
        UPDATE transfers
        SET transfer_status = 'provider_confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.id);

      // 2. Mark transaction completed
      db.prepare(`
        UPDATE transactions
        SET transaction_status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.transaction_id);

      // 3. Mark listing as permanently sold (Section 23: One-Time Resale Protection)
      db.prepare(`
        UPDATE listings
        SET listing_status = 'sold', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.listing_id);

      // 4. Mark ticket as transferred
      db.prepare(`
        UPDATE tickets
        SET ticket_status = 'transferred'
        WHERE id = ?
      `).run(transfer.ticket_id);

      // 5. Release conditional seller settlement (Section 14.4)
      db.prepare(`
        UPDATE payments
        SET payment_status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(transfer.transaction_id);

      // 6. Notify both users
      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'TRANSACTION_COMPLETED', ?)
      `).run(
        uuidv4(),
        transfer.buyer_id,
        `Congratulations! Official ticket transfer for "${transfer.event_name}" is complete. Please rate your experience.`
      );

      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'SETTLEMENT_RELEASED', ?)
      `).run(
        uuidv4(),
        transfer.seller_id,
        `Transfer verified! Seller settlement for "${transfer.event_name}" has been released.`
      );

      logAuditEvent({
        actorId: req.user!.id,
        action: 'TRANSACTION_VERIFIED_AND_SETTLED',
        resourceType: 'transaction',
        resourceId: transfer.transaction_id,
        outcome: 'SUCCESS',
        details: {
          transferId: transfer.id,
          providerTransferReference: transfer.provider_transfer_reference,
          settlementAmountPaise: transfer.total_amount,
        },
      });
    });

    completeTransaction();

    res.json({
      message: 'Ticket transfer officially confirmed by provider. Transaction completed and settlement released.',
      status: 'provider_confirmed',
      transactionStatus: 'completed',
      settlementStatus: 'settled',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept transfer', message: err.message });
  }
});

// POST /api/v1/transfers/:id/fail (Simulate or handle transfer failure)
transferRouter.post('/:id/fail', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const transferId = req.params.id;
  const { reason = 'Provider transfer invitation failed or was revoked.' } = req.body;

  const transfer = db.prepare(`
    SELECT tr.*, tx.buyer_id, tx.seller_id, tx.id as transaction_id
    FROM transfers tr
    JOIN transactions tx ON tr.transaction_id = tx.id
    WHERE tr.id = ? OR tr.transaction_id = ?
  `).get(transferId, transferId) as any;

  if (!transfer) {
    res.status(404).json({ error: 'Transfer not found.' });
    return;
  }

  // Update transfer to failed and freeze settlement
  db.prepare(`
    UPDATE transfers
    SET transfer_status = 'failed', failure_reason = ?
    WHERE id = ?
  `).run(reason, transfer.id);

  db.prepare(`
    UPDATE transactions
    SET transaction_status = 'failed'
    WHERE id = ?
  `).run(transfer.transaction_id);

  // Escalate to notifications & audit
  db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'TRANSFER_FAILED', ?)
  `).run(
    uuidv4(),
    transfer.buyer_id,
    `Transfer failed: ${reason}. A dispute/refund process can now be initiated.`
  );

  db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'TRANSFER_FAILED', ?)
  `).run(
    uuidv4(),
    transfer.seller_id,
    `Transfer failed: ${reason}. Settlement is locked pending dispute review.`
  );

  logAuditEvent({
    actorId: req.user!.id,
    action: 'TRANSFER_FAILED',
    resourceType: 'transfer',
    resourceId: transfer.id,
    outcome: 'FAILURE',
    details: { reason, transactionId: transfer.transaction_id },
  });

  res.json({
    message: 'Transfer marked as failed. Settlement remains locked.',
    status: 'failed',
    failureReason: reason,
  });
});
