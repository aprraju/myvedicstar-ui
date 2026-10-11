import type { CacheStorage } from '@myvedicstar/query-cache';

/** IndexedDB only holds the anonymous query allowlist; preferences retain their existing storage. */
export function createIndexedDbCacheStorage(): CacheStorage {
  const run = <T>(mode: IDBTransactionMode, request: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      const open = indexedDB.open('myvedicstar-query-cache', 1);
      const timer = setTimeout(() => reject(new Error('Cache storage unavailable')), 2000);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('cache')) open.result.createObjectStore('cache');
      };
      open.onerror = () => {
        clearTimeout(timer);
        reject(open.error);
      };
      open.onblocked = () => {
        clearTimeout(timer);
        reject(new Error('Cache storage blocked'));
      };
      open.onsuccess = () => {
        clearTimeout(timer);
        const db = open.result;
        const transaction = db.transaction('cache', mode);
        const operation = request(transaction.objectStore('cache'));
        transaction.oncomplete = () => {
          db.close();
          resolve(operation.result);
        };
        transaction.onabort = transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
  return {
    getItem: async (key) => (await run<string | undefined>('readonly', (store) => store.get(key))) ?? null,
    setItem: async (key, value) => {
      await run('readwrite', (store) => store.put(value, key));
    },
    removeItem: async (key) => {
      await run('readwrite', (store) => store.delete(key));
    },
  };
}
