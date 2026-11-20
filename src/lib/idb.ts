const memory = new Map<string, Blob>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("indexedDB"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("qwenxyxf", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("videos")) {
          request.result.createObjectStore("videos");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("idb"));
      };
    });
  }
  return dbPromise;
}

export async function saveVideo(id: string, blob: Blob): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("videos", "readwrite");
      tx.objectStore("videos").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    memory.set(id, blob);
    return false;
  }
}

export async function loadVideo(id: string): Promise<Blob | null> {
  const cached = memory.get(id);
  if (cached) return cached;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("videos", "readonly");
      const request = tx.objectStore("videos").get(id);
      request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function deleteVideo(id: string): Promise<void> {
  memory.delete(id);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("videos", "readwrite");
      tx.objectStore("videos").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* session copy already dropped */
  }
}

export async function clearVideos(): Promise<void> {
  memory.clear();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("videos", "readwrite");
      tx.objectStore("videos").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}
