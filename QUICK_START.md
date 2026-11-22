# Quick Start Guide for ShareMyTicket (TrustPass)

## Prerequisites
- **Node.js** v20 or newer (recommended via nvm)
- **npm** ≥ 10 (comes with Node)
- **Git** for cloning the repo
- (Optional) **Docker** ‑ if you prefer containerised services
- A modern browser (Chrome ≥ 108) – needed for UI testing and QR‑code display.

## 1️⃣ Clone the Repository
```bash
git clone https://github.com/your‑org/trustpass.git   # or your fork URL
cd trustpass
```
> The repository folder is named `trustpass`; the documentation refers to the project as **ShareMyTicket**.

## 2️⃣ Install Dependencies
```bash
# Backend dependencies
cd backend && npm ci && cd ..
# Frontend dependencies
cd frontend && npm ci && cd ..
```
`npm ci` ensures a reproducible install based on `package-lock.json`.

## 3️⃣ Set Up Environment Variables
Copy the example files and edit the values as needed:
```bash
# Backend
cp backend/.env.example backend/.env
# Frontend (if any custom env vars are required)
cp frontend/.env.example frontend/.env
```
Key variables you may need to adjust:
- `JWT_SECRET` – secret for signing authentication tokens.
- `AES_KEY` – 32‑byte base64 string for AES‑256‑GCM encryption of transfer data.
- `DB_PATH` – path to the SQLite file (default `./data/trustpass.db`).
- `PORT` – backend HTTP port (default `4000`).
- `FRONTEND_PORT` – Vite dev server port (default `3001`).

## 4️⃣ Start the Backend Server
```bash
cd backend
npm start   # runs `node dist/index.js` after a TS build
```
The backend health‑check is available at `http://localhost:4000/health` and should respond with `{ "status": "ok" }`.

## 5️⃣ Start the Frontend Development Server
Open a **new terminal** (the backend must keep running) and run:
```bash
cd frontend
npm run dev
```
The UI will be served at `http://localhost:3001`. Open this URL in Chrome.

## 6️⃣ Verify the Flow (Optional)
If you have the **Browser UI Tester** sub‑agent enabled, you can ask it to run through a buyer‑seller scenario. Otherwise, manually:
1. Register two accounts (one buyer, one seller).
2. As the seller, create a ticket listing (use a dummy QR screenshot).
3. As the buyer, request the ticket and complete the payment (the sandbox payment gateway always succeeds).
4. Observe the QR‑code “generated” after the seller initiates the transfer.

## 7️⃣ Run the Test Suite
```bash
# Backend tests
cd backend && npm test
# Frontend lint / tests (if any)
cd frontend && npm run lint   # optional
```
All tests should pass (`22` specifications for the backend).

## 🔧 Troubleshooting
| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| `npm start` crashes with `cannot find module` | Dependencies not installed | Re‑run `npm ci` in the respective folder |
| Frontend shows **blank page** | `.env` missing or wrong API URL | Ensure `VITE_API_URL` (if used) points to `http://localhost:4000` |
| Port conflict (e.g., `EADDRINUSE`) | Another process using the same port | Change `PORT` or `FRONTEND_PORT` in the `.env` files |
| QR‑code not displayed after transfer | Mock transfer service not started | Verify the backend log shows `Transfer service ready` and that the buyer accepted the transfer |

## 📦 Docker (Alternative) – Quick Overview
A Docker Compose file is provided for those who prefer containerisation.
```bash
docker compose up --build
```
This will spin up `backend` and `frontend` containers with the same ports as above.

---

**You’re now ready to explore, develop, and contribute to ShareMyTicket!**
