/**
 * 本機專用 Web Crypto 帳密金庫加解密模組
 * 演算法：PBKDF2 (SHA-256, 210,000 次迭代) + AES-256-GCM
 * 所有密文僅儲存於使用者瀏覽器 localStorage，絕不寫入原始碼或上傳至 GitHub。
 */

export interface VaultEntry {
  id: string;
  service: string;
  siteId?: string; // 可關聯至 StudySite.id，或留空代表自訂服務（如 Vercel / Supabase / DET）
  loginUrl: string;
  username: string;
  password: string;
  note: string;
  updatedAt: string;
}

export interface EncryptedVaultEnvelope {
  format: 'qq-study-hub-vault';
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  updatedAt: string;
}

export const VAULT_STORAGE_KEY = 'qq.studyhub.vault.v1';
const PBKDF2_ITERATIONS = 210_000;

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isWebCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

export function loadEncryptedVault(): EncryptedVaultEnvelope | null {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EncryptedVaultEnvelope>;
    if (
      parsed.format === 'qq-study-hub-vault' &&
      parsed.version === 1 &&
      typeof parsed.salt === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.ciphertext === 'string'
    ) {
      return parsed as EncryptedVaultEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveEncryptedVault(envelope: EncryptedVaultEnvelope): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

export function clearEncryptedVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY);
}

export async function encryptVaultEntries(entries: VaultEntry[], passphrase: string): Promise<EncryptedVaultEnvelope> {
  if (!isWebCryptoAvailable()) {
    throw new Error('目前環境不支援 Web Crypto API（請使用 HTTPS 或 localhost 開啟）。');
  }
  const salt = new Uint8Array(new ArrayBuffer(16));
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify({ entries }));
  const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    format: 'qq-study-hub-vault',
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encryptedBuf)),
    updatedAt: new Date().toISOString(),
  };
}

export async function decryptVaultEntries(envelope: EncryptedVaultEnvelope, passphrase: string): Promise<VaultEntry[]> {
  if (!isWebCryptoAvailable()) {
    throw new Error('目前環境不支援 Web Crypto API。');
  }
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const cipherBytes = fromBase64(envelope.ciphertext);
  const key = await deriveAesKey(passphrase, salt, envelope.iterations || PBKDF2_ITERATIONS);

  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
    const decoded = JSON.parse(new TextDecoder().decode(plainBuf)) as { entries?: VaultEntry[] };
    return Array.isArray(decoded.entries) ? decoded.entries : [];
  } catch {
    throw new Error('主密碼錯誤或密文已損毀，無法解鎖金庫。');
  }
}

export function validateVaultEnvelope(data: unknown): data is EncryptedVaultEnvelope {
  if (!data || typeof data !== 'object') return false;
  const d = data as Partial<EncryptedVaultEnvelope>;
  return (
    d.format === 'qq-study-hub-vault' &&
    d.version === 1 &&
    typeof d.salt === 'string' &&
    typeof d.iv === 'string' &&
    typeof d.ciphertext === 'string'
  );
}

/** 產生高熵隨機密碼（純本機 crypto.getRandomValues） */
export function generateStrongPassword(length = 18): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+';
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += charset[buf[i] % charset.length];
  }
  return out;
}
