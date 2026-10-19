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

  private extractPlainMetadata(asset: Omit<MediaAsset, 'id'> | MediaAsset): Omit<StoredAsset, 'imageBytes' | 'imageMime' | 'url'> {
    return {
      batchId: asset.batchId,
      prompt: asset.prompt || '',
      revisedPrompt: asset.revisedPrompt,
      model: asset.model || '',
      size: asset.size || '',
      ratio: asset.ratio,
      width: asset.width,
      height: asset.height,
      targetResolution: asset.targetResolution,
      targetRatio: asset.targetRatio,
      targetSize: asset.targetSize,
      quality: asset.quality || '',
      format: asset.format,
      transparent: asset.transparent,
      duration: asset.duration || '',
      timestamp: asset.timestamp || Date.now(),
      isFavorite: Boolean(asset.isFavorite),
      type: asset.type,
      referenceImages: asset.referenceImages ? [...asset.referenceImages] : [],
      status: asset.status,
      errorMessage: asset.errorMessage
    };
  }

  private async toStoredRecord(asset: Omit<MediaAsset, 'id'> | MediaAsset): Promise<StoredAsset> {
    const meta = this.extractPlainMetadata(asset);

    if (asset.status === 'failed') {
      const record: StoredAsset = {
        ...meta,
        url: '',
        imageBytes: new ArrayBuffer(0),
        imageMime: '',
        isFavorite: false
      };
      if ('id' in asset && asset.id !== undefined) {
        record.id = asset.id;
      }
      return record;
    }

    if (!(asset.blob instanceof Blob) || asset.blob.size === 0) {
      throw new Error('保存失败: 缺少本地图像数据');
    }

    const record: StoredAsset = {
      ...meta,
      url: '',
      imageBytes: await asset.blob.arrayBuffer(),
      imageMime: asset.blob.type || 'image/png'
    };
    if ('id' in asset && asset.id !== undefined) {
      record.id = asset.id;
    }
    return record;
  }

  private fromStoredRecord(record: StoredAsset): MediaAsset {
    const { imageBytes, imageMime, ...rest } = record;
    if (rest.status === 'failed' || !imageBytes || imageBytes.byteLength === 0) {
      return {
        ...rest,
        isFavorite: Boolean(rest.isFavorite),
        blob: new Blob([])
      };
    }
    return {
      ...rest,
      isFavorite: Boolean(rest.isFavorite),
      blob: new Blob([imageBytes], { type: imageMime || 'image/png' })
    };
  }

  private hydrateAsset(asset: MediaAsset): MediaAsset {
    if (asset.status === 'failed' || !asset.blob || asset.blob.size === 0) {
      return { ...asset, url: '' };
    }
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
    const assetId = asset.id;
    if (!assetId) return false;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const getReq = store.get(assetId);
      getReq.onsuccess = async () => {
        const existing = getReq.result as StoredAsset | undefined;
        if (!existing) {
          resolve(false);
          return;
        }

        const meta = this.extractPlainMetadata(asset);
        let imageBytes = existing.imageBytes;
        let imageMime = existing.imageMime;

        if (asset.blob instanceof Blob && asset.blob.size > 0 && asset.blob.size !== existing.imageBytes?.byteLength) {
          imageBytes = await asset.blob.arrayBuffer();
          imageMime = asset.blob.type || existing.imageMime || 'image/png';
        }

        const updated: StoredAsset = {
          ...meta,
          id: assetId,
          url: '',
          imageBytes,
          imageMime
        };

        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  public async updateFavorite(id: number, isFavorite: boolean): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as StoredAsset | undefined;
        if (!record) {
          resolve(false);
          return;
        }
        record.isFavorite = Boolean(isFavorite);
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
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
