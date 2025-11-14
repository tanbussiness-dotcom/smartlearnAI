'use server';

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const secret = process.env.CRYPTO_SECRET;

if (!secret) {
  throw new Error('CRYPTO_SECRET is not defined in environment variables.');
}

const getKey = (salt: Buffer): Buffer => {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, 'sha512');
};

export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

export function decrypt(encryptedText: string): string {
  const bData = Buffer.from(encryptedText, 'hex');

  const salt = bData.subarray(0, SALT_LENGTH);
  const iv = bData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = bData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = bData.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = getKey(salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
