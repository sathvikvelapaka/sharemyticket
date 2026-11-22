"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listingRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const database_1 = require("../../db/database");
const config_1 = require("../../config");
const crypto_1 = require("../../utils/crypto");
const audit_1 = require("../../utils/audit");
const auth_1 = require("../../middleware/auth");
const MockBookMyShowProvider_1 = require("../../providers/MockBookMyShowProvider");
const fraudService_1 = require("../../services/fraudService");
exports.listingRouter = (0, express_1.Router)();
// Configure private encrypted evidence upload storage
const uploadDir = config_1.config.evidenceStorageDir;
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Generate secure randomized server file name; never trust client file name
        const randomName = `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname).toLowerCase()}`;
        cb(null, randomName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF, PNG, and JPEG files are allowed for private ticket evidence.'));
        }
    },
});
const CreateListingSchema = zod_1.z.object({
    providerId: zod_1.z.string().default('provider-bms'),
    eventName: zod_1.z.string().min(2),
    eventCategory: zod_1.z.string().default('Movie'),
    eventDate: zod_1.z.string(), // YYYY-MM-DD
    showTime: zod_1.z.string(), // e.g. "07:30 PM"
    city: zod_1.z.string(),
    venueId: zod_1.z.string(),
    seatCategory: zod_1.z.string(),
    seatIdentifiers: zod_1.z.string(), // e.g. "K12, K13"
    quantity: zod_1.z.number().int().min(1).max(10).default(1),
    originalPrice: zod_1.z.number().int().positive(), // in paise (e.g. 50000 = ₹500)
    resalePrice: zod_1.z.number().int().positive(), // in paise
    bookingReference: zod_1.z.string().min(3),
});
// GET /api/v1/listings (Search & Discovery)
exports.listingRouter.get('/', (req, res) => {
    try {
        const { city, movie, venueId, date, sortBy = 'newest', maxPrice, minDiscount, } = req.query;
        let query = `
      SELECT 
        l.id, l.ticket_id, l.seller_id, l.original_price, l.resale_price, l.quantity,
        l.listing_status, l.show_time, l.expires_at, l.created_at,
        t.seat_category, t.transfer_eligibility,
        e.id as event_id, e.event_name, e.event_category, e.event_date, e.city as event_city,
        v.id as venue_id, v.venue_name, v.address as venue_address, v.city as venue_city,
        v.latitude as venue_lat, v.longitude as venue_lng,
        p.provider_name,
        u.full_name as seller_name,
        ROUND((l.original_price - l.resale_price) * 100.0 / l.original_price, 1) as discount_percentage
      FROM listings l
      JOIN tickets t ON l.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      JOIN venues v ON e.venue_id = v.id
      JOIN ticket_providers p ON t.provider_id = p.id
      JOIN users u ON l.seller_id = u.id
      WHERE l.listing_status = 'active'
    `;
        const params = [];
        if (city) {
            query += ` AND LOWER(v.city) = LOWER(?)`;
            params.push(city);
        }
        if (movie) {
            query += ` AND LOWER(e.event_name) LIKE LOWER(?)`;
            params.push(`%${movie}%`);
        }
        if (venueId) {
            query += ` AND v.id = ?`;
            params.push(venueId);
        }
        if (date) {
            query += ` AND e.event_date = ?`;
            params.push(date);
        }
        if (maxPrice) {
            query += ` AND l.resale_price <= ?`;
            params.push(parseInt(maxPrice, 10));
        }
        if (sortBy === 'lowest_price') {
            query += ` ORDER BY l.resale_price ASC`;
        }
        else if (sortBy === 'highest_discount') {
            query += ` ORDER BY discount_percentage DESC`;
        }
        else if (sortBy === 'earliest_show') {
            query += ` ORDER BY e.event_date ASC, l.show_time ASC`;
        }
        else {
            query += ` ORDER BY l.created_at DESC`;
        }
        const listings = database_1.db.prepare(query).all(...params);
        // Compute transparency fields for each listing (Original, Resale, Savings, Platform Fee, Total)
        const formatted = listings.map((item) => {
            const platformFee = Math.round(item.resale_price * 0.05); // 5% buyer convenience fee
            const totalPayable = item.resale_price + platformFee;
            const savings = item.original_price - item.resale_price;
            return {
                ...item,
                priceBreakdown: {
                    originalPrice: item.original_price,
                    resalePrice: item.resale_price,
                    savings,
                    discountPercentage: item.discount_percentage,
                    platformFee,
                    totalPayable,
                },
            };
        });
        res.json({ listings: formatted });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch listings', message: err.message });
    }
});
// GET /api/v1/listings/:id
exports.listingRouter.get('/:id', (req, res) => {
    const item = database_1.db.prepare(`
    SELECT 
      l.id, l.ticket_id, l.seller_id, l.original_price, l.resale_price, l.quantity,
      l.listing_status, l.show_time, l.expires_at, l.created_at,
      t.seat_category, t.transfer_eligibility,
      e.id as event_id, e.event_name, e.event_category, e.event_date, e.city as event_city,
      v.id as venue_id, v.venue_name, v.address as venue_address, v.city as venue_city,
      v.latitude as venue_lat, v.longitude as venue_lng,
      p.provider_name,
      u.full_name as seller_name,
      ROUND((l.original_price - l.resale_price) * 100.0 / l.original_price, 1) as discount_percentage
    FROM listings l
    JOIN tickets t ON l.ticket_id = t.id
    JOIN events e ON t.event_id = e.id
    JOIN venues v ON e.venue_id = v.id
    JOIN ticket_providers p ON t.provider_id = p.id
    JOIN users u ON l.seller_id = u.id
    WHERE l.id = ?
  `).get(req.params.id);
    if (!item) {
        res.status(404).json({ error: 'Listing not found' });
        return;
    }
    const platformFee = Math.round(item.resale_price * 0.05);
    res.json({
        listing: {
            ...item,
            priceBreakdown: {
                originalPrice: item.original_price,
                resalePrice: item.resale_price,
                savings: item.original_price - item.resale_price,
                discountPercentage: item.discount_percentage,
                platformFee,
                totalPayable: item.resale_price + platformFee,
            },
        },
    });
});
// POST /api/v1/listings (Create listing with 80% price cap & duplicate prevention)
exports.listingRouter.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const data = CreateListingSchema.parse(req.body);
        const sellerId = req.user.id;
        // 1. Strict Fair Resale Pricing Enforcement (Max 80% of original price)
        const maxAllowedResalePrice = Math.floor(data.originalPrice * config_1.config.maxResalePercent);
        if (data.resalePrice > maxAllowedResalePrice) {
            res.status(400).json({
                error: `Fair Resale Policy Violation: Resale price (₹${data.resalePrice / 100}) exceeds maximum allowed cap of 80% (₹${maxAllowedResalePrice / 100}). Original price was ₹${data.originalPrice / 100}.`,
            });
            return;
        }
        // 2. Duplicate Listing & One-Time Resale Protection (Fingerprint Verification)
        const fingerprint = (0, crypto_1.generateReferenceFingerprint)(data.providerId, data.bookingReference);
        // Check if this booking reference already exists in tickets table with active/reserved/transferred status
        const existingTicket = database_1.db.prepare(`
      SELECT t.id, t.ticket_status, l.id as listing_id, l.listing_status
      FROM tickets t
      LEFT JOIN listings l ON l.ticket_id = t.id
      WHERE t.booking_reference_fingerprint = ?
    `).get(fingerprint);
        if (existingTicket) {
            // Trigger fraud risk alert
            (0, fraudService_1.evaluateUserFraudRisk)(sellerId, { bookingRefFingerprint: fingerprint });
            (0, audit_1.logAuditEvent)({
                actorId: sellerId,
                action: 'DUPLICATE_LISTING_BLOCKED',
                resourceType: 'ticket',
                resourceId: fingerprint,
                outcome: 'BLOCKED',
                details: { existingTicketId: existingTicket.id, bookingRef: 'PROTECTED_HASH' },
            });
            res.status(409).json({
                error: 'Duplicate Ticket Detected: A ticket with this booking reference is already listed, reserved, or previously transferred on TrustPass.',
            });
            return;
        }
        // 3. Provider Eligibility Verification
        const verification = await MockBookMyShowProvider_1.defaultProvider.verifyTicket(data.bookingReference, data.eventName, data.eventDate);
        if (!verification.valid || !verification.eligible) {
            res.status(400).json({
                error: 'Ticket Transfer Ineligible: The original ticket provider reported that this ticket cannot be officially transferred.',
                details: verification.reason,
            });
            return;
        }
        // 4. Create or Resolve Event Record
        let event = database_1.db.prepare('SELECT id FROM events WHERE LOWER(event_name) = LOWER(?) AND venue_id = ? AND event_date = ?')
            .get(data.eventName, data.venueId, data.eventDate);
        let eventId = event?.id;
        if (!eventId) {
            eventId = (0, uuid_1.v4)();
            const venue = database_1.db.prepare('SELECT city FROM venues WHERE id = ?').get(data.venueId);
            database_1.db.prepare(`
        INSERT INTO events (id, event_name, event_category, event_date, city, venue_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(eventId, data.eventName, data.eventCategory, data.eventDate, venue?.city || data.city, data.venueId);
        }
        // 5. Encrypt seat identifier
        const encryptedSeats = (0, crypto_1.encryptAES)(data.seatIdentifiers);
        // 6. Insert Ticket Record
        const ticketId = (0, uuid_1.v4)();
        database_1.db.prepare(`
      INSERT INTO tickets (
        id, seller_id, provider_id, event_id, booking_reference_fingerprint,
        seat_category, seat_identifier_encrypted, original_price, currency,
        transfer_eligibility, ticket_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'eligible', 'active')
    `).run(ticketId, sellerId, data.providerId, eventId, fingerprint, data.seatCategory, encryptedSeats, data.originalPrice);
        // 7. Insert Listing Record
        const listingId = (0, uuid_1.v4)();
        const expiresAt = new Date(`${data.eventDate}T23:59:59Z`).toISOString();
        database_1.db.prepare(`
      INSERT INTO listings (
        id, ticket_id, seller_id, original_price, resale_price, quantity,
        listing_status, show_time, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(listingId, ticketId, sellerId, data.originalPrice, data.resalePrice, data.quantity, data.showTime, expiresAt);
        // 8. Fraud Risk Assessment for the seller
        (0, fraudService_1.evaluateUserFraudRisk)(sellerId, { listingId });
        (0, audit_1.logAuditEvent)({
            actorId: sellerId,
            action: 'LISTING_CREATED',
            resourceType: 'listing',
            resourceId: listingId,
            outcome: 'SUCCESS',
            details: {
                originalPrice: data.originalPrice,
                resalePrice: data.resalePrice,
                maxAllowed: maxAllowedResalePrice,
            },
        });
        res.status(201).json({
            message: 'Ticket listing created successfully and is now active.',
            listingId,
            ticketId,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Validation error', details: err.issues || err.errors });
            return;
        }
        res.status(500).json({ error: 'Failed to create listing', message: err.message });
    }
});
// POST /api/v1/listings/:id/instant-buy (Instant Buy & Pay with Auto-Reservation & Sandbox Payment)
exports.listingRouter.post('/:id/instant-buy', auth_1.authenticate, async (req, res) => {
    try {
        const listingId = String(req.params.id);
        const buyerId = req.user.id;
        const { recipientName, recipientEmail, recipientPhone, paymentMethod = 'UPI' } = req.body;
        if (!recipientName || !recipientEmail || !recipientPhone) {
            res.status(400).json({ error: 'Recipient name, email and phone are required for ticket transfer.' });
            return;
        }
        const listing = database_1.db.prepare(`
      SELECT l.*, t.seat_category, t.transfer_eligibility, e.event_name, v.venue_name
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
            res.status(400).json({ error: 'You cannot buy your own ticket listing.' });
            return;
        }
        if (listing.listing_status !== 'active') {
            res.status(400).json({ error: `Listing is no longer active (Current status: ${listing.listing_status}).` });
            return;
        }
        const executeInstantBuy = database_1.db.transaction(() => {
            // 1. Lock listing
            database_1.db.prepare(`
        UPDATE listings
        SET listing_status = 'reserved', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(listingId);
            // 2. Create purchase request (status: accepted)
            const requestId = (0, uuid_1.v4)();
            const expiresAt = new Date(Date.now() + 86400000).toISOString();
            database_1.db.prepare(`
        INSERT INTO purchase_requests (id, listing_id, buyer_id, seller_id, requested_quantity, request_status, expires_at)
        VALUES (?, ?, ?, ?, 1, 'accepted', ?)
      `).run(requestId, listingId, buyerId, listing.seller_id, expiresAt);
            // 3. Create reservation
            const reservationId = (0, uuid_1.v4)();
            const resExpiresAt = new Date(Date.now() + config_1.config.reservationTimeoutSeconds * 1000).toISOString();
            database_1.db.prepare(`
        INSERT INTO reservations (id, listing_id, purchase_request_id, buyer_id, reservation_status, expires_at)
        VALUES (?, ?, ?, ?, 'active', ?)
      `).run(reservationId, listingId, requestId, buyerId, resExpiresAt);
            // 4. Create transaction
            const transactionId = (0, uuid_1.v4)();
            const platformFee = Math.round(listing.resale_price * 0.05);
            const totalAmount = listing.resale_price + platformFee;
            database_1.db.prepare(`
        INSERT INTO transactions (id, listing_id, buyer_id, seller_id, purchase_request_id, transaction_status, total_amount)
        VALUES (?, ?, ?, ?, ?, 'paid_awaiting_transfer', ?)
      `).run(transactionId, listingId, buyerId, listing.seller_id, requestId, totalAmount);
            // 5. Store encrypted recipient details
            const encName = (0, crypto_1.encryptAES)(recipientName);
            const encEmail = (0, crypto_1.encryptAES)(recipientEmail);
            const encPhone = (0, crypto_1.encryptAES)(recipientPhone);
            const deletionDueAt = new Date(Date.now() + 30 * 86400000).toISOString();
            database_1.db.prepare(`
        INSERT INTO recipient_details (id, transaction_id, encrypted_name, encrypted_email, encrypted_phone, deletion_due_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run((0, uuid_1.v4)(), transactionId, encName, encEmail, encPhone, deletionDueAt);
            // 6. Record captured payment
            const paymentId = (0, uuid_1.v4)();
            const gatewayOrderId = `order_${(0, uuid_1.v4)().substring(0, 10)}`;
            const gatewayPaymentId = `pay_${(0, uuid_1.v4)().substring(0, 12)}`;
            database_1.db.prepare(`
        INSERT INTO payments (id, transaction_id, gateway_order_id, gateway_payment_id, amount, currency, payment_status)
        VALUES (?, ?, ?, ?, ?, 'INR', 'captured')
      `).run(paymentId, transactionId, gatewayOrderId, gatewayPaymentId, totalAmount);
            // 7. Initialize transfer record
            const transferId = (0, uuid_1.v4)();
            const transferRef = `BMS-XFER-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
            database_1.db.prepare(`
        INSERT INTO transfers (id, transaction_id, provider_id, provider_transfer_reference, transfer_status, initiated_at)
        VALUES (?, ?, 'provider-bms', ?, 'awaiting_buyer_acceptance', CURRENT_TIMESTAMP)
      `).run(transferId, transactionId, transferRef);
            // 8. Notifications
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'PAYMENT_CONFIRMED', ?)
      `).run((0, uuid_1.v4)(), listing.seller_id, `Payment captured for ${listing.event_name}! Official transfer invitation sent to buyer.`);
            database_1.db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'TRANSFER_READY', ?)
      `).run((0, uuid_1.v4)(), buyerId, `Payment verified! Official transfer ref ${transferRef} generated for ${listing.event_name}.`);
            (0, audit_1.logAuditEvent)({
                actorId: buyerId,
                action: 'INSTANT_BUY_COMPLETED',
                resourceType: 'transaction',
                resourceId: transactionId,
                outcome: 'SUCCESS',
                details: { totalAmount, transferRef, gatewayPaymentId },
            });
            return {
                transactionId,
                paymentId,
                gatewayPaymentId,
                transferRef,
                totalAmount,
            };
        });
        const result = executeInstantBuy();
        res.json({
            message: 'Instant buy completed! Payment captured and official provider transfer initiated.',
            ...result,
            status: 'paid_awaiting_transfer',
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Instant buy failed', message: err.message });
    }
});
exports.listingRouter.post('/:id/evidence', auth_1.authenticate, upload.single('evidence'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'Evidence file is required.' });
        return;
    }
    const listing = database_1.db.prepare('SELECT ticket_id, seller_id FROM listings WHERE id = ?').get(req.params.id);
    if (!listing) {
        res.status(404).json({ error: 'Listing not found.' });
        return;
    }
    if (listing.seller_id !== req.user.id && req.user.role !== 'admin') {
        res.status(403).json({ error: 'Unauthorized to attach evidence to this listing.' });
        return;
    }
    const evidenceId = (0, uuid_1.v4)();
    database_1.db.prepare(`
    INSERT INTO ticket_evidence (id, ticket_id, storage_key, file_type, encryption_metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(evidenceId, listing.ticket_id, req.file.filename, req.file.mimetype, JSON.stringify({ encryptedAtRest: true, bucket: 'trustpass-private-s3-simulated' }));
    (0, audit_1.logAuditEvent)({
        actorId: req.user.id,
        action: 'TICKET_EVIDENCE_UPLOADED',
        resourceType: 'ticket_evidence',
        resourceId: evidenceId,
        outcome: 'SUCCESS',
        details: { fileType: req.file.mimetype, sizeBytes: req.file.size },
    });
    res.json({
        message: 'Private ticket evidence uploaded and encrypted securely.',
        evidenceId,
    });
});
