import type {
  EncryptedVaultBundle,
  OfflineSnapshot,
  StorageMode,
  UserProfile,
} from '../types/zupu';
import { computeBundleChecksum } from './crypto';

const DB_NAME = 'ZupuSovereignDB';
const DB_VERSION = 1;
const STORE_KV = 'kv_store';
const STORE_SNAPSHOTS = 'snapshots';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

async function kvGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readonly');
    const store = tx.objectStore(STORE_KV);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KV, 'readwrite');
    const store = tx.objectStore(STORE_KV);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStorageModePreference(): Promise<StorageMode> {
  const mode = await kvGet<StorageMode>('storage_mode');
  return mode === 'offline_only' ? 'offline_only' : 'hybrid_sync';
}

export async function setStorageModePreference(mode: StorageMode): Promise<void> {
  await kvSet('storage_mode', mode);
}

export async function getLocalePreference(): Promise<'en-HK' | 'zh-HK' | 'zh-CN' | null> {
  const val = await kvGet<string>('ui_locale');
  if (val === 'en-HK' || val === 'zh-HK' || val === 'zh-CN') return val;
  return null;
}

export async function setLocalePreference(locale: 'en-HK' | 'zh-HK' | 'zh-CN'): Promise<void> {
  await kvSet('ui_locale', locale);
}

export async function getPendingSyncFlag(): Promise<boolean> {
  const flag = await kvGet<boolean>('pending_sync');
  return Boolean(flag);
}

export async function setPendingSyncFlag(pending: boolean): Promise<void> {
  await kvSet('pending_sync', pending);
}

export async function saveLocalEncryptedVault(bundle: EncryptedVaultBundle): Promise<void> {
  await kvSet('encrypted_vault', bundle);
}

export async function loadLocalEncryptedVault(): Promise<EncryptedVaultBundle | null> {
  return kvGet<EncryptedVaultBundle>('encrypted_vault');
}

export async function saveLocalOfflineProfile(profile: UserProfile): Promise<void> {
  await kvSet('local_custodian_profile', profile);
}

export async function loadLocalOfflineProfile(): Promise<UserProfile | null> {
  return kvGet<UserProfile>('local_custodian_profile');
}

export async function createOfflineSnapshot(
  bundle: EncryptedVaultBundle,
  label: string
): Promise<OfflineSnapshot> {
  const sha256Checksum = await computeBundleChecksum(bundle);
  const snapshot: OfflineSnapshot = {
    id: `snap_${Date.now()}`,
    createdAt: new Date().toISOString(),
    label,
    recordCount: bundle.records.length,
    keyFingerprint: bundle.metadata.keyFingerprint,
    sha256Checksum,
    bundle,
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.put(snapshot);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return snapshot;
}

export async function listOfflineSnapshots(): Promise<OfflineSnapshot[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result as OfflineSnapshot[]) ?? [];
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineSnapshot(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SNAPSHOTS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
