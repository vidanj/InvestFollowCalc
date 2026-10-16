// Password-based encryption for backups (WebCrypto only, no dependencies).
// Changing any parameter here requires a new backup `formatVersion` (see CLAUDE.md).

export const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
/** Upper bound accepted when reading, so a crafted file cannot freeze the app. */
export const MAX_ITERATIONS = 10_000_000;

export interface EncryptedBlob {
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  /** Base64 ciphertext, including the GCM authentication tag. */
  data: string;
}

export class DecryptionError extends Error {
  constructor() {
    super('Wrong password or corrupted data');
    this.name = 'DecryptionError';
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts `plaintext` with a key derived from `password`; fresh random salt and IV every time. */
export async function encrypt(
  plaintext: Uint8Array<ArrayBuffer>,
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext),
  );
  return {
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) },
    data: toBase64(ciphertext),
  };
}

/**
 * Decrypts a blob. GCM authenticates the data, so a wrong password and any altered byte both fail
 * the same way: they are indistinguishable by design.
 *
 * @throws {DecryptionError}
 */
export async function decrypt(blob: EncryptedBlob, password: string): Promise<Uint8Array> {
  try {
    const key = await deriveKey(password, fromBase64(blob.kdf.salt), blob.kdf.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(blob.cipher.iv) },
      key,
      fromBase64(blob.data),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new DecryptionError();
  }
}
