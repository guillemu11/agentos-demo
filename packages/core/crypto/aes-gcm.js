import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

export function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('key must be 32 bytes hex');
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('hex');
}

export function decrypt(ciphertextHex, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(ciphertextHex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
