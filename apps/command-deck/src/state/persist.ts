import { createJSONStorage, type PersistOptions } from "zustand/middleware";

export const STORAGE_PREFIX = "nova.deck.v1.";

/** localStorage that tolerates private windows and blocked storage. */
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: state stays in memory */
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
}));

export function persistOptions<S, P = Partial<S>>(
  name: string,
  partialize?: (s: S) => P,
): PersistOptions<S, P> {
  return {
    name: STORAGE_PREFIX + name,
    storage: safeStorage as PersistOptions<S, P>["storage"],
    ...(partialize ? { partialize } : {}),
  };
}
