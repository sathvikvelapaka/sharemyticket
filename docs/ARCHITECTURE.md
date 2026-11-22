# Architecture Overview

## 1️⃣ High‑Level System Architecture
````mermaid
flowchart LR
    subgraph Client
        Browser[Browser (React/Vite)]
        QR[QR‑code Viewer]
    end
    subgraph API_Gateway[API Gateway]
        HTTP[HTTP (REST)]
    end
    subgraph Backend[Backend Services]
        Auth[Auth Service]
        Listings[Listing Service]
        Requests[Request Service]
        Payments[Payment/Escrow Service]
        Transfer[Transfer Service]
        Dispute[Dispute & Refund Service]
        DB[(SQLite DB)]
    end
    subgraph External[External Mock Provider]
        Provider[BookMyShow Mock API]
    end
    Browser -->|API Calls| HTTP
    HTTP --> Auth
    HTTP --> Listings
    HTTP --> Requests
    HTTP --> Payments
    HTTP --> Transfer
    HTTP --> Dispute
    Auth --> DB
    Listings --> DB
    Requests --> DB
    Payments --> DB
    Transfer --> DB
    Dispute --> DB
    Transfer --> Provider
    Provider -->|Transfer Confirmation| Transfer
````

The **client** (React SPA) talks to the **backend** via a thin API gateway. All domain logic lives in separate services, each persisting to a shared SQLite database. The **Transfer Service** communicates with the external ticket provider (mocked in this demo). Payments are held in escrow until the transfer succeeds.

## 2️⃣ Core Buyer‑Seller Flow
````mermaid
flowchart TD
    Seller[Seller lists ticket] -->|listing saved| ListingsService
    Buyer[Buyer browses listings] -->|selects| ListingsService
    Buyer -->|sends purchase request| RequestService
    Seller -->|approves request| RequestService
    RequestService -->|reserve ticket| ListingsService
    Buyer -->|makes payment| PaymentService
    PaymentService -->|escrow hold| DB
    Seller -->|calls provider transfer| TransferService
    TransferService -->|mock API call| ProviderMock
    ProviderMock -->|transfer success| TransferService
    TransferService -->|notify buyer| Frontend
    Frontend -->|displays QR code| QRViewer
    TransferService -->|release escrow| PaymentService
    PaymentService -->|settle to seller| Seller
````

## 3️⃣ Component Diagram (Backend Modules)
````mermaid
classDiagram
    class AuthService {
        +login()
        +register()
        +verifyToken()
    }
    class ListingService {
        +createListing()
        +searchListings()
        +validatePriceCap()
    }
    class RequestService {
        +createRequest()
        +approveRequest()
        +reserveTicket()
    }
    class PaymentService {
        +initiatePayment()
        +holdEscrow()
        +releaseEscrow()
        +refund()
    }
    class TransferService {
        +encryptTransferData()
        +callProvider()
        +verifyTransfer()
    }
    class DisputeService {
        +openDispute()
        +resolveDispute()
    }
    class DB {
        <<SQLite>>
        +tables: Users, Listings, Requests, Payments, Transfers, Disputes
    }
    AuthService --> DB
    ListingService --> DB
    RequestService --> DB
    PaymentService --> DB
    TransferService --> DB
    DisputeService --> DB
````

## 4️⃣ Security Mechanisms
- **AES‑256‑GCM** – client‑side encryption of the transfer payload before sending to the backend.
- **HMAC‑SHA256 fingerprint** – generated from ticket details to detect duplicate listings.
- **Price‑cap validation** – backend enforces a maximum resale price of **80 %** of the original price.
- **JWT authentication** – signed with a strong `JWT_SECRET`; short‑lived access tokens.
- **Escrow workflow** – payment funds are locked until the transfer is verified, preventing seller fraud.
- **Audit Trail** – every state change (listing, request, payment, transfer, dispute) is logged with timestamps for traceability.

---

*All diagrams are expressed in Mermaid and render automatically in supported markdown viewers.*
