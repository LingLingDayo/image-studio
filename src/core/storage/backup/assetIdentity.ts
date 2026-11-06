import type { MediaAsset } from '@/types/asset';

export function assetIdentity(asset: Partial<MediaAsset>): string {
  return JSON.stringify({
    prompt: asset.prompt ?? '',
    revisedPrompt: asset.revisedPrompt ?? '',
    model: asset.model ?? '',
    size: asset.size ?? '',
    ratio: asset.ratio ?? '',
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    targetResolution: asset.targetResolution ?? '',
    targetRatio: asset.targetRatio ?? '',
    targetSize: asset.targetSize ?? '',
    targetFormat: asset.targetFormat ?? asset.format ?? '',
    quality: asset.quality ?? '',
    format: asset.format ?? '',
    transparent: asset.transparent ?? false,
    moderation: asset.moderation ?? '',
    duration: asset.duration ?? '',
    timestamp: asset.timestamp ?? 0,
    type: asset.type ?? 't2i',
    referenceImages: asset.referenceImages ?? []
  });
}

export function equalImageBytes(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  return a.every((value, index) => value === b[index]);
}
