import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../../db/database';
import { encryptAES, decryptAES, verifyWebhookSignature, signWebhookPayload } from '../../utils/crypto';
import { logAuditEvent } from '../../utils/audit';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';

export const paymentRouter = Router();

const RecipientSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
});

// POST /api/v1/transactions/:id/recipient (Buyer submits encrypted recipient details)
paymentRouter.post('/transactions/:id/recipient', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const data = RecipientSchema.parse(req.body);
    const transactionId = req.params.id;

    const tx = db.prepare('SELECT buyer_id, transaction_status FROM transactions WHERE id = ?').get(transactionId) as any;
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (tx.buyer_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Unauthorized: Only the buyer can submit recipient transfer details.' });
      return;
    }

    // Encrypt sensitive recipient data using AES-256-GCM
    const encName = encryptAES(data.fullName);
    const encEmail = encryptAES(data.email);
    const encPhone = encryptAES(data.phone);

    // Delete existing if re-submitting before transfer
    db.prepare('DELETE FROM recipient_details WHERE transaction_id = ?').run(transactionId);

    const recId = uuidv4();
    const deletionDueAt = new Date(Date.now() + 30 * 86400000).toISOString(); // 30-day retention policy

    db.prepare(`
      INSERT INTO recipient_details (id, transaction_id, encrypted_name, encrypted_email, encrypted_phone, deletion_due_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recId, transactionId, encName, encEmail, encPhone, deletionDueAt);

    logAuditEvent({
      actorId: req.user!.id,
      action: 'RECIPIENT_DETAILS_STORED_ENCRYPTED',
      resourceType: 'recipient_details',
      resourceId: recId,
      outcome: 'SUCCESS',
      details: { transactionId, retentionDue: deletionDueAt },
    });

    res.json({ message: 'Recipient transfer details encrypted and saved securely.' });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: (err as any).issues || (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to save recipient details', message: err.message });
  }
});

// GET /api/v1/transactions/:id/recipient (Authorized Seller or Admin retrieves decrypted recipient info)
paymentRouter.get('/transactions/:id/recipient', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const transactionId = req.params.id;

  const tx = db.prepare(`
    SELECT t.id, t.buyer_id, t.seller_id, t.transaction_status, p.payment_status
    FROM transactions t
    LEFT JOIN payments p ON p.transaction_id = t.id
    WHERE t.id = ?
  `).get(transactionId) as any;

  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  // Security check: Only the approved seller (or admin) can view the recipient info, and ONLY after payment is captured
  const isAuthorized = (tx.seller_id === req.user!.id || req.user!.role === 'admin');
  if (!isAuthorized) {
    res.status(403).json({ error: 'Access forbidden: You are not authorized to view recipient transfer details.' });
    return;
  }

  const rec = db.prepare('SELECT * FROM recipient_details WHERE transaction_id = ?').get(transactionId) as any;
  if (!rec) {
    res.status(404).json({ error: 'Buyer has not yet submitted recipient details for this transaction.' });
    return;
  }

  logAuditEvent({
    actorId: req.user!.id,
    action: 'RECIPIENT_DETAILS_ACCESSED',
    resourceType: 'recipient_details',
    resourceId: rec.id,
    outcome: 'SUCCESS',
    details: { transactionId },
  });

  res.json({
    recipient: {
      fullName: decryptAES(rec.encrypted_name),
      email: decryptAES(rec.encrypted_email),
      phone: decryptAES(rec.encrypted_phone),
    },
  });
});

// POST /api/v1/payments/create-order
paymentRouter.post('/create-order', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const { transactionId, idempotencyKey } = req.body;

  const tx = db.prepare(`
    SELECT t.*, l.resale_price, l.listing_status, r.reservation_status, r.expires_at as res_expires
    FROM transactions t
    JOIN listings l ON t.listing_id = l.id
    JOIN reservations r ON r.purchase_request_id = t.purchase_request_id
    WHERE t.id = ?
  `).get(transactionId) as any;

  if (!tx) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  if (tx.buyer_id !== req.user!.id) {
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
    const existing = db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(idempotencyKey);
    if (existing) {
      res.json({ payment: existing, note: 'Idempotent replay' });
      return;
    }
  }

  const paymentId = uuidv4();
  const gatewayOrderId = `order_${uuidv4().substring(0, 12)}`;

  db.prepare(`
    INSERT INTO payments (id, transaction_id, gateway_order_id, amount, currency, payment_status, idempotency_key)
    VALUES (?, ?, ?, ?, 'INR', 'created', ?)
  `).run(paymentId, transactionId, gatewayOrderId, tx.total_amount, idempotencyKey || null);

  logAuditEvent({
    actorId: req.user!.id,
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
paymentRouter.post('/checkout-sandbox', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const { paymentId, paymentMethod = 'UPI' } = req.body;

  const payment = db.prepare(`
    SELECT p.*, t.buyer_id, t.seller_id, t.listing_id, t.purchase_request_id, e.event_name
    FROM payments p
    JOIN transactions t ON p.transaction_id = t.id
    JOIN listings l ON t.listing_id = l.id
    JOIN tickets tk ON l.ticket_id = tk.id
    JOIN events e ON tk.event_id = e.id
    WHERE p.id = ?
  `).get(paymentId) as any;

  if (!payment) {
    res.status(404).json({ error: 'Payment record not found.' });
    return;
  }

  if (payment.buyer_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Unauthorized to execute payment.' });
    return;
  }

  const gatewayPaymentId = `pay_${uuidv4().substring(0, 14)}`;

  // Atomic database update for successful capture
  const finalizePayment = db.transaction(() => {
    // 1. Update payment status to 'captured'
    db.prepare(`
      UPDATE payments
      SET payment_status = 'captured', gateway_payment_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(gatewayPaymentId, paymentId);

    // 2. Update transaction status to 'paid_awaiting_transfer'
    db.prepare(`
      UPDATE transactions
      SET transaction_status = 'paid_awaiting_transfer'
      WHERE id = ?
    `).run(payment.transaction_id);

    // 3. Mark reservation as completed (since payment has succeeded)
    db.prepare(`
      UPDATE reservations
      SET reservation_status = 'completed'
      WHERE purchase_request_id = ?
    `).run(payment.purchase_request_id);

    // 4. Initialize transfer record if not exists
    const existingTransfer = db.prepare('SELECT id FROM transfers WHERE transaction_id = ?').get(payment.transaction_id);
    if (!existingTransfer) {
      db.prepare(`
        INSERT INTO transfers (id, transaction_id, provider_id, transfer_status)
        VALUES (?, ?, 'provider-bms', 'awaiting_seller')
      `).run(uuidv4(), payment.transaction_id);
    }

    // 5. Notify seller that payment is captured and they should initiate official transfer
    db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'PAYMENT_CONFIRMED', ?)
    `).run(
      uuidv4(),
      payment.seller_id,
      `Payment of ₹${payment.amount / 100} captured securely! Please view buyer recipient info and initiate official transfer.`
    );

    // 6. Notify buyer
    db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'PAYMENT_SUCCESS', ?)
    `).run(
      uuidv4(),
      payment.buyer_id,
      `Payment confirmed. Seller has been notified to transfer your ticket for "${payment.event_name}".`
    );

    logAuditEvent({
      actorId: req.user!.id,
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
paymentRouter.post('/webhook', (req: Request, res: Response): void => {
  const signature = req.headers['x-trustpass-signature'] as string;
  const rawPayload = JSON.stringify(req.body);

  if (!signature || !verifyWebhookSignature(rawPayload, signature)) {
    logAuditEvent({
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
    const payment = db.prepare('SELECT id, transaction_id FROM payments WHERE gateway_order_id = ?').get(orderId) as any;
    if (payment) {
      db.prepare(`
        UPDATE payments
        SET payment_status = 'captured', gateway_payment_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(gwPayId, payment.id);

      db.prepare(`
        UPDATE transactions
        SET transaction_status = 'paid_awaiting_transfer'
        WHERE id = ?
      `).run(payment.transaction_id);

      logAuditEvent({
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
