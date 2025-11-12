import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment variable
 * If not set, use a default key (NOT recommended for production)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.warn('⚠️  ENCRYPTION_KEY not set in .env - using default key (NOT secure for production)');
    return 'default-encryption-key-please-change-in-production-env';
  }
  
  return key;
}

/**
 * Derive a crypto key from the encryption key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const key = getEncryptionKey();
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt a string using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: salt:iv:tag:encrypted
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine: salt + iv + tag + encrypted
    const result = Buffer.concat([salt, iv, tag, encrypted]);
    return result.toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * @param encryptedData - Encrypted string from encrypt()
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  
  try {
    const data = Buffer.from(encryptedData, 'base64');
    
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, TAG_POSITION);
    const tag = data.subarray(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = data.subarray(ENCRYPTED_POSITION);
    
    const key = deriveKey(salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string appears to be encrypted (base64 format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  
  try {
    const decoded = Buffer.from(text, 'base64');
    // Check if it's at least as long as salt + iv + tag
    return decoded.length >= (SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  } catch {
    return false;
  }
}

/**
 * Encrypt QuickBooks tokens safely
 */
export function encryptTokens(accessToken: string | null, refreshToken: string | null) {
  return {
    accessToken: accessToken ? encrypt(accessToken) : null,
    refreshToken: refreshToken ? encrypt(refreshToken) : null
  };
}

/**
 * Decrypt QuickBooks tokens safely
 */
export function decryptTokens(accessToken: string | null, refreshToken: string | null) {
  return {
    accessToken: accessToken ? decrypt(accessToken) : null,
    refreshToken: refreshToken ? decrypt(refreshToken) : null
  };
}

