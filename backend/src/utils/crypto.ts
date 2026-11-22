import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config';

// Password Hashing
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// AES-256-GCM Encryption for sensitive recipient data and seat numbers
const KEY = Buffer.from(config.aesKeyHex, 'hex');

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptAES(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format as iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptAES(payload: string): string {
  try {
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return '[Encrypted/Restricted]';
  }
}

// Keyed HMAC SHA-256 Fingerprint for booking references (prevents duplicate listings without leaking raw booking reference)
export function generateReferenceFingerprint(providerId: string, bookingRef: string): string {
  const normalized = `${providerId}:${bookingRef.trim().toUpperCase()}`;
  return crypto.createHmac('sha256', config.hmacSecret).update(normalized).digest('hex');
}

// Webhook Signature verification
export function signWebhookPayload(payload: string): string {
  return crypto.createHmac('sha256', config.webhookSecret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expected = signWebhookPayload(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
