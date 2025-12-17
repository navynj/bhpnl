/**
 * Encryption Utilities for QuickBooks Tokens
 * 
 * This module provides AES-256-GCM encryption/decryption for sensitive data
 * as required by QuickBooks security requirements.
 * 
 * Security Requirements:
 * - Encrypt refresh tokens and realmID with AES (preferred over 3DES)
 * - Store encryption key separately from encrypted data
 * - Use symmetric encryption algorithm
 */

import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES
const SALT_LENGTH = 64; // 64 bytes for key derivation
const TAG_LENGTH = 16; // 16 bytes for GCM authentication tag
const KEY_LENGTH = 32; // 32 bytes for AES-256
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get encryption key from environment variable
 * The key should be a base64-encoded 32-byte key, or a passphrase
 * 
 * For production, generate a secure key:
 * node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.QUICKBOOKS_ENCRYPTION_KEY;
  
  if (!keyEnv) {
    throw new Error(
      'QUICKBOOKS_ENCRYPTION_KEY environment variable is required. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  // If key is base64 encoded (32 bytes = 44 base64 chars), decode it
  if (keyEnv.length === 44) {
    try {
      return Buffer.from(keyEnv, 'base64');
    } catch {
      // If decoding fails, treat as passphrase
    }
  }

  // Otherwise, derive key from passphrase using PBKDF2
  // This allows using a longer passphrase as the key
  const salt = process.env.QUICKBOOKS_ENCRYPTION_SALT || 'default-salt-change-in-production';
  return crypto.pbkdf2Sync(keyEnv, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * @param plaintext - The data to encrypt
 * @returns Encrypted data as base64 string (format: iv:salt:tag:encrypted)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine: iv:salt:tag:encrypted (all base64 encoded)
  const combined = Buffer.concat([
    iv,
    salt,
    tag,
    encrypted,
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt data encrypted with encrypt()
 * 
 * @param encryptedData - Base64 encoded encrypted data
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (invalid key, corrupted data, etc.)
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  // Check if data looks encrypted (long base64 string)
  const looksEncrypted = isEncrypted(encryptedData);
  
  // If it looks like plaintext (short, alphanumeric), return as-is
  if (!looksEncrypted && /^[A-Za-z0-9_-]{1,50}$/.test(encryptedData)) {
    return encryptedData;
  }

  // If it looks encrypted, try to decrypt
  if (looksEncrypted) {
    try {
      const key = getEncryptionKey();
      const combined = Buffer.from(encryptedData, 'base64');

      // Validate minimum length
      if (combined.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1) {
        throw new Error(
          `Encrypted data too short (${combined.length} bytes). ` +
          'Expected at least ' + (IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1) + ' bytes.'
        );
      }

      // Extract components
      const iv = combined.subarray(0, IV_LENGTH);
      const salt = combined.subarray(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
      const tag = combined.subarray(
        IV_LENGTH + SALT_LENGTH,
        IV_LENGTH + SALT_LENGTH + TAG_LENGTH
      );
      const encrypted = combined.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      const plaintext = decrypted.toString('utf8');
      
      // Validate decrypted result looks reasonable
      // For realmId, it should be short (typically 8-15 characters, max 50)
      // For tokens, they can be longer but should still be reasonable
      if (plaintext.length > 200 || !/^[\x20-\x7E]+$/.test(plaintext)) {
        throw new Error(
          'Decrypted data does not look like valid plaintext. ' +
          'This may indicate the encryption key is incorrect or the data is corrupted.'
        );
      }

      return plaintext;
    } catch (error: any) {
      // Provide more helpful error message
      const errorMessage = error.message || 'Unknown error';
      throw new Error(
        `Decryption failed: ${errorMessage}. ` +
        'This usually means:\n' +
        '1. The encryption key (QUICKBOOKS_ENCRYPTION_KEY) has changed\n' +
        '2. The data was encrypted with a different key\n' +
        '3. The data is corrupted\n\n' +
        'Solution: Re-authenticate your QuickBooks connection to store new encrypted data.'
      );
    }
  }

  // If it doesn't look encrypted and doesn't match plaintext pattern, return as-is with warning
  console.warn(
    'Data does not match expected format (neither encrypted nor plaintext). ' +
    'Returning as-is, but this may cause issues.'
  );
  return encryptedData;
}

/**
 * Check if a string is encrypted (base64 format check)
 * This is a heuristic - encrypted strings will be longer base64 strings
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  
  // Encrypted strings are longer base64 strings
  // Plain tokens are typically shorter and don't have the structure
  try {
    const decoded = Buffer.from(data, 'base64');
    // Encrypted data should be at least IV + SALT + TAG + some encrypted data
    return decoded.length >= IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

