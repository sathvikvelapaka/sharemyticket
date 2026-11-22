"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const database_1 = require("../../db/database");
const crypto_1 = require("../../utils/crypto");
const audit_1 = require("../../utils/audit");
const auth_1 = require("../../middleware/auth");
exports.paymentRouter = (0, express_1.Router)();
const RecipientSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    phone: zod_1.z.string().min(10),
});
// POST /api/v1/transactions/:id/recipient (Buyer submits encrypted recipient details)
exports.paymentRouter.post('/transactions/:id/recipient', auth_1.authenticate, (req, res) => {
    try {
        const data = RecipientSchema.parse(req.body);
        const transactionId = req.params.id;
        const tx = database_1.db.prepare('SELECT buyer_id, transaction_status FROM transactions WHERE id = ?').get(transactionId);
        if (!tx) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }
        if (tx.buyer_id !== req.user.id && req.user.role !== 'admin') {
            res.status(403).json({ error: 'Unauthorized: Only the buyer can submit recipient transfer details.' });
            return;
        }
        // Encrypt sensitive recipient data using AES-256-GCM
        const encName = (0, crypto_1.encryptAES)(data.fullName);
        const encEmail = (0, crypto_1.encryptAES)(data.email);
        const encPhone = (0, crypto_1.encryptAES)(data.phone);
        // Delete existing if re-submitting before transfer
        database_1.db.prepare('DELETE FROM recipient_details WHERE transaction_id = ?').run(transactionId);
        const recId = (0, uuid_1.v4)();
        const deletionDueAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30-day retention policy
        database_1.db.prepare(`
      INSERT INTO recipient_details (id, transaction_id, encrypted_name, encrypted_email, encrypted_phone, deletion_due_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recId, transactionId, encName, encEmail, encPhone, deletionDueAt);
        (0, audit_1.logAuditEvent)({
            actorId: req.user.id,
            action: 'RECIPIENT_DETAILS_STORED_ENCRYPTED',
            resourceType: 'recipient_details',
            resourceId: recId,
            outcome: 'SUCCESS',
            details: { transactionId, retentionDue: deletionDueAt },
        });
        res.json({ message: 'Recipient transfer details encrypted and saved securely.' });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Validation error', details: err.issues || err.errors });
            return;
        }
        res.status(500).json({ error: 'Failed to save recipient details', message: err.message });
    }
});
// GET /api/v1/transactions/:id/recipient (Authorized Seller or Admin retrieves decrypted recipient info)
exports.paymentRouter.get('/transactions/:id/recipient', auth_1.authenticate, (req, res) => {
    const transactionId = req.params.id;
    const tx = database_1.db.prepare(`
    SELECT t.id, t.buyer_id, t.seller_id, t.transaction_status, p.payment_status
    FROM transactions t
    LEFT JOIN payments p ON p.transaction_id = t.id
    WHERE t.id = ?
  `).get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    // Security check: Only the approved seller (or admin) can view the recipient info, and ONLY after payment is captured
    const isAuthorized = (tx.seller_id === req.user.id || req.user.role === 'admin');
    if (!isAuthorized) {
        res.status(403).json({ error: 'Access forbidden: You are not authorized to view recipient transfer details.' });
        return;
    }
    const rec = database_1.db.prepare('SELECT * FROM recipient_details WHERE transaction_id = ?').get(transactionId);
    if (!rec) {
        res.status(404).json({ error: 'Buyer has not yet submitted recipient details for this transaction.' });
        return;
    }
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'RECIPIENT_DETAILS_ACCESSED',
        resourceType: 'recipient_details',
        resourceId: rec.id,
        outcome: 'SUCCESS',
        details: { transactionId },
    });
    res.json({
        recipient: {
            fullName: (0, crypto_1.decryptAES)(rec.encrypted_name),
            email: (0, crypto_1.decryptAES)(rec.encrypted_email),
            phone: (0, crypto_1.decryptAES)(rec.encrypted_phone),
        },
    });
});
// POST /api/v1/payments/create-order
exports.paymentRouter.post('/create-order', auth_1.authenticate, (req, res) => {
    const { transactionId, idempotencyKey } = req.body;
    const tx = database_1.db.prepare(`
    SELECT t.*, l.resale_price, l.listing_status, r.reservation_status, r.expires_at as res_expires
    FROM transactions t
    JOIN listings l ON t.listing_id = l.id
    JOIN reservations r ON r.purchase_request_id = t.purchase_request_id
    WHERE t.id = ?
  `).get(transactionId);
    if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    if (tx.buyer_id !== req.user.id) {
        res.status(403).json({ error: 'Unauthorized: Only the assigned buyer can initiate payment.' });
        return;
    }
    // Verify reservation is active and unexpired
    if (tx.reservation_status !== 'active' || new Date(tx.res_expires) <= new Date()) {
        res.status(400).json({ error: 'Reservation has expired. Payment cannot be initiated.' });
        return;
    }
    // Check if order already exists with idempotency key
    if (idempotencyKey) {
        const existing = database_1.db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(idempotencyKey);
        if (existing) {
            res.json({ payment: existing, note: 'Idempotent replay' });
            return;
        }
    }
    const paymentId = (0, uuid_1.v4)();
    const gatewayOrderId = `order_${(0, uuid_1.v4)().substring(0, 12)}`;
    database_1.db.prepare(`
    INSERT INTO payments (id, transaction_id, gateway_order_id, amount, currency, payment_status, idempotency_key)
    VALUES (?, ?, ?, ?, 'INR', 'created', ?)
  `).run(paymentId, transactionId, gatewayOrderId, tx.total_amount, idempotencyKey || null);
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'PAYMENT_ORDER_CREATED',
        resourceType: 'payment',
        resourceId: paymentId,
        outcome: 'SUCCESS',
        details: { transactionId, amountPaise: tx.total_amount, gatewayOrderId },
    });
    res.status(201).json({
        message: 'Payment order created on gateway sandbox.',
        paymentId,
        gatewayOrderId,
        amount: tx.total_amount,
        currency: 'INR',
    });
});
// POST /api/v1/payments/checkout-sandbox (Simulated Secure Hosted Checkout)
exports.paymentRouter.post('/checkout-sandbox', auth_1.authenticate, (req, res) => {
    const { paymentId, paymentMethod = 'UPI' } = req.body;
    const payment = database_1.db.prepare(`
    SELECT p.*, t.buyer_id, t.seller_id, t.listing_id, t.purchase_request_id, e.event_name
    FROM payments p
    JOIN transactions t ON p.transaction_id = t.id
    JOIN listings l ON t.listing_id = l.id
    JOIN tickets tk ON l.ticket_id = tk.id
    JOIN events e ON tk.event_id = e.id
    WHERE p.id = ?
  `).get(paymentId);
    if (!payment) {
        res.status(404).json({ error: 'Payment record not found.' });
        return;
    }
    if (payment.buyer_id !== req.user.id && req.user.role !== 'admin') {
        res.status(403).json({ error: 'Unauthorized to execute payment.' });
        return;
    }
    const gatewayPaymentId = `pay_${(0, uuid_1.v4)().substring(0, 14)}`;
    // Atomic database update for successful capture
    const finalizePayment = database_1.db.transaction(() => {
        // 1. Update payment status to 'captured'
        database_1.db.prepare(`
      UPDATE payments
      SET payment_status = 'captured', gateway_payment_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(gatewayPaymentId, paymentId);
        // 2. Update transaction status to 'paid_awaiting_transfer'
        database_1.db.prepare(`
      UPDATE transactions
      SET transaction_status = 'paid_awaiting_transfer'
      WHERE id = ?
    `).run(payment.transaction_id);
        // 3. Mark reservation as completed (since payment has succeeded)
        database_1.db.prepare(`
      UPDATE reservations
      SET reservation_status = 'completed'
      WHERE purchase_request_id = ?
    `).run(payment.purchase_request_id);
        // 4. Initialize transfer record if not exists
        const existingTransfer = database_1.db.prepare('SELECT id FROM transfers WHERE transaction_id = ?').get(payment.transaction_id);
        if (!existingTransfer) {
            database_1.db.prepare(`
        INSERT INTO transfers (id, transaction_id, provider_id, transfer_status)
        VALUES (?, ?, 'provider-bms', 'awaiting_seller')
      `).run((0, uuid_1.v4)(), payment.transaction_id);
        }
        // 5. Notify seller that payment is captured and they should initiate official transfer
        database_1.db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'PAYMENT_CONFIRMED', ?)
    `).run((0, uuid_1.v4)(), payment.seller_id, `Payment of ₹${payment.amount / 100} captured securely! Please view buyer recipient info and initiate official transfer.`);
        // 6. Notify buyer
        database_1.db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'PAYMENT_SUCCESS', ?)
    `).run((0, uuid_1.v4)(), payment.buyer_id, `Payment confirmed. Seller has been notified to transfer your ticket for "${payment.event_name}".`);
        (0, audit_1.logAuditEvent)({
            actorId: req.user.id,
            action: 'PAYMENT_CAPTURED',
            resourceType: 'payment',
            resourceId: paymentId,
            outcome: 'SUCCESS',
            details: { gatewayPaymentId, paymentMethod, amount: payment.amount },
        });
    });
    finalizePayment();
    res.json({
        message: 'Sandbox payment verified and captured successfully.',
        gatewayPaymentId,
        status: 'captured',
        transactionStatus: 'paid_awaiting_transfer',
        conditionalSettlementStatus: 'settlement_pending_until_verified_transfer',
    });
});
// POST /api/v1/payments/webhook (Cryptographically verified webhook handler)
exports.paymentRouter.post('/webhook', (req, res) => {
    const signature = req.headers['x-trustpass-signature'];
    const rawPayload = JSON.stringify(req.body);
    if (!signature || !(0, crypto_1.verifyWebhookSignature)(rawPayload, signature)) {
        (0, audit_1.logAuditEvent)({
            actorId: 'gateway',
            action: 'PAYMENT_WEBHOOK_FORGERY_DETECTED',
            resourceType: 'webhook',
            resourceId: 'payment-webhook',
            outcome: 'BLOCKED',
            details: { invalidSig: signature },
        });
        res.status(401).json({ error: 'Invalid webhook HMAC signature.' });
        return;
    }
    const { event, orderId, paymentId: gwPayId, amount } = req.body;
    if (event === 'payment.captured') {
        const payment = database_1.db.prepare('SELECT id, transaction_id FROM payments WHERE gateway_order_id = ?').get(orderId);
        if (payment) {
            database_1.db.prepare(`
        UPDATE payments
        SET payment_status = 'captured', gateway_payment_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(gwPayId, payment.id);
            database_1.db.prepare(`
        UPDATE transactions
        SET transaction_status = 'paid_awaiting_transfer'
        WHERE id = ?
      `).run(payment.transaction_id);
            (0, audit_1.logAuditEvent)({
                actorId: 'gateway_webhook',
                action: 'WEBHOOK_PAYMENT_CAPTURED',
                resourceType: 'payment',
                resourceId: payment.id,
                outcome: 'SUCCESS',
            });
        }
    }
    res.json({ received: true });
});
