// ── Encryption utility using Web Crypto API (AES-GCM) ──
// Encrypts PII data at rest (localStorage). Key is stored in sessionStorage.

// Store key in localStorage so all tabs in the same origin share the same key.
// Previously used sessionStorage which prevented cross-tab sync.
const KEY_STORAGE_KEY = "ride-crypto-key";
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

async function generateKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function importKey(rawBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(rawBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM, length: KEY_LENGTH }, false, ["encrypt", "decrypt"]);
}

async function getKey(): Promise<CryptoKey> {
  // Check localStorage first (shared across tabs)
  let raw = localStorage.getItem(KEY_STORAGE_KEY);
  if (!raw) {
    // Migrate from legacy sessionStorage if present
    raw = sessionStorage.getItem(KEY_STORAGE_KEY);
    if (raw) {
      localStorage.setItem(KEY_STORAGE_KEY, raw);
      sessionStorage.removeItem(KEY_STORAGE_KEY);
    } else {
      raw = await generateKey();
      localStorage.setItem(KEY_STORAGE_KEY, raw);
    }
  }
  return importKey(raw);
}

/** Encrypt a plaintext string. Returns base64-encoded ciphertext. */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64-encoded ciphertext. Returns plaintext string. */
export async function decrypt(ciphertextB64: string): Promise<string> {
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

/** Clear the encryption key (for logout/reset) */
export function clearKey(): void {
  localStorage.removeItem(KEY_STORAGE_KEY);
  sessionStorage.removeItem(KEY_STORAGE_KEY);
}
