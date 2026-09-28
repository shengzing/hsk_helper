/** Stores session private keys in IndexedDB for persistence across page reloads.
 *  Keys are never sent to the server after initial exchange. */

const DB_NAME = "hsk_session_keys";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storeSessionKey(userId: string, key: CryptoKey): Promise<void> {
  const db = await openDb();
  const exported = await crypto.subtle.exportKey("jwk", key);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(exported, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getSessionPrivateKey(userId: string): Promise<CryptoKey | undefined> {
  const db = await openDb();
  const result = await new Promise<JsonWebKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(userId);
    req.onsuccess = () => resolve(req.result as JsonWebKey | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!result) return undefined;
  return crypto.subtle.importKey("jwk", result, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey", "deriveBits"]);
}

export async function deleteSessionKey(userId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
