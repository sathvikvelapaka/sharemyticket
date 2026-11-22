"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantRouter = void 0;
const express_1 = require("express");
const database_1 = require("../../db/database");
exports.assistantRouter = (0, express_1.Router)();
// Knowledge base entries for TrustPass
const FAQ_KNOWLEDGE_BASE = [
    {
        topic: 'Selling a ticket',
        keywords: ['how to sell', 'sell ticket', 'list ticket', 'create listing', 'sell movie'],
        answer: 'To sell a ticket you cannot attend: 1) Go to your Seller Dashboard and click "Create Listing". 2) Enter your movie, venue, showtime, original price, and booking reference. 3) Notice that TrustPass caps the resale price to a maximum of 80% of the original price to prevent scalping. 4) Upload your private ticket evidence (never shown publicly). 5) When an interested buyer requests the ticket, approve the request to temporarily reserve it while they complete payment.',
    },
    {
        topic: 'Official ticket transfer process',
        keywords: ['transfer work', 'official transfer', 'how transfer works', 'bookmyshow transfer'],
        answer: 'TrustPass does not generate replacement tickets. Once the buyer completes their payment on the secure sandbox gateway, the seller receives the buyer’s private recipient details (Name, Email, Mobile). The seller opens BookMyShow and uses its official transfer option. The buyer accepts the invitation, and TrustPass verifies completion through the provider adapter before releasing the seller’s settlement.',
    },
    {
        topic: 'Listing rejection reasons',
        keywords: ['why rejected', 'listing rejected', 'rejection', 'not approved'],
        answer: 'Listings are rejected if: 1) The resale price exceeds 80% of the original face value. 2) The booking reference has already been listed, reserved, or sold (duplicate protection). 3) The ticket provider flags the tier as ineligible for official transfer. 4) The scheduled event showtime has already passed.',
    },
    {
        topic: 'Refunds & Dispute Resolution',
        keywords: ['refund', 'request refund', 'money back', 'dispute'],
        answer: 'If a seller fails to transfer the ticket within the agreed window or the provider rejects the transfer, you can open a dispute directly from your Buyer Dashboard. An administrator will review provider event logs and payment status. Once verified, refunds are processed back to your original payment method via the gateway.',
    },
    {
        topic: 'Transfer pending meaning',
        keywords: ['transfer pending', 'what does transfer pending mean', 'awaiting acceptance'],
        answer: 'Transfer Pending means payment has been safely captured by TrustPass, and the transaction is waiting for the seller to initiate the official provider transfer or for the buyer to accept the provider invitation link.',
    },
    {
        topic: 'Fraud reporting',
        keywords: ['suspicious', 'fraud', 'report seller', 'fake ticket'],
        answer: 'You can report suspicious listings or users through the "Raise Dispute" button on any transaction, or notify the admin directly. TrustPass continuously monitors duplicate booking hashes, bulk listing patterns, and failed transfer spikes with automated risk scoring.',
    },
];
// POST /api/v1/assistant/chat (Official AI Help Assistant)
exports.assistantRouter.post('/chat', (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query string is required.' });
        return;
    }
    const q = query.toLowerCase();
    // Search knowledge base
    let bestMatch = FAQ_KNOWLEDGE_BASE.find((faq) => faq.keywords.some((kw) => q.includes(kw)));
    if (bestMatch) {
        res.json({
            reply: bestMatch.answer,
            topic: bestMatch.topic,
            source: 'TrustPass Verified Platform Policy',
        });
        return;
    }
    // Fallback helpful guidance with strict safety bounds
    res.json({
        reply: 'I am your TrustPass Assistant. I can guide you through: 1) Listing tickets under the 80% fair-price rule, 2) Safe request-and-approval workflows, 3) Location verification before purchasing, and 4) Authorized BookMyShow transfer verification. How can I help you today?',
        topic: 'General Assistance',
        source: 'TrustPass Help Center',
    });
});
// GET /api/v1/assistant/demand-analytics (Smart Demand & Resale Analytics)
exports.assistantRouter.get('/demand-analytics', (req, res) => {
    try {
        // Demand by movie
        const demandByMovie = database_1.db.prepare(`
      SELECT e.event_name, COUNT(br.id) as requirement_count
      FROM buyer_requirements br
      JOIN events e ON LOWER(e.event_name) LIKE '%' || LOWER(br.movie_title) || '%'
      GROUP BY e.event_name
      ORDER BY requirement_count DESC
      LIMIT 5
    `).all();
        // Listings by city
        const listingsByCity = database_1.db.prepare(`
      SELECT v.city, COUNT(l.id) as active_listings
      FROM listings l
      JOIN tickets t ON l.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      JOIN venues v ON e.venue_id = v.id
      WHERE l.listing_status = 'active'
      GROUP BY v.city
      ORDER BY active_listings DESC
    `).all();
        // Average savings/discount stats
        const stats = database_1.db.prepare(`
      SELECT 
        COUNT(id) as total_active_listings,
        AVG(original_price - resale_price) as avg_savings_paise,
        AVG(ROUND((original_price - resale_price) * 100.0 / original_price, 1)) as avg_discount_percent
      FROM listings
      WHERE listing_status = 'active'
    `).get();
        res.json({
            demandByMovie,
            listingsByCity,
            summary: {
                activeListings: stats?.total_active_listings || 0,
                avgSavingsRupees: stats?.avg_savings_paise ? Math.round(stats.avg_savings_paise / 100) : 0,
                avgDiscountPercent: stats?.avg_discount_percent ? Number(stats.avg_discount_percent.toFixed(1)) : 0,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch analytics', message: err.message });
    }
});
