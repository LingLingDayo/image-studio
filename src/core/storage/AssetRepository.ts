import type { MediaAsset } from '@/types/asset';
import { dataUrlToBlob, detectImageMimeType, mimeToImageFormat, revokeObjectUrl } from './imageBlob';
import { assetIdentity, equalImageBytes } from './backup/assetIdentity';

const DB_NAME = 'ImageStudioDB';
const DB_VERSION = 4;
const ASSET_STORE = 'assets';

interface StoredAsset extends Omit<MediaAsset, 'blob' | 'url'> {
  url: string;
  imageBytes: ArrayBuffer;
  imageMime: string;
  blob?: Blob;
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

      request.onupgradeneeded = () => {
        const db = request.result;
        // 升级只补齐结构，不重建作品库，以保留旧作品及尚未识别的历史字段。
        const store = db.objectStoreNames.contains(ASSET_STORE)
          ? request.transaction!.objectStore(ASSET_STORE)
          : db.createObjectStore(ASSET_STORE, { keyPath: 'id', autoIncrement: true });
        for (const name of ['timestamp', 'isFavorite', 'model']) {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, name, { unique: false });
          }
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
      targetFormat: asset.targetFormat,
      quality: asset.quality || '',
      format: asset.format,
      transparent: asset.transparent,
      moderation: asset.moderation,
      duration: asset.duration || '',
      timestamp: asset.timestamp ?? Date.now(),
      isFavorite: Boolean(asset.isFavorite),
      type: asset.type,
      referenceImages: asset.referenceImages ? [...asset.referenceImages] : [],
      status: asset.status,
      errorMessage: asset.errorMessage
    };
  }

  private normalizeStoredRecord(record: StoredAsset): StoredAsset {
    if (!record.imageBytes || record.imageBytes.byteLength === 0) return record;
    const imageMime = detectImageMimeType(new Uint8Array(record.imageBytes)) || record.imageMime || 'image/png';
    return {
      ...record,
      targetFormat: record.targetFormat ?? record.format,
      format: mimeToImageFormat(imageMime) ?? record.format,
      imageMime
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
    return this.normalizeStoredRecord(record);
  }

  private fromStoredRecord(record: StoredAsset): MediaAsset {
    const { imageBytes, imageMime, ...rest } = this.normalizeStoredRecord(record);
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
      tx.oncomplete = () => resolve(this.hydrateAsset(this.fromStoredRecord({ ...stored, id: req.result as number })));
      tx.onabort = () => reject(tx.error || req.error || new Error('保存作品失败'));
      tx.onerror = () => reject(tx.error || req.error);
    });
  }

  public async update(asset: MediaAsset): Promise<boolean> {
    const assetId = asset.id;
    if (!assetId) return false;
    // 像素读取必须在事务开始前完成，不能让异步 Blob 读取使 IDB 事务提前结束。
    const replacement = asset.blob instanceof Blob && asset.blob.size > 0
      ? await this.toStoredRecord(asset)
      : null;
    const meta = this.extractPlainMetadata(asset);
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      let found = false;
      const getReq = store.get(assetId);
      getReq.onsuccess = () => {
        const existing = getReq.result as StoredAsset | undefined;
        if (!existing) return;
        found = true;
        const updated = this.normalizeStoredRecord({
          ...existing,
          ...meta,
          targetFormat: meta.targetFormat ?? existing.targetFormat ?? existing.format,
          id: assetId,
          url: replacement || existing.imageBytes?.byteLength ? '' : existing.url,
          imageBytes: replacement?.imageBytes ?? existing.imageBytes,
          imageMime: replacement?.imageMime ?? existing.imageMime
        });
        if (replacement) delete updated.blob;
        store.put(updated);
      };
      tx.oncomplete = () => resolve(found);
      tx.onabort = () => reject(tx.error || new Error('更新作品失败'));
      tx.onerror = () => reject(tx.error);
    });
  }

  public async updateFavorite(id: number, isFavorite: boolean): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      let found = false;
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result as StoredAsset | undefined;
        if (!record) return;
        found = true;
        record.isFavorite = Boolean(isFavorite);
        store.put(record);
      };
      tx.oncomplete = () => resolve(found);
      tx.onabort = () => reject(tx.error || new Error('更新收藏失败'));
      tx.onerror = () => reject(tx.error);
    });
  }

  private async readStoredItems(): Promise<StoredAsset[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readonly');
      const req = tx.objectStore(ASSET_STORE).getAll();
      tx.oncomplete = () => resolve((req.result as StoredAsset[]).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      tx.onabort = () => reject(tx.error || new Error('读取作品失败'));
      tx.onerror = () => reject(tx.error);
    });
  }

  private async readCompatibleRecord(record: StoredAsset): Promise<StoredAsset | null> {
    if (record.imageBytes && record.imageBytes.byteLength > 0) return this.normalizeStoredRecord(record);
    let blob: Blob | undefined;
    if (record.blob instanceof Blob && record.blob.size > 0) {
      blob = record.blob;
    } else if (typeof record.url === 'string' && record.url.startsWith('data:image/')) {
      try {
        blob = dataUrlToBlob(record.url);
      } catch {
        return null;
      }
    }
    if (!blob || blob.size === 0) return null;
    const imageBytes = await blob.arrayBuffer();
    const imageMime = detectImageMimeType(new Uint8Array(imageBytes));
    if (!imageMime) return null;
    return this.normalizeStoredRecord({ ...record, url: '', imageBytes, imageMime });
  }

  public async getSnapshot(): Promise<{ assets: MediaAsset[]; unsupportedCount: number }> {
    const records = await this.readStoredItems();
    const assets: MediaAsset[] = [];
    let unsupportedCount = 0;
    for (const record of records) {
      if (record.status === 'failed') continue;
      const compatible = await this.readCompatibleRecord(record);
      if (compatible) assets.push(this.fromStoredRecord(compatible));
      else unsupportedCount += 1;
    }
    return { assets, unsupportedCount };
  }

  public async getAll(): Promise<MediaAsset[]> {
    const snapshot = await this.getSnapshot();
    return snapshot.assets.map((asset) => this.hydrateAsset(asset));
  }

  public async mergeAssets(assets: Array<Omit<MediaAsset, 'id'>>): Promise<{ added: number; skipped: number }> {
    const prepared: StoredAsset[] = [];
    for (const asset of assets) {
      const record = await this.toStoredRecord(asset);
      delete record.id;
      prepared.push(record);
    }
    const legacy = new Map<number, StoredAsset>();
    for (const record of await this.readStoredItems()) {
      if (!record.imageBytes && record.id !== undefined) {
        const compatible = await this.readCompatibleRecord(record);
        if (compatible) legacy.set(record.id, compatible);
      }
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      const store = tx.objectStore(ASSET_STORE);
      const result = { added: 0, skipped: 0 };
      let failure: unknown;
      const existingReq = store.getAll();
      existingReq.onsuccess = () => {
        try {
          const identities = new Map<string, ArrayBuffer[]>();
          const remember = (record: StoredAsset) => {
            const key = assetIdentity(record);
            const pixels = identities.get(key) ?? [];
            pixels.push(record.imageBytes);
            identities.set(key, pixels);
          };
          for (const raw of existingReq.result as StoredAsset[]) {
            const record = raw.imageBytes?.byteLength > 0
              ? this.normalizeStoredRecord(raw)
              : raw.id === undefined ? undefined : legacy.get(raw.id);
            if (record?.imageBytes?.byteLength) remember(record);
          }
          for (const record of prepared) {
            const duplicates = identities.get(assetIdentity(record)) ?? [];
            if (duplicates.some((bytes) => equalImageBytes(bytes, record.imageBytes))) {
              result.skipped += 1;
              continue;
            }
            store.add(record);
            remember(record);
            result.added += 1;
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('合并导入失败，未写入任何新作品'));
      tx.onerror = () => reject(tx.error);
    });
  }

  public async delete(id: number): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).delete(id);
      tx.oncomplete = () => {
        this.revokeDisplayUrl(id);
        resolve(true);
      };
      tx.onabort = () => reject(tx.error || new Error('删除作品失败，原作品保持不变'));
      tx.onerror = () => reject(tx.error || new Error('删除作品失败'));
    });
  }

  public async clearAll(): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ASSET_STORE, 'readwrite');
      tx.objectStore(ASSET_STORE).clear();
      tx.oncomplete = () => {
        this.revokeAllDisplayUrls();
        resolve(true);
      };
      tx.onabort = () => reject(tx.error || new Error('清空作品失败，原作品保持不变'));
      tx.onerror = () => reject(tx.error || new Error('清空作品失败'));
    });
  }
}
export const assetRepository = new AssetRepository();
