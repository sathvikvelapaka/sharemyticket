"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ratingRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const database_1 = require("../../db/database");
const auth_1 = require("../../middleware/auth");
const audit_1 = require("../../utils/audit");
exports.ratingRouter = (0, express_1.Router)();
const RatingSchema = zod_1.z.object({
    transactionId: zod_1.z.string(),
    rating: zod_1.z.number().int().min(1).max(5),
    communicationRating: zod_1.z.number().int().min(1).max(5).optional(),
    timelyTransferRating: zod_1.z.number().int().min(1).max(5).optional(),
    listingAccuracyRating: zod_1.z.number().int().min(1).max(5).optional(),
    comment: zod_1.z.string().max(500).optional(),
});
// POST /api/v1/ratings (Submit verified post-transaction rating)
exports.ratingRouter.post('/', auth_1.authenticate, (req, res) => {
    try {
        const data = RatingSchema.parse(req.body);
        const reviewerId = req.user.id;
        // Must be a verified completed transaction (Rule: Only verified completed transactions qualify)
        const tx = database_1.db.prepare('SELECT * FROM transactions WHERE id = ?').get(data.transactionId);
        if (!tx) {
            res.status(404).json({ error: 'Transaction not found.' });
            return;
        }
        if (tx.transaction_status !== 'completed') {
            res.status(400).json({ error: 'Ratings can only be submitted for completed transactions.' });
            return;
        }
        // Determine who is reviewing whom
        let revieweeId;
        if (reviewerId === tx.buyer_id) {
            revieweeId = tx.seller_id;
        }
        else if (reviewerId === tx.seller_id) {
            revieweeId = tx.buyer_id;
        }
        else {
            res.status(403).json({ error: 'Unauthorized: You are not a party in this transaction.' });
            return;
        }
        // Anti-Self-Rating rule
        if (reviewerId === revieweeId) {
            res.status(400).json({ error: 'Users cannot rate their own accounts.' });
            return;
        }
        // Check for duplicate rating
        const existing = database_1.db.prepare('SELECT id FROM ratings WHERE transaction_id = ? AND reviewer_id = ?').get(data.transactionId, reviewerId);
        if (existing) {
            res.status(409).json({ error: 'You have already submitted a rating for this transaction.' });
            return;
        }
        const ratingId = (0, uuid_1.v4)();
        database_1.db.prepare(`
      INSERT INTO ratings (
        id, transaction_id, reviewer_id, reviewee_id, rating,
        communication_rating, timely_transfer_rating, listing_accuracy_rating, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ratingId, data.transactionId, reviewerId, revieweeId, data.rating, data.communicationRating || data.rating, data.timelyTransferRating || data.rating, data.listingAccuracyRating || data.rating, data.comment || null);
        (0, audit_1.logAuditEvent)({
            actorId: reviewerId,
            action: 'RATING_SUBMITTED',
            resourceType: 'rating',
            resourceId: ratingId,
            outcome: 'SUCCESS',
            details: { transactionId: data.transactionId, revieweeId, score: data.rating },
        });
        res.status(201).json({
            message: 'Verified rating submitted successfully. Thank you for building trust on TrustPass!',
            ratingId,
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Validation error', details: err.issues || err.errors });
            return;
        }
        res.status(500).json({ error: 'Failed to submit rating', message: err.message });
    }
});
