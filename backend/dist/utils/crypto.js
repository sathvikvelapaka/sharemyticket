"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.encryptAES = encryptAES;
exports.decryptAES = decryptAES;
exports.generateReferenceFingerprint = generateReferenceFingerprint;
exports.signWebhookPayload = signWebhookPayload;
exports.verifyWebhookSignature = verifyWebhookSignature;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
// Password Hashing
async function hashPassword(plain) {
    const salt = await bcryptjs_1.default.genSalt(10);
    return bcryptjs_1.default.hash(plain, salt);
}
async function verifyPassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
// AES-256-GCM Encryption for sensitive recipient data and seat numbers
const KEY = Buffer.from(config_1.config.aesKeyHex, 'hex');
function encryptAES(text) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    // Format as iv:authTag:ciphertext
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}
function decryptAES(payload) {
    try {
        const parts = payload.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted format');
        }
        const [ivHex, authTagHex, ciphertextHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    catch (err) {
        return '[Encrypted/Restricted]';
    }
}
// Keyed HMAC SHA-256 Fingerprint for booking references (prevents duplicate listings without leaking raw booking reference)
function generateReferenceFingerprint(providerId, bookingRef) {
    const normalized = `${providerId}:${bookingRef.trim().toUpperCase()}`;
    return crypto_1.default.createHmac('sha256', config_1.config.hmacSecret).update(normalized).digest('hex');
}
// Webhook Signature verification
function signWebhookPayload(payload) {
    return crypto_1.default.createHmac('sha256', config_1.config.webhookSecret).update(payload).digest('hex');
}
function verifyWebhookSignature(payload, signature) {
    const expected = signWebhookPayload(payload);
    return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
