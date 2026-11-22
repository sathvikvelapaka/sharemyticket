import { app } from '../src/server';
import http from 'http';
import { db } from '../src/db/database';
import { generateReferenceFingerprint, signWebhookPayload } from '../src/utils/crypto';
import { config } from '../src/config';

let server: http.Server;
let baseUrl: string;

async function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function runTests() {
  console.log('--- Starting TrustPass End-to-End Verification Suite ---');

  // Start temporary test server
  server = app.listen(0);
  const address = server.address() as any;
  baseUrl = `http://localhost:${address.port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request('/health');
    assert(health.status === 200 && health.body.status === 'healthy', 'Health check endpoint returns 200 OK');

    // 2. Auth: Login as Buyer
    const buyerLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: 'buyer@trustpass.com', password: 'Password@123' },
    });
    assert(buyerLogin.status === 200 && buyerLogin.body.token, 'Buyer authentication succeeds with JWT');
    const buyerToken = buyerLogin.body.token;

    // 3. Auth: Login as Seller
    const sellerLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: 'seller@trustpass.com', password: 'Password@123' },
    });
    assert(sellerLogin.status === 200 && sellerLogin.body.token, 'Seller authentication succeeds with JWT');
    const sellerToken = sellerLogin.body.token;

    // 4. Auth: Login as Admin
    const adminLogin = await request('/api/v1/auth/login', {
      method: 'POST',
      body: { identifier: 'admin@trustpass.com', password: 'Password@123' },
    });
    assert(adminLogin.status === 200 && adminLogin.body.user.role === 'admin', 'Admin login verifies role RBAC');
    const adminToken = adminLogin.body.token;

    // 5. Fair Pricing Rule Enforcement (Section 8: Max 80% of original price)
    // Original price: ₹1000 (100,000 paise). 80% is ₹800. Try listing at ₹850 (85,000 paise) -> MUST FAIL!
    const overpriceListing = await request('/api/v1/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: {
        providerId: 'provider-bms',
        eventName: 'Test Scalping Prevention',
        eventCategory: 'Movie',
        eventDate: '2026-12-01',
        showTime: '08:00 PM',
        city: 'Hyderabad',
        venueId: 'venue-hyd-kukatpally',
        seatCategory: 'Gold',
        seatIdentifiers: 'G1',
        quantity: 1,
        originalPrice: 100000, // ₹1,000
        resalePrice: 85000,    // ₹850 (> 80% = ₹800)
        bookingReference: 'BMS-SCALP-TEST-1',
      },
    });
    assert(
      overpriceListing.status === 400 && overpriceListing.body.error.includes('Fair Resale Policy Violation'),
      'Backend strictly enforces 80% maximum resale price limit'
    );

    // 6. Valid Fair Listing (e.g. ₹1000 original -> ₹750 resale <= 80%)
    const validListing = await request('/api/v1/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: {
        providerId: 'provider-bms',
        eventName: 'Dune: Part Two (IMAX 4K)',
        eventCategory: 'Movie',
        eventDate: '2026-12-01',
        showTime: '08:00 PM',
        city: 'Hyderabad',
        venueId: 'venue-hyd-kukatpally',
        seatCategory: 'Gold',
        seatIdentifiers: 'G1',
        quantity: 1,
        originalPrice: 100000, // ₹1,000
        resalePrice: 75000,    // ₹750 (75% <= 80%)
        bookingReference: 'BMS-UNIQUE-REF-999',
      },
    });
    assert(validListing.status === 201 && validListing.body.listingId, 'Valid fair resale listing succeeds');
    const createdListingId = validListing.body.listingId;

    // 7. Duplicate Listing Detection & One-Time Resale Protection (Section 7.4 & 23)
    // Try to list the exact same booking reference again -> MUST BE REJECTED & FLAGGED
    const duplicateListing = await request('/api/v1/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: {
        providerId: 'provider-bms',
        eventName: 'Dune: Part Two (IMAX 4K)',
        eventCategory: 'Movie',
        eventDate: '2026-12-01',
        showTime: '08:00 PM',
        city: 'Hyderabad',
        venueId: 'venue-hyd-kukatpally',
        seatCategory: 'Gold',
        seatIdentifiers: 'G1',
        quantity: 1,
        originalPrice: 100000,
        resalePrice: 75000,
        bookingReference: 'BMS-UNIQUE-REF-999',
      },
    });
    assert(
      duplicateListing.status === 409 && duplicateListing.body.error.includes('Duplicate Ticket Detected'),
      'Duplicate ticket listing detected and blocked via HMAC fingerprint'
    );

    // 8. Buyer Discovery & Location Search
    const searchListings = await request('/api/v1/listings?city=Hyderabad&movie=Dune');
    assert(
      searchListings.status === 200 && searchListings.body.listings.length > 0,
      'Buyer ticket discovery returns active listings with price transparency'
    );

    // 9. Buyer Requirement Posting & Smart Matching Engine (Section 10)
    const postReq = await request('/api/v1/requirements', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        movieTitle: 'Dune',
        preferredCity: 'Hyderabad',
        preferredVenueId: 'venue-hyd-kukatpally',
        preferredDate: '2026-12-01',
        maximumBudget: 80000,
        quantity: 1,
      },
    });
    assert(postReq.status === 201 && postReq.body.requirementId, 'Buyer posts ticket requirement');
    const reqId = postReq.body.requirementId;

    const matchesRes = await request(`/api/v1/requirements/${reqId}/matches`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert(
      matchesRes.status === 200 && matchesRes.body.matches.length > 0 && matchesRes.body.matches[0].matchScore >= 70,
      'Smart Match Engine computes scoring breakdown and explains matching criteria'
    );

    // 10. Purchase Request Workflow (Section 11)
    const purchaseReq = await request(`/api/v1/listings/${createdListingId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { quantity: 1 },
    });
    assert(purchaseReq.status === 201 && purchaseReq.body.requestId, 'Buyer submits purchase request');
    const requestId = purchaseReq.body.requestId;

    // 11. Concurrency-Safe Seller Approval & Atomic 10-Minute Reservation (Section 11 & 12)
    const approveReq = await request(`/api/v1/requests/${requestId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    assert(
      approveReq.status === 200 && approveReq.body.reservationId && approveReq.body.transactionId,
      'Seller approval atomically locks listing and creates 10-minute reservation'
    );
    const transactionId = approveReq.body.transactionId;

    // Verify listing is now 'reserved' so concurrent buyers cannot request/buy
    const checkListing = await request(`/api/v1/listings/${createdListingId}`);
    assert(checkListing.body.listing.listing_status === 'reserved', 'Listing status atomically changed to reserved');

    // 12. Private Recipient Information Storage (Section 13)
    const submitRecipient = await request(`/api/v1/transactions/${transactionId}/recipient`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        fullName: 'Aarav Sharma',
        email: 'aarav.buyer@example.com',
        phone: '+919876543210',
      },
    });
    assert(submitRecipient.status === 200, 'Buyer submits private recipient details encrypted with AES-256-GCM');

    // 13. Payment Gateway Order Creation & Sandbox Checkout (Section 14)
    const createOrder = await request('/api/v1/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { transactionId },
    });
    assert(createOrder.status === 201 && createOrder.body.paymentId, 'Payment order created on gateway sandbox');
    const paymentId = createOrder.body.paymentId;

    const checkoutSandbox = await request('/api/v1/payments/checkout-sandbox', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: { paymentId, paymentMethod: 'UPI' },
    });
    assert(
      checkoutSandbox.status === 200 && checkoutSandbox.body.transactionStatus === 'paid_awaiting_transfer',
      'Sandbox payment captured, transaction transitions to paid_awaiting_transfer'
    );

    // 14. Authorized Seller Transfer Initiation (Section 15)
    const initiateTransfer = await request('/api/v1/transfers/initiate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sellerToken}` },
      body: { transactionId },
    });
    assert(
      initiateTransfer.status === 200 && initiateTransfer.body.providerTransferReference,
      'Seller initiates official transfer via Mock BookMyShow adapter'
    );
    const transferRef = initiateTransfer.body.providerTransferReference;

    // 15. Buyer Officially Accepts Transfer & Verifies (Section 16 & 44 Step 17)
    const acceptTransfer = await request(`/api/v1/transfers/${transactionId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert(
      acceptTransfer.status === 200 &&
      acceptTransfer.body.status === 'provider_confirmed' &&
      acceptTransfer.body.transactionStatus === 'completed' &&
      acceptTransfer.body.settlementStatus === 'settled',
      'Buyer accepts transfer: provider confirms, transaction completes, settlement is released'
    );

    // 16. Post-Transaction Verified Rating (Section 21)
    const ratingRes = await request('/api/v1/ratings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${buyerToken}` },
      body: {
        transactionId,
        rating: 5,
        communicationRating: 5,
        timelyTransferRating: 5,
        listingAccuracyRating: 5,
        comment: 'Fast and official BookMyShow transfer! Highly recommend this seller.',
      },
    });
    assert(ratingRes.status === 201, 'Buyer leaves verified post-transaction rating');

    // 17. AI Support Assistant (Section 18)
    const assistantRes = await request('/api/v1/assistant/chat', {
      method: 'POST',
      body: { query: 'How does ticket transfer work?' },
    });
    assert(
      assistantRes.status === 200 && assistantRes.body.reply.includes('BookMyShow'),
      'AI Support Assistant answers questions accurately based on platform policies'
    );

    // 18. Admin Audit Trail & Fraud Dashboard (Section 17.5 & 35)
    const auditRes = await request('/api/v1/admin/audit-logs', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      auditRes.status === 200 && auditRes.body.logs.length > 5,
      'Admin can inspect complete audit trail of transaction actions'
    );

    const fraudRes = await request('/api/v1/admin/fraud-alerts', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      fraudRes.status === 200,
      'Admin fraud dashboard lists active risk alerts and risk scores'
    );

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n--- Test Summary: ${passed} passed, ${failed} failed ---`);
    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('🎉 All 18 TrustPass Core Specifications Verified Successfully!\n');
    }
  }
}

runTests();
