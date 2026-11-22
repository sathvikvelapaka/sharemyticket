"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
const MockBookMyShowProvider_1 = require("../../providers/MockBookMyShowProvider");
const crypto_1 = require("../../utils/crypto");
const audit_1 = require("../../utils/audit");
exports.transferRouter = (0, express_1.Router)();
// POST /api/v1/transfers/initiate (Seller initiates official transfer via provider adapter)
exports.transferRouter.post('/initiate', auth_1.authenticate, async (req, res) => {
    try {
        const { transactionId } = req.body;
        const tx = database_1.db.prepare(`
      SELECT t.*, l.ticket_id, tk.booking_reference_fingerprint, e.event_name
      FROM transactions t
      JOIN listings l ON t.listing_id = l.id
      JOIN tickets tk ON l.ticket_id = tk.id
      JOIN events e ON tk.event_id = e.id
      WHERE t.id = ?
    `).get(transactionId);
        if (!tx) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }
        if (tx.seller_id !== req.user.id && req.user.role !== 'admin') {
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
        const rec = database_1.db.prepare('SELECT * FROM recipient_details WHERE transaction_id = ?').get(transactionId);
        if (!rec) {
            res.status(400).json({ error: 'Buyer has not submitted recipient transfer information yet.' });
            return;
        }
        const recipientName = (0, crypto_1.decryptAES)(rec.encrypted_name);
        const recipientEmail = (0, crypto_1.decryptAES)(rec.encrypted_email);
        const recipientPhone = (0, crypto_1.decryptAES)(rec.encrypted_phone);
        // Call Ticket Provider Adapter to initiate official transfer
        const providerResult = await MockBookMyShowProvider_1.defaultProvider.initiateTransfer(tx.ticket_id, recipientName, recipientEmail, recipientPhone);
        if (!providerResult.success) {
            res.status(500).json({ error: 'Provider failed to initiate transfer', details: providerResult.message });
            return;
        }
        // Update transfers table
        let transfer = database_1.db.prepare('SELECT id FROM transfers WHERE transaction_id = ?').get(transactionId);
        const transferId = transfer ? transfer.id : (0, uuid_1.v4)();
        if (transfer) {
            database_1.db.prepare(`
        UPDATE transfers
        SET provider_transfer_reference = ?, transfer_status = 'awaiting_buyer_acceptance', initiated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(providerResult.providerTransferReference, transferId);
        }
        else {
            database_1.db.prepare(`
        INSERT INTO transfers (id, transaction_id, provider_id, provider_transfer_reference, transfer_status, initiated_at)
        VALUES (?, ?, 'provider-bms', ?, 'awaiting_buyer_acceptance', CURRENT_TIMESTAMP)
      `).run(transferId, transactionId, providerResult.providerTransferReference);
        }
        // Update transaction status to 'transfer_initiated'
        database_1.db.prepare(`
      UPDATE transactions
      SET transaction_status = 'transfer_initiated'
      WHERE id = ?
    `).run(transactionId);
        // Notify Buyer that transfer was initiated and needs their official acceptance
        database_1.db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'TRANSFER_INITIATED', ?)
    `).run((0, uuid_1.v4)(), tx.buyer_id, `Official transfer for "${tx.event_name}" initiated by seller! Reference: ${providerResult.providerTransferReference}. Please review and accept.`);
        (0, audit_1.logAuditEvent)({
            actorId: req.user.id,
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
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to initiate transfer', message: err.message });
    }
});
// POST /api/v1/transfers/:id/accept (Buyer officially confirms & accepts provider ticket transfer)
exports.transferRouter.post('/:id/accept', auth_1.authenticate, async (req, res) => {
    try {
        const transferId = req.params.id;
        const transfer = database_1.db.prepare(`
      SELECT tr.*, tx.buyer_id, tx.seller_id, tx.listing_id, tx.id as transaction_id, tx.total_amount,
             l.ticket_id, tk.booking_reference_fingerprint, e.event_name
      FROM transfers tr
      JOIN transactions tx ON tr.transaction_id = tx.id
      JOIN listings l ON tx.listing_id = l.id
      JOIN tickets tk ON l.ticket_id = tk.id
      JOIN events e ON tk.event_id = e.id
      WHERE tr.id = ? OR tr.transaction_id = ?
    `).get(transferId, transferId);
        if (!transfer) {
            res.status(404).json({ error: 'Transfer record not found.' });
            return;
        }
        if (transfer.buyer_id !== req.user.id && req.user.role !== 'admin') {
            res.status(403).json({ error: 'Unauthorized: Only the buyer can accept and confirm ticket transfer.' });
            return;
        }
        // Call provider adapter to officially confirm
        const providerStatus = await MockBookMyShowProvider_1.defaultProvider.acceptTransfer(transfer.provider_transfer_reference || 'SIM-REF', req.user.email);
        // Final Atomic Completion Transaction
        const completeTransaction = database_1.db.transaction(() => {
            // 1. Mark transfer confirmed
            database_1.db.prepare(`
        UPDATE transfers
        SET transfer_status = 'provider_confirmed', confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.id);
            // 2. Mark transaction completed
            database_1.db.prepare(`
        UPDATE transactions
        SET transaction_status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.transaction_id);
            // 3. Mark listing as permanently sold (Section 23: One-Time Resale Protection)
            database_1.db.prepare(`
        UPDATE listings
        SET listing_status = 'sold', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(transfer.listing_id);
            // 4. Mark ticket as transferred
            database_1.db.prepare(`
        UPDATE tickets
        SET ticket_status = 'transferred'
        WHERE id = ?
      `).run(transfer.ticket_id);
            // 5. Release conditional seller settlement (Section 14.4)
            database_1.db.prepare(`
        UPDATE payments
        SET payment_status = 'settled', updated_at = CURRENT_TIMESTAMP
        WHERE transaction_id = ?
      `).run(transfer.transaction_id);
            // 6. Notify both users
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'TRANSACTION_COMPLETED', ?)
      `).run((0, uuid_1.v4)(), transfer.buyer_id, `Congratulations! Official ticket transfer for "${transfer.event_name}" is complete. Please rate your experience.`);
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'SETTLEMENT_RELEASED', ?)
      `).run((0, uuid_1.v4)(), transfer.seller_id, `Transfer verified! Seller settlement for "${transfer.event_name}" has been released.`);
            (0, audit_1.logAuditEvent)({
                actorId: req.user.id,
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
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to accept transfer', message: err.message });
    }
});
// POST /api/v1/transfers/:id/fail (Simulate or handle transfer failure)
exports.transferRouter.post('/:id/fail', auth_1.authenticate, async (req, res) => {
    const transferId = req.params.id;
    const { reason = 'Provider transfer invitation failed or was revoked.' } = req.body;
    const transfer = database_1.db.prepare(`
    SELECT tr.*, tx.buyer_id, tx.seller_id, tx.id as transaction_id
    FROM transfers tr
    JOIN transactions tx ON tr.transaction_id = tx.id
    WHERE tr.id = ? OR tr.transaction_id = ?
  `).get(transferId, transferId);
    if (!transfer) {
        res.status(404).json({ error: 'Transfer not found.' });
        return;
    }
    // Update transfer to failed and freeze settlement
    database_1.db.prepare(`
    UPDATE transfers
    SET transfer_status = 'failed', failure_reason = ?
    WHERE id = ?
  `).run(reason, transfer.id);
    database_1.db.prepare(`
    UPDATE transactions
    SET transaction_status = 'failed'
    WHERE id = ?
  `).run(transfer.transaction_id);
    // Escalate to notifications & audit
    database_1.db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'TRANSFER_FAILED', ?)
  `).run((0, uuid_1.v4)(), transfer.buyer_id, `Transfer failed: ${reason}. A dispute/refund process can now be initiated.`);
    database_1.db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'TRANSFER_FAILED', ?)
  `).run((0, uuid_1.v4)(), transfer.seller_id, `Transfer failed: ${reason}. Settlement is locked pending dispute review.`);
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
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
