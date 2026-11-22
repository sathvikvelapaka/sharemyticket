import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'trustpass-super-secure-production-jwt-secret-key-2026',
  jwtExpiresIn: '2h',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'trustpass-refresh-token-secret-2026',
  refreshTokenExpiresIn: '7d',
  aesKeyHex: process.env.AES_KEY_HEX || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32-byte key in hex
  hmacSecret: process.env.HMAC_SECRET || 'trustpass-hmac-fingerprint-salt-2026',
  maxResalePercent: 0.80, // strict 80% maximum resale price limit
  reservationTimeoutSeconds: parseInt(process.env.RESERVATION_TIMEOUT_SECONDS || '600', 10), // 10 minutes
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../trustpass.sqlite'),
  evidenceStorageDir: process.env.EVIDENCE_DIR || path.join(__dirname, '../../uploads/evidence'),
  webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'trustpass_webhook_secret_mock_sig',
};
