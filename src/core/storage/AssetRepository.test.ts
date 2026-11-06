import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { reactive } from 'vue';
import { Blob as NativeBlob } from 'node:buffer';
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

describe('AssetRepository 合并与事务安全', () => {
  beforeEach(async () => {
    await assetRepository.clearAll();
  });

  it('同长度的新图片也会替换像素，不能只按文件大小判断', async () => {
    const first = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
    const second = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], { type: 'image/jpeg' });
    const saved = await assetRepository.save(createAsset({ blob: first }));
    await assetRepository.update({ ...saved, blob: second });
    const [loaded] = await assetRepository.getAll();
    expect(new Uint8Array(await loaded.blob.arrayBuffer())).toEqual(new Uint8Array(await second.arrayBuffer()));
    expect(loaded.format).toBe('jpeg');
    expect(loaded.targetFormat).toBe('png');
  });

  it('合并生成本站新id，跳过原库和本次导入中的重复作品', async () => {
    const existing = await assetRepository.save(createAsset({ prompt: 'old', timestamp: 1000 }));
    const imported: MediaAsset = { ...createAsset({ prompt: 'new', timestamp: 2000 }), id: existing.id };
    const result = await assetRepository.mergeAssets([existing, imported, imported]);
    expect(result).toEqual({ added: 1, skipped: 2 });
    const all = await assetRepository.getAll();
    expect(all).toHaveLength(2);
    expect(all.find((asset) => asset.id === existing.id)?.prompt).toBe('old');
    expect(all.find((asset) => asset.prompt === 'new')?.id).not.toBe(existing.id);
  });

  it('批量写入中途失败时回滚整个导入，不影响原作品', async () => {
    await assetRepository.save(createAsset({ prompt: 'original', timestamp: 1000 }));
    const originalAdd = IDBObjectStore.prototype.add;
    let added = 0;
    const spy = vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (++added === 2) throw new DOMException('forced failure', 'DataCloneError');
      return originalAdd.call(this, value, key);
    });
    try {
      await expect(assetRepository.mergeAssets([
        createAsset({ prompt: 'first', timestamp: 2000 }),
        createAsset({ prompt: 'second', timestamp: 3000 })
      ])).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    const all = await assetRepository.getAll();
    expect(all.map((asset) => asset.prompt)).toEqual(['original']);
  });
});

describe('AssetRepository 旧本地图片与未知记录', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function withDatabase<T>(run: (db: IDBDatabase, finish: (result: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('ImageStudioDB', 4);
      open.onupgradeneeded = () => {
        const store = open.result.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
        for (const name of ['timestamp', 'isFavorite', 'model']) store.createIndex(name, name);
      };
      open.onsuccess = () => run(open.result, (result) => { open.result.close(); resolve(result); }, reject);
      open.onerror = () => reject(open.error);
    });
  }

  function seed(records: unknown[]): Promise<void> {
    return withDatabase((db, finish, fail) => {
      const tx = db.transaction('assets', 'readwrite');
      for (const record of records) tx.objectStore('assets').add(record);
      tx.oncomplete = () => finish(undefined);
      tx.onabort = () => fail(tx.error);
    });
  }

  function raw(id: number): Promise<Record<string, unknown>> {
    return withDatabase((db, finish, fail) => {
      const tx = db.transaction('assets', 'readonly');
      const request = tx.objectStore('assets').get(id);
      tx.oncomplete = () => finish(request.result);
      tx.onabort = () => fail(tx.error);
    });
  }

  it('兼容本地DataURL和合法旧Blob，不访问网络且不改原始记录', async () => {
    vi.stubGlobal('Blob', NativeBlob);
    const legacyBlob = new Blob([await PNG_BLOB.arrayBuffer()], { type: 'image/png' });
    const { blob: _blob, ...metadata } = createAsset({ timestamp: 1000 });
    await seed([
      { ...metadata, id: 41, url: `data:image/png;base64,${PNG_B64}`, legacyLabel: 'keep-data-url' },
      { ...metadata, id: 42, blob: legacyBlob, legacyLabel: 'keep-blob' }
    ]);
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const { assetRepository: repository } = await import('./AssetRepository');
    const snapshot = await repository.getSnapshot();
    expect(snapshot.unsupportedCount).toBe(0);
    expect(snapshot.assets).toHaveLength(2);
    expect(snapshot.assets.every((asset) => asset.blob.type === 'image/png' && asset.url === '')).toBe(true);
    expect(network).not.toHaveBeenCalled();
    expect((await raw(41)).url).toBe(`data:image/png;base64,${PNG_B64}`);
    expect((await raw(42)).legacyLabel).toBe('keep-blob');
  });

  it('未识别远程旧记录保持原样，并向备份提供明确计数', async () => {
    const { blob: _blob, ...metadata } = createAsset();
    await seed([{ ...metadata, id: 8, url: 'https://old.example.com/private.png', custom: 'preserve' }]);
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    const { assetRepository: repository } = await import('./AssetRepository');
    expect(await repository.getSnapshot()).toMatchObject({ assets: [], unsupportedCount: 1 });
    expect(await raw(8)).toMatchObject({ url: 'https://old.example.com/private.png', custom: 'preserve' });
    expect(network).not.toHaveBeenCalled();
  });

  it('旧DataURL作品更新时准备像素后写回，保留额外元数据', async () => {
    const { blob: _blob, ...metadata } = createAsset();
    await seed([{ ...metadata, id: 42, url: `data:image/png;base64,${PNG_B64}`, custom: 'preserve' }]);
    const { assetRepository: repository } = await import('./AssetRepository');
    const [asset] = await repository.getAll();
    await expect(repository.update({ ...asset, isFavorite: true })).resolves.toBe(true);
    const updated = await raw(42);
    expect(updated).toMatchObject({ id: 42, isFavorite: true, custom: 'preserve', url: '' });
    expect(updated.imageBytes).toBeInstanceOf(ArrayBuffer);
    expect((await repository.getAll())[0].blob.size).toBe(PNG_BLOB.size);
  });

  it('空Blob元数据更新不能清掉旧DataURL的唯一图像数据', async () => {
    const { blob: _blob, ...metadata } = createAsset();
    await seed([{ ...metadata, id: 42, url: `data:image/png;base64,${PNG_B64}` }]);
    const { assetRepository: repository } = await import('./AssetRepository');
    const [asset] = await repository.getAll();
    await repository.update({ ...asset, blob: new Blob([]), isFavorite: true });
    expect((await repository.getAll())[0].blob.size).toBe(PNG_BLOB.size);
  });
});

describe('AssetRepository 删除事务完成前回滚', () => {
  beforeEach(async () => { await assetRepository.clearAll(); });

  it('delete请求成功后事务abort，仍保留作品与可用显示URL', async () => {
    const saved = await assetRepository.save(createAsset({ prompt: 'keep on abort' }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const original = IDBObjectStore.prototype.delete;
    const failingDelete = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
      const request = original.call(this, key);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    try {
      await expect(assetRepository.delete(saved.id!)).rejects.toThrow();
      expect(revoke).not.toHaveBeenCalledWith(saved.url);
    } finally {
      failingDelete.mockRestore();
      revoke.mockRestore();
    }
    const all = await assetRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].prompt).toBe('keep on abort');
  });

  it('clear请求成功后事务abort，仍保留所有作品与显示URL', async () => {
    const first = await assetRepository.save(createAsset({ prompt: 'first' }));
    const second = await assetRepository.save(createAsset({ prompt: 'second' }));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const original = IDBObjectStore.prototype.clear;
    const failingClear = vi.spyOn(IDBObjectStore.prototype, 'clear').mockImplementation(function (this: IDBObjectStore) {
      const request = original.call(this);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    try {
      await expect(assetRepository.clearAll()).rejects.toThrow();
      expect(revoke).not.toHaveBeenCalledWith(first.url);
      expect(revoke).not.toHaveBeenCalledWith(second.url);
    } finally {
      failingClear.mockRestore();
      revoke.mockRestore();
    }
    expect(await assetRepository.getAll()).toHaveLength(2);
  });
});
