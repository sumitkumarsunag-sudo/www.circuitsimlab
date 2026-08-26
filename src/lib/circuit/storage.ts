/**
 * IndexedDB-backed project storage.
 *
 * All methods are async and no-op safely when IndexedDB is unavailable (SSR,
 * private mode) by throwing a clear error the UI can catch. Projects are stored
 * in a single object store keyed by id.
 */
import type { Circuit, StoredCircuit } from './types.ts';

const DB_NAME = 'circuitsimulate';
const STORE = 'projects';
const VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open database.'));
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

export async function saveProject(project: StoredCircuit): Promise<void> {
  await tx('readwrite', (s) => s.put(project));
}

export async function loadProject(id: string): Promise<StoredCircuit | undefined> {
  return tx<StoredCircuit | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredCircuit | undefined>);
}

export async function listProjects(): Promise<StoredCircuit[]> {
  const all = await tx<StoredCircuit[]>('readonly', (s) => s.getAll() as IDBRequest<StoredCircuit[]>);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export function newProject(name: string, circuit: Circuit): StoredCircuit {
  const now = Date.now();
  return {
    id: 'p_' + now.toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    circuit,
    createdAt: now,
    updatedAt: now,
  };
}
