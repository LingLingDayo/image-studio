import { describe, it, expect, beforeEach } from 'vitest';
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
});
