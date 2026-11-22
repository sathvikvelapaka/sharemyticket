"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateUserFraudRisk = evaluateUserFraudRisk;
const database_1 = require("../db/database");
const uuid_1 = require("uuid");
const audit_1 = require("../utils/audit");
function evaluateUserFraudRisk(userId, context) {
    let riskScore = 0;
    const signals = [];
    const reasons = [];
    // Signal 1: Duplicate ticket reference attempts (+40)
    if (context?.bookingRefFingerprint) {
        const existingTicket = database_1.db.prepare(`
      SELECT t.id, t.ticket_status, l.listing_status, t.seller_id
      FROM tickets t
      LEFT JOIN listings l ON l.ticket_id = t.id
      WHERE t.booking_reference_fingerprint = ?
    `).get(context.bookingRefFingerprint);
        if (existingTicket) {
            riskScore += 40;
            signals.push('DUPLICATE_REFERENCE_DETECTED');
            reasons.push('Attempt to list a booking reference that already exists in the system (+40)');
        }
    }
    // Signal 2: Unusually high listing volume within 24h (+20)
    const recentListings = database_1.db.prepare(`
    SELECT COUNT(*) as count FROM listings
    WHERE seller_id = ? AND datetime(created_at) >= datetime('now', '-24 hours')
  `).get(userId);
    if (recentListings.count >= 5) {
        riskScore += 20;
        signals.push('HIGH_LISTING_VOLUME');
        reasons.push(`High listing volume: ${recentListings.count} listings created in the past 24 hours (+20)`);
    }
    // Signal 3: Repeated failed transfers (+20)
    const failedTransfers = database_1.db.prepare(`
    SELECT COUNT(*) as count FROM transfers tr
    JOIN transactions tx ON tr.transaction_id = tx.id
    WHERE tx.seller_id = ? AND tr.transfer_status = 'failed'
  `).get(userId);
    if (failedTransfers.count > 0) {
        const penalty = Math.min(failedTransfers.count * 10, 30);
        riskScore += penalty;
        signals.push('FAILED_TRANSFERS_HISTORY');
        reasons.push(`History of ${failedTransfers.count} failed ticket transfer(s) (+${penalty})`);
    }
    // Signal 4: Repeated payment disputes (+15)
    const disputesAgainstUser = database_1.db.prepare(`
    SELECT COUNT(*) as count FROM disputes d
    JOIN transactions tx ON d.transaction_id = tx.id
    WHERE tx.seller_id = ?
  `).get(userId);
    if (disputesAgainstUser.count > 0) {
        riskScore += 15;
        signals.push('PAYMENT_DISPUTES_RECORD');
        reasons.push(`User has been involved in ${disputesAgainstUser.count} transaction dispute(s) (+15)`);
    }
    // Signal 5: Rapid request cancellation behavior (+10)
    const recentCancellations = database_1.db.prepare(`
    SELECT COUNT(*) as count FROM purchase_requests
    WHERE buyer_id = ? AND request_status = 'cancelled' AND datetime(created_at) >= datetime('now', '-24 hours')
  `).get(userId);
    if (recentCancellations.count >= 4) {
        riskScore += 10;
        signals.push('RAPID_CANCELLATIONS');
        reasons.push('Unusual frequency of purchase request cancellations (+10)');
    }
    // Determine Risk Level
    let riskLevel = 'low';
    if (riskScore >= 50) {
        riskLevel = 'high';
    }
    else if (riskScore >= 25) {
        riskLevel = 'medium';
    }
    const shouldBlock = riskLevel === 'high';
    // If medium or high, persist to fraud_alerts table for administrator review
    if (riskScore >= 25) {
        const alertId = (0, uuid_1.v4)();
        const reasonSummary = reasons.join('; ');
        database_1.db.prepare(`
      INSERT INTO fraud_alerts (id, user_id, listing_id, transaction_id, risk_score, risk_level, reason, review_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(alertId, userId, context?.listingId || null, context?.transactionId || null, riskScore, riskLevel, reasonSummary);
        (0, audit_1.logAuditEvent)({
            actorId: userId,
            action: 'FRAUD_RISK_ALERT_TRIGGERED',
            resourceType: 'user',
            resourceId: userId,
            outcome: 'FLAGGED',
            details: { riskScore, riskLevel, signals, reasons },
        });
    }
    return {
        riskScore,
        riskLevel,
        signals,
        reasons,
        shouldBlock,
    };
}
