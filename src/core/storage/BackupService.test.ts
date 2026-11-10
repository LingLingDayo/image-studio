import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { MediaAsset } from '@/types/asset';
import { dataUrlToBlob } from './imageBlob';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function asset(prompt = 'backup test'): Omit<MediaAsset, 'id'> {
  return { url: '', blob: dataUrlToBlob(PNG), prompt, model: 'test-model', size: '1024x1024', quality: 'low', format: 'png', targetFormat: 'jpeg', duration: '1s', timestamp: 1000, referenceImages: [PNG], isFavorite: true, type: 'i2i' };
}

async function fixture() {
  const { assetRepository } = await import('./AssetRepository');
  const service = await import('./BackupService');
  return { repository: assetRepository, ...service };
}

describe('作品备份与合并恢复', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.resetModules();
    localStorage.clear();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('备份包含图片、参考图与生成设定，不包含站点密钥和额外字段', async () => {
    const { repository, createBackup } = await fixture();
    localStorage.setItem('gpt_image_api_key', 'sensitive-key-not-for-backup');
    await repository.save({ ...asset(), complexity: 'high', outputCompression: 0, frameCount: 9, frameDurationMs: 200, apiKey: 'also-not-for-backup' } as Omit<MediaAsset, 'id'>);
    const backup = await createBackup();
    const text = await backup.blob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toMatchObject({ format: 'image-studio-backup', version: 1 });
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0].metadata).toMatchObject({ prompt: 'backup test', targetFormat: 'jpeg', referenceImages: [PNG] });
    expect(parsed.assets[0].image.mime).toBe('image/png');
    expect(parsed.assets[0].metadata).toMatchObject({ complexity: 'high', outputCompression: 0, frameCount: 9, frameDurationMs: 200 });
    expect(text).not.toContain('sensitive-key');
    expect(text).not.toContain('also-not-for-backup');
    expect(parsed.assets[0].metadata.id).toBeUndefined();
  });


  it.each([
    { format: 'gif', mime: 'image/gif', contents: 'GIF89a-test-image-bytes' },
    { format: 'svg', mime: 'image/svg+xml', contents: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>' }
  ])('备份和恢复 $format 原件及参考图不会改变字节与 MIME', async ({ format, mime, contents }) => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    const dataUrl = `data:${mime};base64,${btoa(contents)}`;
    await repository.save({ ...asset(), blob: dataUrlToBlob(dataUrl), format, targetFormat: format, referenceImages: [dataUrl] });
    const backup = await createBackup();
    const serialized = JSON.parse(await backup.blob.text());
    expect(serialized.assets[0].image.mime).toBe(mime);
    expect(serialized.assets[0].metadata).toMatchObject({ format, targetFormat: format, referenceImages: [dataUrl] });
    await repository.clearAll();
    const preview = await prepareBackup(backup.blob);
    expect(await importBackup(preview)).toEqual({ added: 1, skipped: 0 });
    const [restored] = await repository.getAll();
    expect(restored.blob.type).toBe(mime);
    expect(await restored.blob.text()).toBe(contents);
    expect(restored.format).toBe(format);
  });

  it('选择备份只预览，不写入；确认后合并新增并跳过重复', async () => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    const original = await repository.save(asset('original'));
    const backup = await createBackup();
    const serialized = JSON.parse(await backup.blob.text());
    serialized.assets.push({ ...serialized.assets[0], metadata: { ...serialized.assets[0].metadata, prompt: 'new item', id: original.id } });
    const preview = await prepareBackup(new Blob([JSON.stringify(serialized)]));
    expect(preview).toMatchObject({ total: 2, added: 1, skipped: 1 });
    expect(await repository.getAll()).toHaveLength(1);
    expect(await importBackup(preview)).toEqual({ added: 1, skipped: 1 });
    const all = await repository.getAll();
    expect(all).toHaveLength(2);
    expect(all.find((item) => item.id === original.id)?.prompt).toBe('original');
    expect(all.find((item) => item.prompt === 'new item')?.id).not.toBe(original.id);
    const repeated = await prepareBackup(new Blob([JSON.stringify(serialized)]));
    expect(repeated.added).toBe(0);
    expect(await importBackup(repeated)).toEqual({ added: 0, skipped: 2 });
  });

  it('确认导入时重新检查当前库，预览后新增的同一作品不会重复导入', async () => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    await repository.save(asset());
    const backup = await createBackup();
    await repository.clearAll();
    const preview = await prepareBackup(backup.blob);
    expect(preview.added).toBe(1);
    await repository.save(asset());
    expect(await importBackup(preview)).toEqual({ added: 0, skipped: 1 });
    expect(await repository.getAll()).toHaveLength(1);
  });

  it('损坏、错误版本、非法base64和非图片不会改变原库', async () => {
    const { repository, createBackup, prepareBackup } = await fixture();
    await repository.save(asset());
    const backup = JSON.parse(await (await createBackup()).blob.text());
    await expect(prepareBackup(new Blob(['not json']))).rejects.toThrow('JSON');
    await expect(prepareBackup(new Blob([JSON.stringify({ ...backup, version: 99 })]))).rejects.toThrow('版本');
    const broken = structuredClone(backup);
    broken.assets[0].image.base64 = '!invalid';
    await expect(prepareBackup(new Blob([JSON.stringify(broken)]))).rejects.toThrow('Base64');
    broken.assets[0].image.base64 = btoa('not an image');
    await expect(prepareBackup(new Blob([JSON.stringify(broken)]))).rejects.toThrow('图片');
    expect(await repository.getAll()).toHaveLength(1);
  });

  it('拒绝远程参考图和超量资产，不发生网络请求', async () => {
    const { repository, createBackup, prepareBackup, MAX_BACKUP_ASSETS } = await fixture();
    await repository.save(asset());
    const backup = JSON.parse(await (await createBackup()).blob.text());
    const network = vi.fn();
    vi.stubGlobal('fetch', network);
    backup.assets[0].metadata.referenceImages = ['https://other.example.com/private.png'];
    await expect(prepareBackup(new Blob([JSON.stringify(backup)]))).rejects.toThrow('参考图');
    backup.assets = new Array(MAX_BACKUP_ASSETS + 1).fill({});
    await expect(prepareBackup(new Blob([JSON.stringify(backup)]))).rejects.toThrow('数量');
    expect(network).not.toHaveBeenCalled();
  });

  it('没有经过预览校验的对象不能直接导入，取消预览后也不能导入', async () => {
    const { repository, createBackup, prepareBackup, importBackup, releaseBackup } = await fixture();
    await repository.save(asset());
    const preview = await prepareBackup((await createBackup()).blob);
    releaseBackup(preview);
    await expect(importBackup(preview)).rejects.toThrow('重新选择');
    await expect(importBackup({ total: 0, added: 0, skipped: 0, unsupportedCount: 0 })).rejects.toThrow('重新选择');
  });

  it('超限文件在读取内容前拒绝，损坏图片解码不会写入', async () => {
    const { repository, createBackup, prepareBackup, MAX_BACKUP_FILE_BYTES } = await fixture();
    await repository.save(asset());
    const backup = await createBackup();
    const oversized = new Blob(['{}']);
    Object.defineProperty(oversized, 'size', { value: MAX_BACKUP_FILE_BYTES + 1 });
    const read = vi.spyOn(oversized, 'text');
    await expect(prepareBackup(oversized)).rejects.toThrow('128 MiB');
    expect(read).not.toHaveBeenCalled();
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal('Image', BrokenImage);
    await expect(prepareBackup(backup.blob)).rejects.toThrow('无法解码');
    expect(await repository.getAll()).toHaveLength(1);
  });

  it('未知旧记录明确阻止不完整导出，既有收藏也不会被重复导入覆盖', async () => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    const saved = await repository.save(asset());
    const backup = await createBackup();
    await repository.updateFavorite(saved.id!, false);
    const preview = await prepareBackup(backup.blob);
    expect(preview).toMatchObject({ added: 0, skipped: 1 });
    await importBackup(preview);
    expect((await repository.getAll())[0].isFavorite).toBe(false);
    vi.spyOn(repository, 'getSnapshot').mockResolvedValueOnce({ assets: [], unsupportedCount: 1 });
    await expect(createBackup()).rejects.toThrow('无法识别的旧作品');
    expect(await repository.getAll()).toHaveLength(1);
  });

  it('保留有效的零时间戳，并拒绝超出Date范围的时间戳', async () => {
    const { repository, createBackup, prepareBackup } = await fixture();
    await repository.save({ ...asset(), timestamp: 0 });
    expect((await repository.getAll())[0].timestamp).toBe(0);
    const backup = await createBackup();
    const preview = await prepareBackup(backup.blob);
    expect(preview).toMatchObject({ added: 0, skipped: 1 });
    const invalid = JSON.parse(await backup.blob.text());
    invalid.assets[0].metadata.timestamp = Number.MAX_VALUE;
    await expect(prepareBackup(new Blob([JSON.stringify(invalid)]))).rejects.toThrow('时间戳');
    expect((await repository.getAll())[0].timestamp).toBe(0);
  });
  it('错误事务后可重试已验证的备份；非法元数据不写入', async () => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    await repository.save(asset());
    const backup = await createBackup();
    const preview = await prepareBackup(backup.blob);
    const merge = vi.spyOn(repository, 'mergeAssets').mockRejectedValueOnce(new Error('quota failure'));
    await expect(importBackup(preview)).rejects.toThrow('quota failure');
    merge.mockRestore();
    await expect(importBackup(preview)).resolves.toEqual({ added: 0, skipped: 1 });
    const invalid = JSON.parse(await backup.blob.text());
    invalid.assets[0].metadata.targetResolution = ['1k'];
    await expect(prepareBackup(new Blob([JSON.stringify(invalid)]))).rejects.toThrow('分辨率');
    expect(await repository.getAll()).toHaveLength(1);
  });
});


describe('新增生成参数备份', () => {
  it('复杂度与 GIF 帧参数导入后完整保留', async () => {
    const { repository, createBackup, prepareBackup, importBackup } = await fixture();
    await repository.clearAll();
    await repository.save({ ...asset(), complexity: 'medium', outputCompression: 0, frameCount: 12, frameDurationMs: 300 });
    const backup = await createBackup();
    await repository.clearAll();
    await importBackup(await prepareBackup(backup.blob));
    expect((await repository.getAll())[0]).toMatchObject({ complexity: 'medium', outputCompression: 0, frameCount: 12, frameDurationMs: 300 });
  });
});
