import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../../db/database';
import { authenticate, AuthenticatedRequest } from '../../middleware/auth';
import { logAuditEvent } from '../../utils/audit';

export const ratingRouter = Router();

const RatingSchema = z.object({
  transactionId: z.string(),
  rating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5).optional(),
  timelyTransferRating: z.number().int().min(1).max(5).optional(),
  listingAccuracyRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(500).optional(),
});

// POST /api/v1/ratings (Submit verified post-transaction rating)
ratingRouter.post('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const data = RatingSchema.parse(req.body);
    const reviewerId = req.user!.id;

    // Must be a verified completed transaction (Rule: Only verified completed transactions qualify)
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(data.transactionId) as any;
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    if (tx.transaction_status !== 'completed') {
      res.status(400).json({ error: 'Ratings can only be submitted for completed transactions.' });
      return;
    }

    // Determine who is reviewing whom
    let revieweeId: string;
    if (reviewerId === tx.buyer_id) {
      revieweeId = tx.seller_id;
    } else if (reviewerId === tx.seller_id) {
      revieweeId = tx.buyer_id;
    } else {
      res.status(403).json({ error: 'Unauthorized: You are not a party in this transaction.' });
      return;
    }

    // Anti-Self-Rating rule
    if (reviewerId === revieweeId) {
      res.status(400).json({ error: 'Users cannot rate their own accounts.' });
      return;
    }

    // Check for duplicate rating
    const existing = db.prepare('SELECT id FROM ratings WHERE transaction_id = ? AND reviewer_id = ?').get(data.transactionId, reviewerId);
    if (existing) {
      res.status(409).json({ error: 'You have already submitted a rating for this transaction.' });
      return;
    }

    const ratingId = uuidv4();
    db.prepare(`
      INSERT INTO ratings (
        id, transaction_id, reviewer_id, reviewee_id, rating,
        communication_rating, timely_transfer_rating, listing_accuracy_rating, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ratingId,
      data.transactionId,
      reviewerId,
      revieweeId,
      data.rating,
      data.communicationRating || data.rating,
      data.timelyTransferRating || data.rating,
      data.listingAccuracyRating || data.rating,
      data.comment || null
    );

    logAuditEvent({
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
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: (err as any).issues || (err as any).errors });
      return;
    }
    res.status(500).json({ error: 'Failed to submit rating', message: err.message });
  }
});
