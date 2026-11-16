import { dataUrlToBlob, detectBlobImageMimeType } from '@/core/storage/imageBlob';

export interface CopyImageSource {
  url?: string;
  blob?: Blob;
}

async function resolveImageBlob(source: CopyImageSource): Promise<Blob> {
  if (source.blob && source.blob.size > 0) {
    return source.blob;
  }
  const url = source.url?.trim() || '';
  if (!url) {
    throw new Error('当前图片数据不可用，无法复制');
  }
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`读取图片失败: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error('读取图片失败: 空图像数据');
  }
  return blob;
}

async function renderBlobAsPng(blob: Blob, rotationDeg: number): Promise<Blob> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('当前环境不支持图片转换');
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('原图无法解码，复制失败'));
      img.src = objectUrl;
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('图片尺寸无效，无法复制');
    }

    const normDeg = ((rotationDeg % 360) + 360) % 360;
    const isSwap = normDeg === 90 || normDeg === 270;
    const canvas = document.createElement('canvas');
    canvas.width = isSwap ? height : width;
    canvas.height = isSwap ? width : height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('当前浏览器无法处理图片，复制失败');
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normDeg * Math.PI) / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!pngBlob || pngBlob.size === 0) {
      throw new Error('图片转换 PNG 失败，无法复制');
    }
    return pngBlob;
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // 忽略清理临时 URL 失败
    }
  }
}

/**
 * 将图片写入系统剪贴板（Clipboard API 仅稳定支持 image/png，非 PNG 或存在旋转时自动转为 PNG）。
 */
export async function copyImageToClipboard(
  source: CopyImageSource,
  rotationDeg: number = 0
): Promise<void> {
  if (!source.url && (!source.blob || source.blob.size === 0)) {
    throw new Error('当前图片数据不可用，无法复制');
  }
  if (typeof navigator === 'undefined' || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器或环境不支持复制图片到剪贴板');
  }

  const rawBlob = await resolveImageBlob(source);
  const detectedMime = rawBlob.type?.startsWith('image/')
    ? rawBlob.type
    : await detectBlobImageMimeType(rawBlob);
  const normDeg = ((rotationDeg % 360) + 360) % 360;

  let pngBlob: Blob;
  if (normDeg === 0 && detectedMime === 'image/png') {
    pngBlob = rawBlob.type === 'image/png' ? rawBlob : rawBlob.slice(0, rawBlob.size, 'image/png');
  } else {
    const typedSource = detectedMime && rawBlob.type !== detectedMime
      ? rawBlob.slice(0, rawBlob.size, detectedMime)
      : rawBlob;
    pngBlob = await renderBlobAsPng(typedSource, normDeg);
  }

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}
