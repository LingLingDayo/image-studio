import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { reactive } from 'vue';
import { assetRepository } from './AssetRepository';
import { dataUrlToBlob } from './imageBlob';
import type { MediaAsset } from '@/types/asset';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BLOB = dataUrlToBlob(`data:image/png;base64,${PNG_B64}`);

function createAsset(overrides: Partial<Omit<MediaAsset, 'id'>> = {}): Omit<MediaAsset, 'id'> {
  return {
    url: '',
    blob: PNG_BLOB,
    prompt: 'test prompt',
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'medium',
    format: 'png',
    duration: '3.2s',
    timestamp: Date.now(),
    isFavorite: false,
    type: 't2i',
    ...overrides
  };
}

describe('AssetRepository (AssetRepository.ts)', () => {
  beforeEach(async () => {
    await assetRepository.clearAll();
  });

  it('should persist image pixels as a blob and hydrate a local object URL', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'local blob' }));
    expect(saved.id).toBeDefined();
    expect(saved.blob).toBeInstanceOf(Blob);
    expect(saved.blob?.size).toBeGreaterThan(0);
    expect(saved.url.startsWith('blob:')).toBe(true);

    const all = await assetRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].prompt).toBe('local blob');
    expect(all[0].blob).toBeInstanceOf(Blob);
    expect(all[0].url.startsWith('blob:')).toBe(true);
  });

  it('records the actual PNG format while preserving the requested JPEG format and bytes', async () => {
    const wrongMimeBlob = new Blob([await PNG_BLOB.arrayBuffer()], { type: 'image/jpeg' });
    const saved = await assetRepository.save(createAsset({ blob: wrongMimeBlob, format: 'jpeg', targetFormat: 'jpeg' }));
    expect(saved.format).toBe('png');
    expect(saved.targetFormat).toBe('jpeg');
    expect(saved.blob.type).toBe('image/png');
    expect(new Uint8Array(await saved.blob.arrayBuffer())).toEqual(new Uint8Array(await PNG_BLOB.arrayBuffer()));

    const [reloaded] = await assetRepository.getAll();
    expect(reloaded.format).toBe('png');
    expect(reloaded.targetFormat).toBe('jpeg');
    expect(reloaded.blob.type).toBe('image/png');
  });

  it('preserves requested format and correct actual format when metadata is updated', async () => {
    const saved = await assetRepository.save(createAsset({ format: 'jpeg', targetFormat: 'jpeg' }));
    await assetRepository.update({ ...saved, format: 'jpeg', isFavorite: true });
    const [reloaded] = await assetRepository.getAll();
    expect(reloaded.format).toBe('png');
    expect(reloaded.targetFormat).toBe('jpeg');
    expect(reloaded.blob.type).toBe('image/png');
    expect(reloaded.isFavorite).toBe(true);
  });
  it.each(['auto', 'low'])('should preserve %s moderation when saving and reloading an asset', async (moderation) => {
    const saved = await assetRepository.save(createAsset({ moderation }));
    expect(saved.moderation).toBe(moderation);

    const all = await assetRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].moderation).toBe(moderation);
  });

  it('should update moderation without dropping the existing image pixels', async () => {
    const saved = await assetRepository.save(createAsset({ moderation: 'low' }));
    await assetRepository.update({ ...saved, moderation: 'auto' });

    const all = await assetRepository.getAll();
    expect(all[0].moderation).toBe('auto');
    expect(all[0].blob?.size).toBe(PNG_BLOB.size);
  });

  it('should update asset favorite flag without dropping the blob', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'favorite test' }));
    saved.isFavorite = true;
    await assetRepository.update(saved);

    const all = await assetRepository.getAll();
    expect(all[0].isFavorite).toBe(true);
    expect(all[0].blob).toBeInstanceOf(Blob);
  });

  it('should hard-delete asset pixels from IndexedDB', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'to delete' }));
    expect(saved.id).toBeDefined();

    await assetRepository.delete(saved.id as number);

    const all = await assetRepository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should hard-clear all assets from IndexedDB', async () => {
    await assetRepository.save(createAsset({ prompt: '1' }));
    await assetRepository.save(createAsset({ prompt: '2' }));

    await assetRepository.clearAll();
    const all = await assetRepository.getAll();
    expect(all).toHaveLength(0);
  });

  it('should reject saving an asset without local image bytes', async () => {
    await expect(
      assetRepository.save(createAsset({ blob: new Blob([]) }))
    ).rejects.toThrow('缺少本地图像数据');
  });

  it('should update favorite flag using updateFavorite directly', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'fav test' }));
    expect(saved.isFavorite).toBe(false);

    await assetRepository.updateFavorite(saved.id as number, true);
    let all = await assetRepository.getAll();
    expect(all[0].isFavorite).toBe(true);

    await assetRepository.updateFavorite(saved.id as number, false);
    all = await assetRepository.getAll();
    expect(all[0].isFavorite).toBe(false);
  });

  it('should safely update assets wrapped in Vue reactive proxies without DataCloneError', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'proxy test' }));
    const proxiedAsset = reactive({ ...saved, isFavorite: true, referenceImages: ['blob:ref1'] });
    await expect(assetRepository.update(proxiedAsset)).resolves.toBe(true);

    const all = await assetRepository.getAll();
    expect(all[0].isFavorite).toBe(true);
    expect(all[0].referenceImages).toEqual(['blob:ref1']);
  });
});

describe('AssetRepository database upgrades', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function openDatabase(version?: number, onUpgrade?: (db: IDBDatabase) => void): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = version === undefined
        ? indexedDB.open('ImageStudioDB')
        : indexedDB.open('ImageStudioDB', version);
      request.onupgradeneeded = () => onUpgrade?.(request.result);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  it.each([1, 2, 3])('preserves version %s records and existing indexes while adding missing indexes', async (version) => {
    const imageBytes = await PNG_BLOB.arrayBuffer();
    const legacyRecord = {
      id: 42,
      url: '',
      imageBytes,
      imageMime: 'image/png',
      prompt: 'existing artwork',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'medium',
      duration: '2.0s',
      timestamp: 1000,
      isFavorite: true,
      legacyLabel: 'keep unknown metadata'
    };
    const oldDB = await openDatabase(version, (db) => {
      const store = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('legacyPrompt', 'prompt', { unique: false });
      store.add(legacyRecord);
    });
    oldDB.close();

    const { assetRepository: upgradedRepository } = await import('./AssetRepository');
    const all = await upgradedRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 42, prompt: 'existing artwork', isFavorite: true });
    expect(all[0].blob.type).toBe('image/png');
    expect(new Uint8Array(await all[0].blob.arrayBuffer())).toEqual(new Uint8Array(imageBytes));

    const upgradedDB = await openDatabase();
    expect(upgradedDB.version).toBe(4);
    const store = upgradedDB.transaction('assets', 'readonly').objectStore('assets');
    expect([...store.indexNames]).toEqual(['isFavorite', 'legacyPrompt', 'model', 'timestamp']);
    expect(store.index('timestamp').keyPath).toBe('timestamp');
    const rawRecord = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = store.get(42);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(rawRecord).toMatchObject({ id: 42, legacyLabel: 'keep unknown metadata' });
    expect(new Uint8Array(rawRecord.imageBytes as ArrayBuffer)).toEqual(new Uint8Array(imageBytes));
    upgradedDB.close();

    const saved = await upgradedRepository.save(createAsset({ prompt: 'new artwork', timestamp: 2000 }));
    expect(saved.id).toBeGreaterThan(42);
    expect(await upgradedRepository.updateFavorite(42, false)).toBe(true);
    const reloaded = await upgradedRepository.getAll();
    expect(reloaded).toHaveLength(2);
    expect(reloaded.find((asset) => asset.id === 42)?.isFavorite).toBe(false);
  });

  it('reads legacy incorrect format declarations without changing stored pixels or losing the requested format', async () => {
    const imageBytes = await PNG_BLOB.arrayBuffer();
    const { blob: _blob, ...metadata } = createAsset({ format: 'jpeg' });
    const oldDB = await openDatabase(4, (db) => {
      const store = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('isFavorite', 'isFavorite', { unique: false });
      store.createIndex('model', 'model', { unique: false });
      store.add({ ...metadata, id: 8, imageBytes, imageMime: 'image/jpeg' });
    });
    oldDB.close();

    const { assetRepository: legacyRepository } = await import('./AssetRepository');
    const [loaded] = await legacyRepository.getAll();
    expect(loaded).toMatchObject({ id: 8, format: 'png', targetFormat: 'jpeg' });
    expect(loaded.blob.type).toBe('image/png');
    expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(new Uint8Array(imageBytes));

    await legacyRepository.update({ ...loaded, isFavorite: true });
    const [updated] = await legacyRepository.getAll();
    expect(updated).toMatchObject({ format: 'png', targetFormat: 'jpeg', isFavorite: true });
  });
  it('keeps an existing version 4 database readable and writable without rebuilding it', async () => {
    const { blob: _blob, ...metadata } = createAsset({ prompt: 'existing version 4', moderation: 'low' });
    const existingDB = await openDatabase(4, (db) => {
      const store = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('isFavorite', 'isFavorite', { unique: false });
      store.createIndex('model', 'model', { unique: false });
      store.add({ ...metadata, id: 7, imageBytes: new ArrayBuffer(8), imageMime: 'image/png' });
    });
    existingDB.close();

    const { assetRepository: currentRepository } = await import('./AssetRepository');
    const all = await currentRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 7, prompt: 'existing version 4', moderation: 'low' });
    await currentRepository.save(createAsset({ prompt: 'new version 4', moderation: 'auto' }));
    expect(await currentRepository.getAll()).toHaveLength(2);
  });
});
