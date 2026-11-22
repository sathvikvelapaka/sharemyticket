"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '4000', 10),
    jwtSecret: process.env.JWT_SECRET || 'trustpass-super-secure-production-jwt-secret-key-2026',
    jwtExpiresIn: '2h',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'trustpass-refresh-token-secret-2026',
    refreshTokenExpiresIn: '7d',
    aesKeyHex: process.env.AES_KEY_HEX || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32-byte key in hex
    hmacSecret: process.env.HMAC_SECRET || 'trustpass-hmac-fingerprint-salt-2026',
    maxResalePercent: 0.80, // strict 80% maximum resale price limit
    reservationTimeoutSeconds: parseInt(process.env.RESERVATION_TIMEOUT_SECONDS || '600', 10), // 10 minutes
    dbPath: process.env.DB_PATH || path_1.default.join(__dirname, '../../trustpass.sqlite'),
    evidenceStorageDir: process.env.EVIDENCE_DIR || path_1.default.join(__dirname, '../../uploads/evidence'),
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'trustpass_webhook_secret_mock_sig',
};
