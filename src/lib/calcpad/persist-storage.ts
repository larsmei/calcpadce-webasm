/** IndexedDB-backed zustand storage so pasted screenshots are not capped at ~5 MB localStorage. */

const DB_NAME = "calcpadce-wasm";
const STORE = "persist";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

function idbRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
      }),
  );
}

function lsGet(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function lsSet(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
  } catch {
    try {
      localStorage.removeItem(name);
    } catch {
      /* quota */
    }
  }
}

function lsRemove(name: string) {
  try {
    localStorage.removeItem(name);
  } catch {
    /* ignore */
  }
}

export const persistStorage = {
  async getItem(name: string): Promise<string | null> {
    if (typeof indexedDB !== "undefined") {
      try {
        const value = await idbRequest<unknown>("readonly", (store) => store.get(name));
        if (typeof value === "string") return value;
      } catch {
        /* fall through */
      }
    }
    return lsGet(name);
  },
  async setItem(name: string, value: string): Promise<void> {
    if (typeof indexedDB !== "undefined") {
      try {
        await idbRequest("readwrite", (store) => store.put(value, name));
      } catch {
        /* still try localStorage */
      }
    }
    lsSet(name, value);
  },
  async removeItem(name: string): Promise<void> {
    if (typeof indexedDB !== "undefined") {
      try {
        await idbRequest("readwrite", (store) => store.delete(name));
      } catch {
        /* ignore */
      }
    }
    lsRemove(name);
  },
};
