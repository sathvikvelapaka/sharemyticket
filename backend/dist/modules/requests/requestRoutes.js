"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const database_1 = require("../../db/database");
const config_1 = require("../../config");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
exports.requestRouter = (0, express_1.Router)();
// POST /api/v1/listings/:id/requests (Buyer submits purchase request)
exports.requestRouter.post('/listings/:id/requests', auth_1.authenticate, (req, res) => {
    const listingId = req.params.id;
    const buyerId = req.user.id;
    const requestedQuantity = parseInt(req.body.quantity || '1', 10);
    const listing = database_1.db.prepare(`
    SELECT l.*, e.event_name, v.venue_name
    FROM listings l
    JOIN tickets t ON l.ticket_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE l.id = ?
  `).get(listingId);
    if (!listing) {
        res.status(404).json({ error: 'Listing not found.' });
        return;
    }
    if (listing.seller_id === buyerId) {
        res.status(400).json({ error: 'Security policy: You cannot purchase your own ticket listing.' });
        return;
    }
    if (listing.listing_status !== 'active') {
        res.status(400).json({ error: `Listing is not active. Current status: ${listing.listing_status}` });
        return;
    }
    // Check if buyer already has a pending request for this listing
    const existingPending = database_1.db.prepare(`
    SELECT id FROM purchase_requests
    WHERE listing_id = ? AND buyer_id = ? AND request_status = 'pending'
  `).get(listingId, buyerId);
    if (existingPending) {
        res.status(409).json({ error: 'You already have an active pending request for this ticket.' });
        return;
    }
    const requestId = (0, uuid_1.v4)();
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    database_1.db.prepare(`
    INSERT INTO purchase_requests (id, listing_id, buyer_id, seller_id, requested_quantity, request_status, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(requestId, listingId, buyerId, listing.seller_id, requestedQuantity, expiresAt);
    // Send notification to seller
    database_1.db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'PURCHASE_REQUEST_RECEIVED', ?)
  `).run((0, uuid_1.v4)(), listing.seller_id, `New purchase request received from ${req.user.fullName} for "${listing.event_name}" (${listing.venue_name}).`);
    (0, audit_1.logAuditEvent)({
        actorId: buyerId,
        action: 'PURCHASE_REQUEST_CREATED',
        resourceType: 'purchase_request',
        resourceId: requestId,
        outcome: 'SUCCESS',
        details: { listingId, sellerId: listing.seller_id, quantity: requestedQuantity },
    });
    res.status(201).json({
        message: 'Purchase request submitted to seller for approval.',
        requestId,
    });
});
// GET /api/v1/seller/requests (Seller views all requests received)
exports.requestRouter.get('/seller/requests', auth_1.authenticate, (req, res) => {
    const requests = database_1.db.prepare(`
    SELECT 
      pr.id, pr.listing_id, pr.buyer_id, pr.requested_quantity, pr.request_status, pr.created_at, pr.expires_at,
      u.full_name as buyer_name, u.email as buyer_email,
      e.event_name, e.event_date,
      v.venue_name,
      l.original_price, l.resale_price, l.listing_status
    FROM purchase_requests pr
    JOIN users u ON pr.buyer_id = u.id
    JOIN listings l ON pr.listing_id = l.id
    JOIN tickets t ON l.ticket_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    WHERE pr.seller_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.user.id);
    res.json({ requests });
});
// GET /api/v1/buyer/requests (Buyer views their sent requests)
exports.requestRouter.get('/buyer/requests', auth_1.authenticate, (req, res) => {
    const requests = database_1.db.prepare(`
    SELECT 
      pr.id, pr.listing_id, pr.seller_id, pr.requested_quantity, pr.request_status, pr.created_at, pr.expires_at,
      u.full_name as seller_name,
      e.event_name, e.event_date,
      v.venue_name, v.address as venue_address,
      l.resale_price, l.listing_status,
      res.id as reservation_id, res.reservation_status, res.expires_at as reservation_expires_at,
      tx.id as transaction_id, tx.transaction_status
    FROM purchase_requests pr
    JOIN users u ON pr.seller_id = u.id
    JOIN listings l ON pr.listing_id = l.id
    JOIN tickets t ON l.ticket_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    LEFT JOIN reservations res ON res.purchase_request_id = pr.id AND res.reservation_status = 'active'
    LEFT JOIN transactions tx ON tx.purchase_request_id = pr.id
    WHERE pr.buyer_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.user.id);
    res.json({ requests });
});
// POST /api/v1/requests/:id/accept (Atomic Concurrency Reservation)
exports.requestRouter.post('/requests/:id/accept', auth_1.authenticate, (req, res) => {
    const requestId = req.params.id;
    const sellerId = req.user.id;
    // Execute in an atomic database transaction
    const executeAtomicAccept = database_1.db.transaction(() => {
        // 1. Fetch request details
        const request = database_1.db.prepare(`
      SELECT pr.*, l.listing_status, l.resale_price, e.event_name
      FROM purchase_requests pr
      JOIN listings l ON pr.listing_id = l.id
      JOIN tickets t ON l.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      WHERE pr.id = ?
    `).get(requestId);
        if (!request) {
            throw { status: 404, message: 'Purchase request not found' };
        }
        if (request.seller_id !== sellerId && req.user.role !== 'admin') {
            throw { status: 403, message: 'Unauthorized: You are not the seller for this listing' };
        }
        if (request.request_status !== 'pending') {
            throw { status: 400, message: `Request is already ${request.request_status}` };
        }
        // 2. Concurrency Lock Check: Ensure listing is still active and not locked by another concurrent buyer
        const listing = database_1.db.prepare('SELECT listing_status FROM listings WHERE id = ?').get(request.listing_id);
        if (!listing || listing.listing_status !== 'active') {
            throw {
                status: 409,
                message: 'Conflict: This ticket listing has already been reserved or sold to another buyer.',
            };
        }
        // 3. Atomically lock listing
        database_1.db.prepare(`
      UPDATE listings
      SET listing_status = 'reserved', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(request.listing_id);
        // 4. Mark this request as accepted
        database_1.db.prepare(`
      UPDATE purchase_requests
      SET request_status = 'accepted'
      WHERE id = ?
    `).run(requestId);
        // 5. Automatically reject all other competing pending requests for this listing
        const rejectedCompetitors = database_1.db.prepare(`
      SELECT buyer_id FROM purchase_requests
      WHERE listing_id = ? AND id != ? AND request_status = 'pending'
    `).all(request.listing_id, requestId);
        database_1.db.prepare(`
      UPDATE purchase_requests
      SET request_status = 'rejected'
      WHERE listing_id = ? AND id != ? AND request_status = 'pending'
    `).run(request.listing_id, requestId);
        // 6. Create 10-minute temporary reservation
        const reservationId = (0, uuid_1.v4)();
        const reservationExpiresAt = new Date(Date.now() + config_1.config.reservationTimeoutSeconds * 1000).toISOString();
        database_1.db.prepare(`
      INSERT INTO reservations (id, listing_id, purchase_request_id, buyer_id, reservation_status, expires_at)
      VALUES (?, ?, ?, ?, 'active', ?)
    `).run(reservationId, request.listing_id, requestId, request.buyer_id, reservationExpiresAt);
        // 7. Create transaction record
        const transactionId = (0, uuid_1.v4)();
        const platformFee = Math.round(request.resale_price * 0.05);
        const totalAmount = request.resale_price + platformFee;
        database_1.db.prepare(`
      INSERT INTO transactions (id, listing_id, buyer_id, seller_id, purchase_request_id, transaction_status, total_amount)
      VALUES (?, ?, ?, ?, ?, 'payment_pending', ?)
    `).run(transactionId, request.listing_id, request.buyer_id, sellerId, requestId, totalAmount);
        // 8. Dispatch notifications
        database_1.db.prepare(`
      INSERT INTO notifications (id, user_id, notification_type, message)
      VALUES (?, ?, 'REQUEST_ACCEPTED', ?)
    `).run((0, uuid_1.v4)(), request.buyer_id, `Your request for "${request.event_name}" was approved! You have 10 minutes to complete payment and provide recipient info.`);
        for (const comp of rejectedCompetitors) {
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'REQUEST_CLOSED', 'Another buyer was approved for this ticket listing. Your request was closed.')
      `).run((0, uuid_1.v4)(), comp.buyer_id);
        }
        (0, audit_1.logAuditEvent)({
            actorId: sellerId,
            action: 'SELLER_APPROVED_REQUEST',
            resourceType: 'purchase_request',
            resourceId: String(requestId),
            outcome: 'SUCCESS',
            details: { reservationId, transactionId, reservationExpiresAt },
        });
        return { reservationId, transactionId, reservationExpiresAt };
    });
    try {
        const result = executeAtomicAccept();
        res.json({
            message: 'Request approved. Listing is now atomically reserved for the buyer for 10 minutes.',
            ...result,
        });
    }
    catch (err) {
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Failed to approve request' });
    }
});
// POST /api/v1/requests/:id/reject
exports.requestRouter.post('/requests/:id/reject', auth_1.authenticate, (req, res) => {
    const requestId = req.params.id;
    const sellerId = req.user.id;
    const request = database_1.db.prepare('SELECT * FROM purchase_requests WHERE id = ?').get(requestId);
    if (!request) {
        res.status(404).json({ error: 'Request not found.' });
        return;
    }
    if (request.seller_id !== sellerId && req.user.role !== 'admin') {
        res.status(403).json({ error: 'Unauthorized.' });
        return;
    }
    database_1.db.prepare(`
    UPDATE purchase_requests
    SET request_status = 'rejected'
    WHERE id = ?
  `).run(requestId);
    database_1.db.prepare(`
    INSERT INTO notifications (id, user_id, notification_type, message)
    VALUES (?, ?, 'REQUEST_REJECTED', 'The seller declined your ticket purchase request.')
  `).run((0, uuid_1.v4)(), request.buyer_id);
    (0, audit_1.logAuditEvent)({
        actorId: sellerId,
        action: 'SELLER_REJECTED_REQUEST',
        resourceType: 'purchase_request',
        resourceId: String(requestId),
        outcome: 'SUCCESS',
    });
    res.json({ message: 'Request rejected. Listing remains active for other buyers.' });
});
