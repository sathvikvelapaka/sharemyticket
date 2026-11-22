import { db } from '../db/database';
import { logAuditEvent } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

export function runExpirationWorker(): void {
  try {
    const nowIso = new Date().toISOString();

    // 1. Expire timed-out reservations (e.g. 10 minutes exceeded without successful payment)
    const expiredReservations = db.prepare(`
      SELECT r.id, r.listing_id, r.purchase_request_id, r.buyer_id, l.seller_id
      FROM reservations r
      JOIN listings l ON r.listing_id = l.id
      WHERE r.reservation_status = 'active'
        AND r.expires_at <= ?
    `).all(nowIso) as Array<{ id: string; listing_id: string; purchase_request_id: string; buyer_id: string; seller_id: string }>;

    for (const res of expiredReservations) {
      // Check if a captured payment exists for this reservation's request
      const tx = db.prepare(`
        SELECT t.id, t.transaction_status, p.payment_status
        FROM transactions t
        LEFT JOIN payments p ON p.transaction_id = t.id
        WHERE t.purchase_request_id = ?
      `).get(res.purchase_request_id) as { id: string; transaction_status: string; payment_status: string } | undefined;

      if (tx && (tx.payment_status === 'captured' || tx.payment_status === 'settled')) {
        // Payment was completed; do not expire
        continue;
      }

      // Mark reservation expired
      db.prepare(`
        UPDATE reservations
        SET reservation_status = 'expired'
        WHERE id = ?
      `).run(res.id);

      // Revert listing to 'active' if it's currently 'reserved'
      db.prepare(`
        UPDATE listings
        SET listing_status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND listing_status = 'reserved'
      `).run(res.listing_id);

      // Update purchase request status to 'expired'
      db.prepare(`
        UPDATE purchase_requests
        SET request_status = 'expired'
        WHERE id = ?
      `).run(res.purchase_request_id);

      // Notify Buyer
      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'RESERVATION_EXPIRED', 'Your 10-minute reservation for ticket listing expired because payment was not completed.')
      `).run(uuidv4(), res.buyer_id);

      // Notify Seller
      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'RESERVATION_EXPIRED', 'The reservation on your listing expired. Your ticket listing is now active for other buyers.')
      `).run(uuidv4(), res.seller_id);

      logAuditEvent({
        actorId: 'system',
        action: 'RESERVATION_EXPIRED',
        resourceType: 'reservation',
        resourceId: res.id,
        outcome: 'SUCCESS',
        details: { listingId: res.listing_id, buyerId: res.buyer_id },
      });
    }

    // 2. Expire listings whose showtime / expiry has passed
    const expiredListings = db.prepare(`
      SELECT id, seller_id, expires_at
      FROM listings
      WHERE listing_status = 'active'
        AND expires_at <= ?
    `).all(nowIso) as Array<{ id: string; seller_id: string; expires_at: string }>;

    for (const listing of expiredListings) {
      db.prepare(`
        UPDATE listings
        SET listing_status = 'expired', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(listing.id);

      db.prepare(`
        INSERT INTO notifications (id, user_id, notification_type, message)
        VALUES (?, ?, 'LISTING_EXPIRED', 'Your ticket listing has expired because the scheduled event time has passed.')
      `).run(uuidv4(), listing.seller_id);

      logAuditEvent({
        actorId: 'system',
        action: 'LISTING_AUTO_EXPIRED',
        resourceType: 'listing',
        resourceId: listing.id,
        outcome: 'SUCCESS',
      });
    }
  } catch (err) {
    console.error('Error during expiration worker cycle:', err);
  }
}

// Start worker timer (every 15 seconds)
let workerInterval: NodeJS.Timeout | null = null;

export function startExpirationScheduler(): void {
  if (!workerInterval) {
    workerInterval = setInterval(runExpirationWorker, 15000);
    // Run immediate cycle
    runExpirationWorker();
  }
}

export function stopExpirationScheduler(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
