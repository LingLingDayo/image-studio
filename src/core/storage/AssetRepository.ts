import type { MediaAsset } from '@/types/asset';
import { revokeObjectUrl } from './imageBlob';

const DB_NAME = 'ImageStudioDB';
const DB_VERSION = 4;
const ASSET_STORE = 'assets';

interface StoredAsset extends Omit<MediaAsset, 'blob' | 'url'> {
  url: string;
  imageBytes: ArrayBuffer;
  imageMime: string;
}

class AssetRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private objectUrls = new Map<number, string>();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (e) => {
        const db = request.result;
        const oldVersion = e.oldVersion || 0;
        if (oldVersion > 0 && oldVersion < 4 && db.objectStoreNames.contains(ASSET_STORE)) {
          db.deleteObjectStore(ASSET_STORE);
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          const store = db.createObjectStore(ASSET_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('isFavorite', 'isFavorite', { unique: false });
          store.createIndex('model', 'model', { unique: false });
        }
      };
    });

    return this.dbPromise;
  }

  private async toStoredRecord(asset: Omit<MediaAsset, 'id'> | MediaAsset): Promise<StoredAsset> {
    if (!(asset.blob instanceof Blob) || asset.blob.size === 0) {
      throw new Error('保存失败: 缺少本地图像数据');
    }
    const { blob, url: _url, ...rest } = asset;
    const record: any = {
      ...rest,
      url: '',
      imageBytes: await blob.arrayBuffer(),
      imageMime: blob.type || 'image/png',
      isFavorite: asset.isFavorite || false
    };
    if ('id' in asset && asset.id !== undefined) {
      record.id = asset.id;
    }
    return record as StoredAsset;
  }

  private fromStoredRecord(record: StoredAsset): MediaAsset {
    const { imageBytes, imageMime, ...rest } = record;
    return {
      ...rest,
      blob: new Blob([imageBytes], { type: imageMime || 'image/png' })
    };
  }

  private hydrateAsset(asset: MediaAsset): MediaAsset {
    if (asset.id) {
      this.revokeDisplayUrl(asset.id);
    }
    const url = URL.createObjectURL(asset.blob);
    if (asset.id) {
      this.objectUrls.set(asset.id, url);
    }
    return { ...asset, url };
  }

  private revokeDisplayUrl(id: number) {
    const url = this.objectUrls.get(id);
    if (url) {
      revokeObjectUrl(url);
      this.objectUrls.delete(id);
    }
  }

  private revokeAllDisplayUrls() {
    for (const url of this.objectUrls.values()) {
      revokeObjectUrl(url);
    }
    this.objectUrls.clear();
  }

  public async save(asset: Omit<MediaAsset, 'id'>): Promise<MediaAsset> {
    const stored = await this.toStoredRecord(asset);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const req = store.add(stored);
      req.onsuccess = () => {
        const id = req.result as number;
        resolve(this.hydrateAsset(this.fromStoredRecord({ ...stored, id })));
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async update(asset: MediaAsset): Promise<boolean> {
    if (!asset.id) return false;
    const stored = await this.toStoredRecord(asset);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const req = store.put({ ...stored, id: asset.id });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAll(): Promise<MediaAsset[]> {
    const db = await this.getDB();
    const storedItems = await new Promise<StoredAsset[]>((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readonly');
      const store = tx.objectStore(ASSET_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as StoredAsset[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });

    return storedItems
      .filter((record) => record.imageBytes && record.imageBytes.byteLength > 0)
      .map((record) => this.hydrateAsset(this.fromStoredRecord(record)));
  }

  public async delete(id: number): Promise<boolean> {
    this.revokeDisplayUrl(id);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  public async clearAll(): Promise<boolean> {
    this.revokeAllDisplayUrls();
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}

export const assetRepository = new AssetRepository();
