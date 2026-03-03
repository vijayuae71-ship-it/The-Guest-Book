import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KEY_FILE = path.join(__dirname, '..', '.encryption-key');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

/**
 * Get or generate the encryption key.
 * Key is stored in a file on the server — protect this file.
 */
function getEncryptionKey() {
  if (fs.existsSync(KEY_FILE)) {
    return Buffer.from(fs.readFileSync(KEY_FILE, 'utf-8').trim(), 'hex');
  }

  // Generate a new 256-bit key
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  console.log('Generated new encryption key at', KEY_FILE);
  return key;
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Encrypt a buffer using AES-256-GCM.
 * Output format: [IV (12 bytes)] [Auth Tag (16 bytes)] [Encrypted data]
 * @param {Buffer} plainBuffer
 * @returns {Buffer} encrypted buffer
 */
export function encryptBuffer(plainBuffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: IV + authTag + ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt a buffer encrypted with encryptBuffer.
 * @param {Buffer} encryptedBuffer
 * @returns {Buffer} decrypted buffer
 */
export function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt a file in place: reads it, encrypts, writes back with .enc extension.
 * Deletes the original plaintext file.
 * @param {string} filePath - path to the plaintext file
 * @returns {string} path to the encrypted file (.enc appended)
 */
export function encryptFile(filePath) {
  const plainData = fs.readFileSync(filePath);
  const encryptedData = encryptBuffer(plainData);

  const encPath = filePath + '.enc';
  fs.writeFileSync(encPath, encryptedData);

  // Remove the plaintext original
  fs.unlinkSync(filePath);

  return encPath;
}

/**
 * Decrypt a .enc file and return the buffer.
 * @param {string} encFilePath - path to the .enc file
 * @returns {Buffer} decrypted data
 */
export function decryptFile(encFilePath) {
  const encryptedData = fs.readFileSync(encFilePath);
  return decryptBuffer(encryptedData);
}

/**
 * Check if a file is encrypted (has .enc extension and the companion exists).
 * @param {string} basePath - the original file path (without .enc)
 * @returns {{ encrypted: boolean, path: string }}
 */
export function resolveFilePath(basePath) {
  const encPath = basePath + '.enc';
  if (fs.existsSync(encPath)) {
    return { encrypted: true, path: encPath };
  }
  if (fs.existsSync(basePath)) {
    return { encrypted: false, path: basePath };
  }
  return { encrypted: false, path: null };
}
