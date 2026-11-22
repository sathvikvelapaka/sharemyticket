"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initDatabase = initDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// Ensure database directory exists
const dbDir = path_1.default.dirname(config_1.config.dbPath);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
exports.db = new better_sqlite3_1.default(config_1.config.dbPath);
// Enable WAL mode and foreign key constraints for concurrency & integrity
exports.db.pragma('journal_mode = WAL');
exports.db.pragma('foreign_keys = ON');
function initDatabase() {
    exports.db.exec(`
    -- 1. users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('buyer', 'seller', 'admin', 'system')) NOT NULL DEFAULT 'buyer',
      email_verified INTEGER NOT NULL DEFAULT 0,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      account_status TEXT CHECK(account_status IN ('active', 'suspended', 'pending_verification')) NOT NULL DEFAULT 'active',
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      mfa_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. user_sessions
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash TEXT NOT NULL,
      device_information TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME
    );

    -- 3. ticket_providers
    CREATE TABLE IF NOT EXISTS ticket_providers (
      id TEXT PRIMARY KEY,
      provider_name TEXT NOT NULL,
      integration_type TEXT CHECK(integration_type IN ('official_api', 'adapter_simulated', 'manual')) NOT NULL,
      integration_status TEXT CHECK(integration_status IN ('active', 'maintenance', 'disabled')) NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. venues
    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      venue_name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );

    -- 5. events
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      event_category TEXT NOT NULL,
      event_date TEXT NOT NULL,
      city TEXT NOT NULL,
      venue_id TEXT NOT NULL REFERENCES venues(id)
    );

    -- 6. tickets
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES users(id),
      provider_id TEXT NOT NULL REFERENCES ticket_providers(id),
      event_id TEXT NOT NULL REFERENCES events(id),
      booking_reference_fingerprint TEXT NOT NULL,
      seat_category TEXT NOT NULL,
      seat_identifier_encrypted TEXT NOT NULL,
      original_price INTEGER NOT NULL, -- in paise
      currency TEXT NOT NULL DEFAULT 'INR',
      transfer_eligibility TEXT CHECK(transfer_eligibility IN ('eligible', 'ineligible', 'provider_confirmation_required', 'manual_review_required')) NOT NULL,
      ticket_status TEXT CHECK(ticket_status IN ('active', 'reserved', 'transferred', 'cancelled')) NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. ticket_evidence
    CREATE TABLE IF NOT EXISTS ticket_evidence (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      storage_key TEXT NOT NULL,
      file_type TEXT NOT NULL,
      encryption_metadata TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      retention_expiry DATETIME
    );

    -- 8. listings
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(id),
      seller_id TEXT NOT NULL REFERENCES users(id),
      original_price INTEGER NOT NULL, -- in paise
      resale_price INTEGER NOT NULL, -- in paise (must be <= original_price * 0.8)
      quantity INTEGER NOT NULL DEFAULT 1,
      listing_status TEXT CHECK(listing_status IN ('draft', 'submitted', 'under_review', 'approved', 'active', 'reserved', 'sold', 'rejected', 'expired', 'cancelled')) NOT NULL DEFAULT 'active',
      show_time TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. buyer_requirements
    CREATE TABLE IF NOT EXISTS buyer_requirements (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      event_id TEXT REFERENCES events(id),
      movie_title TEXT,
      preferred_venue_id TEXT REFERENCES venues(id),
      preferred_city TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT,
      maximum_budget INTEGER NOT NULL, -- in paise
      seat_category TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      requirement_status TEXT CHECK(requirement_status IN ('active', 'matched', 'fulfilled', 'cancelled')) NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. purchase_requests
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      seller_id TEXT NOT NULL REFERENCES users(id),
      requested_quantity INTEGER NOT NULL DEFAULT 1,
      request_status TEXT CHECK(request_status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    -- 11. reservations
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL UNIQUE REFERENCES listings(id),
      purchase_request_id TEXT NOT NULL REFERENCES purchase_requests(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      reservation_status TEXT CHECK(reservation_status IN ('active', 'expired', 'completed', 'cancelled')) NOT NULL DEFAULT 'active',
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );

    -- 12. recipient_details
    CREATE TABLE IF NOT EXISTS recipient_details (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL UNIQUE,
      encrypted_name TEXT NOT NULL,
      encrypted_email TEXT NOT NULL,
      encrypted_phone TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletion_due_at DATETIME
    );

    -- 13. transactions
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      buyer_id TEXT NOT NULL REFERENCES users(id),
      seller_id TEXT NOT NULL REFERENCES users(id),
      purchase_request_id TEXT NOT NULL REFERENCES purchase_requests(id),
      transaction_status TEXT CHECK(transaction_status IN ('created', 'payment_pending', 'paid_awaiting_transfer', 'transfer_initiated', 'transfer_confirmed', 'completed', 'disputed', 'refunded', 'failed', 'cancelled')) NOT NULL DEFAULT 'created',
      total_amount INTEGER NOT NULL, -- in paise
      currency TEXT NOT NULL DEFAULT 'INR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    -- 14. payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      gateway_order_id TEXT UNIQUE NOT NULL,
      gateway_payment_id TEXT,
      amount INTEGER NOT NULL, -- in paise
      currency TEXT NOT NULL DEFAULT 'INR',
      payment_status TEXT CHECK(payment_status IN ('created', 'pending', 'authorized', 'captured', 'settlement_pending', 'settled', 'failed', 'refund_initiated', 'refunded')) NOT NULL DEFAULT 'created',
      idempotency_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. transfers
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      provider_id TEXT NOT NULL REFERENCES ticket_providers(id),
      provider_transfer_reference TEXT UNIQUE,
      transfer_status TEXT CHECK(transfer_status IN ('not_started', 'awaiting_seller', 'initiated', 'awaiting_buyer_acceptance', 'provider_confirmed', 'failed', 'disputed')) NOT NULL DEFAULT 'not_started',
      initiated_at DATETIME,
      confirmed_at DATETIME,
      failure_reason TEXT
    );

    -- 16. refunds
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      gateway_refund_reference TEXT UNIQUE NOT NULL,
      refund_amount INTEGER NOT NULL,
      refund_status TEXT CHECK(refund_status IN ('pending', 'processed', 'failed')) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. fraud_alerts
    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      listing_id TEXT REFERENCES listings(id),
      transaction_id TEXT REFERENCES transactions(id),
      risk_score INTEGER NOT NULL,
      risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high')) NOT NULL,
      reason TEXT NOT NULL,
      review_status TEXT CHECK(review_status IN ('pending', 'reviewed', 'dismissed', 'action_taken')) NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      notification_type TEXT NOT NULL,
      message TEXT NOT NULL,
      read_status INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. disputes
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      raised_by TEXT NOT NULL REFERENCES users(id),
      dispute_category TEXT NOT NULL,
      description TEXT NOT NULL,
      dispute_status TEXT CHECK(dispute_status IN ('opened', 'under_review', 'resolved_refund', 'resolved_seller_paid', 'rejected')) NOT NULL DEFAULT 'opened',
      admin_decision TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );

    -- 20. audit_logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      correlation_id TEXT,
      outcome TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. ratings
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions(id),
      reviewer_id TEXT NOT NULL REFERENCES users(id),
      reviewee_id TEXT NOT NULL REFERENCES users(id),
      rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
      communication_rating INTEGER CHECK(communication_rating BETWEEN 1 AND 5),
      timely_transfer_rating INTEGER CHECK(timely_transfer_rating BETWEEN 1 AND 5),
      listing_accuracy_rating INTEGER CHECK(listing_accuracy_rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Performance and lookup indexes
    CREATE INDEX IF NOT EXISTS idx_tickets_fingerprint ON tickets(booking_reference_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(listing_status);
    CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_requests_listing ON purchase_requests(listing_id);
    CREATE INDEX IF NOT EXISTS idx_requests_seller ON purchase_requests(seller_id);
    CREATE INDEX IF NOT EXISTS idx_requests_buyer ON purchase_requests(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(reservation_status);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(transaction_status);
    CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);
    // Seed default data if database is fresh
    seedDefaultData();
}
function seedDefaultData() {
    const providerCount = exports.db.prepare('SELECT COUNT(*) as count FROM ticket_providers').get();
    if (providerCount.count > 0)
        return;
    const insertProvider = exports.db.prepare(`
    INSERT INTO ticket_providers (id, provider_name, integration_type, integration_status)
    VALUES (?, ?, ?, ?)
  `);
    insertProvider.run('provider-bms', 'BookMyShow (Simulated Adapter)', 'adapter_simulated', 'active');
    insertProvider.run('provider-paytm', 'Paytm Insider (Simulated Adapter)', 'adapter_simulated', 'active');
    // Seed Venues
    const insertVenue = exports.db.prepare(`
    INSERT INTO venues (id, venue_name, address, city, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    insertVenue.run('venue-hyd-kukatpally', 'PVR Forum Sujana Mall', 'Kukatpally Housing Board Colony, Hyderabad', 'Hyderabad', 17.4842, 78.3889);
    insertVenue.run('venue-hyd-banjara', 'INOX GVK One Mall', 'Road No. 1, Banjara Hills, Hyderabad', 'Hyderabad', 17.4193, 78.4487);
    insertVenue.run('venue-hyd-prasads', 'Prasads Multiplex (Large Screen)', 'Necklace Road, NTR Gardens, Hyderabad', 'Hyderabad', 17.4124, 78.4678);
    insertVenue.run('venue-blr-koramangala', 'PVR Nexus Mall', 'Hosur Road, Koramangala, Bangalore', 'Bangalore', 12.9345, 77.6111);
    insertVenue.run('venue-mum-oberoi', 'PVR Oberoi Mall', 'Western Express Hwy, Goregaon East, Mumbai', 'Mumbai', 19.1736, 72.8601);
    insertVenue.run('venue-del-saket', 'PVR Select CITYWALK', 'A-3 District Centre, Saket, New Delhi', 'Delhi', 28.5283, 77.2189);
    // Seed Events
    const insertEvent = exports.db.prepare(`
    INSERT INTO events (id, event_name, event_category, event_date, city, venue_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 172800000).toISOString().split('T')[0];
    insertEvent.run('event-dune-hyd-kukatpally', 'Dune: Part Two (IMAX 4K)', 'Movie', tomorrow, 'Hyderabad', 'venue-hyd-kukatpally');
    insertEvent.run('event-interstellar-hyd-prasads', 'Interstellar (70mm Experience)', 'Movie', tomorrow, 'Hyderabad', 'venue-hyd-prasads');
    insertEvent.run('event-avengers-blr', 'Avengers: Secret Wars', 'Movie', dayAfter, 'Bangalore', 'venue-blr-koramangala');
    insertEvent.run('event-coldplay-mum', 'Coldplay: Music of the Spheres', 'Concert', dayAfter, 'Mumbai', 'venue-mum-oberoi');
    // Seed Default Users
    const passwordHash = bcryptjs_1.default.hashSync('Password@123', 10);
    const insertUser = exports.db.prepare(`
    INSERT INTO users (id, full_name, email, phone, password_hash, role, email_verified, phone_verified, account_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertUser.run('user-buyer-1', 'Aarav Sharma (Buyer)', 'buyer@trustpass.com', '+919876543210', passwordHash, 'buyer', 1, 1, 'active');
    insertUser.run('user-seller-1', 'Vikram Reddy (Seller)', 'seller@trustpass.com', '+919876543211', passwordHash, 'seller', 1, 1, 'active');
    insertUser.run('user-admin-1', 'Platform Administrator', 'admin@trustpass.com', '+919876543212', passwordHash, 'admin', 1, 1, 'active');
    insertUser.run('user-fraud-1', 'Suspicious Actor', 'fraudster@trustpass.com', '+919876543213', passwordHash, 'seller', 1, 1, 'active');
    // Seed initial tickets and listings
    const insertTicket = exports.db.prepare(`
    INSERT INTO tickets (id, seller_id, provider_id, event_id, booking_reference_fingerprint, seat_category, seat_identifier_encrypted, original_price, currency, transfer_eligibility, ticket_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    // Crypto helper inline for seeding
    const crypto = require('crypto');
    const hmacKey = config_1.config.hmacSecret;
    const fp1 = crypto.createHmac('sha256', hmacKey).update('provider-bms:BMS-DUNE-8841').digest('hex');
    const fp2 = crypto.createHmac('sha256', hmacKey).update('provider-bms:BMS-INT-9920').digest('hex');
    insertTicket.run('ticket-101', 'user-seller-1', 'provider-bms', 'event-dune-hyd-kukatpally', fp1, 'IMAX Prime Recliner', 'K12, K13', 50000, 'INR', 'eligible', 'active');
    insertTicket.run('ticket-102', 'user-seller-1', 'provider-bms', 'event-interstellar-hyd-prasads', fp2, 'Large Screen Balcony', 'F18, F19', 40000, 'INR', 'eligible', 'active');
    const insertListing = exports.db.prepare(`
    INSERT INTO listings (id, ticket_id, seller_id, original_price, resale_price, quantity, listing_status, show_time, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    // 50000 paise (₹500) original price -> 80% is ₹400 (40000 paise). Reselling at ₹350 (35000 paise)
    const expireTomorrow = new Date(Date.now() + 86400000).toISOString();
    insertListing.run('listing-101', 'ticket-101', 'user-seller-1', 50000, 35000, 2, 'active', '07:30 PM', expireTomorrow);
    insertListing.run('listing-102', 'ticket-102', 'user-seller-1', 40000, 30000, 2, 'active', '09:00 PM', expireTomorrow);
}
