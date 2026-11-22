# TrustPass (a.k.a. ShareMyTicket)

**A secure, request‑based ticket resale and authorized transfer platform**

---

## 📖 Project Overview
TrustPass enables ticket owners who cannot attend an event to safely sell their tickets to verified buyers. The platform orchestrates the entire workflow – from listing to payment, to official transfer with the original ticket provider – while preventing fraud, duplicate sales, and price gouging.

## ✨ Core Features
- **Buyer & Seller roles** with strict permission boundaries
- **Request‑based workflow** – a buyer sends a purchase request, the seller approves, then the ticket is reserved.
- **Escrow‑style payment** – funds are held until the official transfer is confirmed.
- **Price‑cap enforcement** (max 80 % of original price)
- **Duplicate‑ticket detection** using HMAC‑SHA256 fingerprinting
- **End‑to‑end encryption** of transfer data (AES‑256‑GCM) on the client side
- **Dispute & refund management** with full audit trails
- **Simple UI** that mimics BookMyShow for a familiar experience

## 🛠️ How TrustPass Works (Plain Language)
1. **Seller lists a ticket** – provides event details and a private screenshot of the ticket.
2. **Buyer requests to buy** – selects a listing, adds a request note, and submits.
3. **Seller approves** – reviews the buyer’s info and reserves the ticket.
4. **Buyer pays** – payment is captured in escrow.
5. **Seller initiates the official transfer** with the original provider (mocked in this demo).
6. **Buyer accepts the transfer** – receives a QR‑code that can be scanned at the venue.
7. **Settlement** – once the transfer is verified, the seller receives the payment.

If anything goes wrong (e.g., failed transfer, dispute), the platform logs the event and can initiate a refund.

## 📚 Documentation
- **Quick‑Start guide** – step‑by‑step instructions for developers and beginners: [`QUICK_START.md`](QUICK_START.md)
- **Architecture details** – layers, components, data flow, and security mechanisms: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## 🚀 Quick Start
See the dedicated guide: [`QUICK_START.md`](QUICK_START.md).

## 🤝 Contribution
We welcome contributions! Please read the **Contribution Guidelines** in the Quick‑Start guide for branching strategy, linting, testing, and PR process.

---

*Project name in documentation: **ShareMyTicket** (repo folder remains `trustpass`).*
