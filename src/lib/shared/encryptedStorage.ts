import { encrypt, decrypt } from './crypto';

/**
 * Creates a Zustand persist storage adapter that transparently encrypts
 * store data before writing to localStorage and decrypts on read.
 *
 * The encryption key lives in sessionStorage (ephemeral per session).
 * Data in localStorage is encrypted at rest. Cross-tab sync not supported.
 */
export function encryptedStorage() {
  return {
    getItem: async (name: string): Promise<string | null> => {
      try {
        const encrypted = localStorage.getItem(name);
        if (!encrypted) return null;
        const decrypted = await decrypt(encrypted);
        if (!decrypted) return null;
        return decrypted;
      } catch {
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const encrypted = await encrypt(value);
        localStorage.setItem(name, encrypted);
      } catch {
        console.warn(`[EncryptedStorage] Failed to encrypt store "${name}"`);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      localStorage.removeItem(name);
    },
  };
}
