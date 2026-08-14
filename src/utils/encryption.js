import crypto from 'node:crypto';

const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || 'default_encryption_secret_key_change_me';
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a string using AES-256-CBC.
 * Returns standard hex format "iv:encryptedText"
 * @param {string} text - Plain text to encrypt
 * @returns {string|null} - Encrypted string
 */
export const encrypt = (text) => {
  if (!text) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts a string previously encrypted with AES-256-CBC.
 * @param {string} encryptedText - Encrypted text in "iv:encryptedText" format
 * @returns {string|null} - Decrypted string or null on failure
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  try {
    const key = getEncryptionKey();
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
};
