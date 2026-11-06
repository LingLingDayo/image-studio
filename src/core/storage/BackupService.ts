import type { MediaAsset } from '@/types/asset';
import { assetRepository } from './AssetRepository';
import { dataUrlToBlob, detectImageMimeType, fileToDataUrl, mimeToImageFormat } from './imageBlob';
import { assetIdentity, equalImageBytes } from './backup/assetIdentity';
import { loadImageDimensions } from '@/utils/image';
import { formatFullTime } from '@/utils/download';

export const MAX_BACKUP_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_BACKUP_ASSETS = 1000;
const MAX_TOTAL_IMAGE_BYTES = 80 * 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 64 * 1024 * 1024;
const BACKUP_FORMAT = 'image-studio-backup';
const BACKUP_VERSION = 1;

type AssetMetadata = Omit<MediaAsset, 'id' | 'blob' | 'url'>;
interface SerializedAsset {
  metadata: AssetMetadata;
  image: { mime: string; base64: string };
}
interface BackupDocument {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  assets: SerializedAsset[];
}
export interface PreparedBackup {
  readonly total: number;
  readonly added: number;
  readonly skipped: number;
  readonly unsupportedCount: number;
}
const preparedBackups = new WeakMap<PreparedBackup, Array<Omit<MediaAsset, 'id'>>>();

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式无效`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength = 100000): string {
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`${label}字段无效或过长`);
  return value;
}

function readMetadata(value: unknown, index: number): AssetMetadata {
  const raw = object(value, `第 ${index + 1} 张作品`);
  const timestamp = raw.timestamp;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp < 0 || !Number.isFinite(new Date(timestamp).getTime())) throw new Error('作品时间戳无效');
  const meta: AssetMetadata = {
    prompt: text(raw.prompt, 'prompt'),
    model: text(raw.model, 'model', 1024),
    size: text(raw.size, 'size', 128),
    quality: text(raw.quality, 'quality', 128),
    duration: text(raw.duration, 'duration', 128),
    timestamp,
    isFavorite: raw.isFavorite === true,
    referenceImages: []
  };
  const strings = ['batchId', 'revisedPrompt', 'ratio', 'targetRatio', 'targetSize', 'targetFormat', 'format', 'moderation'] as const;
  for (const key of strings) {
    if (raw[key] !== undefined) meta[key] = text(raw[key], key, key === 'revisedPrompt' ? 100000 : 1024);
  }
  if (raw.targetResolution !== undefined) {
    if (typeof raw.targetResolution !== 'string' || !['auto', '1k', '2k', '4k'].includes(raw.targetResolution)) throw new Error('设定分辨率无效');
    meta.targetResolution = raw.targetResolution as MediaAsset['targetResolution'];
  }
  for (const key of ['width', 'height'] as const) {
    const val = raw[key];
    if (val !== undefined) {
      if (typeof val !== 'number' || !Number.isInteger(val) || val <= 0 || val > 16384) throw new Error('图片尺寸无效');
      meta[key] = val;
    }
  }
  for (const key of ['transparent', 'isFavorite'] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new Error(`${key}字段无效`);
    if (raw[key] !== undefined) meta[key] = raw[key] as boolean;
  }
  if (raw.type !== undefined) {
    if (raw.type !== 't2i' && raw.type !== 'i2i') throw new Error('作品类型无效');
    meta.type = raw.type;
  }
  if (raw.status !== undefined && raw.status !== 'succeeded') throw new Error('备份只支持有图像的成功作品');
  if (raw.status === 'succeeded') meta.status = raw.status;
  if (raw.referenceImages !== undefined) {
    if (!Array.isArray(raw.referenceImages) || raw.referenceImages.length > 32) throw new Error('参考图列表无效或数量过多');
    meta.referenceImages = raw.referenceImages.map((url) => text(url, '参考图', MAX_BACKUP_FILE_BYTES));
  }
  return meta;
}

function addImageBudget(budget: { bytes: number }, size: number): void {
  if (size <= 0 || size > MAX_IMAGE_BYTES) throw new Error('单张图片不能为空或超过 32 MiB');
  budget.bytes += size;
  if (budget.bytes > MAX_TOTAL_IMAGE_BYTES) throw new Error('作品及参考图总数据超过 80 MiB，请先单独下载重要作品并保留站点数据');
}

async function validateImage(blob: Blob, mime: string): Promise<void> {
  const actualMime = detectImageMimeType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  if (!actualMime || actualMime !== mime) throw new Error('图片内容无效或与格式声明不一致');
  const url = URL.createObjectURL(blob);
  try {
    const dims = await loadImageDimensions(url, 5000);
    if (dims.width > 16384 || dims.height > 16384 || dims.width * dims.height > MAX_IMAGE_PIXELS) {
      throw new Error('图片解码尺寸过大');
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeImage(mimeValue: unknown, base64Value: unknown, budget: { bytes: number }): Promise<Blob> {
  const format = mimeToImageFormat(text(mimeValue, '图片格式', 128));
  if (!format) throw new Error('图片仅支持 PNG、JPEG 或 WebP');
  const mime = `image/${format}`;
  const base64 = text(base64Value, 'Base64', MAX_BACKUP_FILE_BYTES);
  if (!base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('图片 Base64 数据无效');
  const size = (base64.length / 4) * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  addImageBudget(budget, size);
  const blob = dataUrlToBlob(`data:${mime};base64,${base64}`);
  await validateImage(blob, mime);
  return blob;
}

async function validateReferences(references: string[], budget: { bytes: number }): Promise<void> {
  for (const reference of references) {
    const parts = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(reference);
    if (!parts) throw new Error('参考图仅支持 PNG、JPEG、WebP 的本地 Data URL，不会自动下载远程图片');
    await decodeImage(parts[1], parts[2], budget);
  }
}

async function duplicateCounts(incoming: Array<Omit<MediaAsset, 'id'>>, current: MediaAsset[]): Promise<{ added: number; skipped: number }> {
  const keys = new Set(incoming.map(assetIdentity));
  const identities = new Map<string, ArrayBuffer[]>();
  for (const asset of current) {
    const key = assetIdentity(asset);
    if (!keys.has(key)) continue;
    const values = identities.get(key) ?? [];
    values.push(await asset.blob.arrayBuffer());
    identities.set(key, values);
  }
  const result = { added: 0, skipped: 0 };
  for (const asset of incoming) {
    const key = assetIdentity(asset);
    const pixels = await asset.blob.arrayBuffer();
    const values = identities.get(key) ?? [];
    if (values.some((existing) => equalImageBytes(existing, pixels))) result.skipped += 1;
    else {
      result.added += 1;
      values.push(pixels);
      identities.set(key, values);
    }
  }
  return result;
}

export async function createBackup(): Promise<{ blob: Blob; count: number; filename: string }> {
  const snapshot = await assetRepository.getSnapshot();
  if (snapshot.unsupportedCount > 0) {
    throw new Error(`存在 ${snapshot.unsupportedCount} 条无法识别的旧作品，未导出不完整备份；原始数据保持不变，请先保留站点数据并单独下载可见作品`);
  }
  if (snapshot.assets.length > MAX_BACKUP_ASSETS) throw new Error('作品数量超过 1000 张，请先单独下载重要作品并保留站点数据');
  const budget = { bytes: 0 };
  const assets: SerializedAsset[] = [];
  for (const [index, asset] of snapshot.assets.entries()) {
    const metadata = readMetadata(asset, index);
    const mime = detectImageMimeType(new Uint8Array(await asset.blob.slice(0, 12).arrayBuffer()));
    if (!mime) throw new Error(`第 ${index + 1} 张作品图片格式无法识别，未导出不完整备份`);
    addImageBudget(budget, asset.blob.size);
    await validateImage(asset.blob, mime);
    await validateReferences(metadata.referenceImages ?? [], budget);
    const dataUrl = await fileToDataUrl(asset.blob.slice(0, asset.blob.size, mime));
    metadata.format = mimeToImageFormat(mime);
    assets.push({ metadata, image: { mime, base64: dataUrl.slice(dataUrl.indexOf(',') + 1) } });
  }
  const document: BackupDocument = { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), assets };
  const blob = new Blob([JSON.stringify(document)], { type: 'application/json' });
  if (blob.size > MAX_BACKUP_FILE_BYTES) throw new Error('备份文件超过 128 MiB，请先单独下载重要作品并保留站点数据');
  return { blob, count: assets.length, filename: `image-studio-backup_${formatFullTime(Date.now()).replace(/[.: ]/g, '-')}.json` };
}

export async function prepareBackup(file: Blob): Promise<PreparedBackup> {
  if (!file.size || file.size > MAX_BACKUP_FILE_BYTES) throw new Error('请选择非空且不超过 128 MiB 的备份文件');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('备份不是有效的 JSON 文件');
  }
  const document = object(parsed, '备份');
  if (document.format !== BACKUP_FORMAT) throw new Error('不是 Image Studio 作品备份');
  if (document.version !== BACKUP_VERSION) throw new Error('备份版本不受支持');
  if (!Array.isArray(document.assets) || document.assets.length > MAX_BACKUP_ASSETS) throw new Error('备份作品数量无效或超过 1000 张');
  const budget = { bytes: 0 };
  const assets: Array<Omit<MediaAsset, 'id'>> = [];
  for (const [index, value] of document.assets.entries()) {
    const entry = object(value, '作品');
    const metadata = readMetadata(entry.metadata, index);
    const image = object(entry.image, '图片');
    const blob = await decodeImage(image.mime, image.base64, budget);
    await validateReferences(metadata.referenceImages ?? [], budget);
    assets.push({ ...metadata, targetFormat: metadata.targetFormat ?? metadata.format, format: mimeToImageFormat(blob.type), blob, url: '' });
  }
  const snapshot = await assetRepository.getSnapshot();
  const counts = await duplicateCounts(assets, snapshot.assets);
  const preview: PreparedBackup = { total: assets.length, ...counts, unsupportedCount: snapshot.unsupportedCount };
  preparedBackups.set(preview, assets);
  return preview;
}

export async function importBackup(preview: PreparedBackup): Promise<{ added: number; skipped: number }> {
  const assets = preparedBackups.get(preview);
  if (!assets) throw new Error('请重新选择并预览备份文件');
  const result = await assetRepository.mergeAssets(assets);
  preparedBackups.delete(preview);
  return result;
}

export function releaseBackup(preview?: PreparedBackup | null): void {
  if (preview) preparedBackups.delete(preview);
}
