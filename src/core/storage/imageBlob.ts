export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';

const IMAGE_FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml'
};

export function imageFormatToMimeType(format: string): string {
  return IMAGE_FORMAT_MIME_TYPES[format.toLowerCase() as ImageFormat] || 'image/png';
}

export function detectImageMimeType(bytes: Uint8Array): string | undefined {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= pngSignature.length && pngSignature.every((value, index) => bytes[index] === value)) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.subarray(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    if (!text.startsWith('<')) return undefined;
    // XML 文档只用于确认类型，不插入页面，避免执行 SVG 中的内容。
    const document = new DOMParser().parseFromString(text, 'application/xml');
    const root = document.documentElement;
    if (root?.localName === 'svg' && root.namespaceURI === 'http://www.w3.org/2000/svg' &&
      document.getElementsByTagName('parsererror').length === 0) {
      return 'image/svg+xml';
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function detectBlobImageMimeType(blob: Blob): Promise<string | undefined> {
  const signatureMime = detectImageMimeType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
  if (signatureMime) return signatureMime;
  return detectImageMimeType(new Uint8Array(await blob.arrayBuffer()));
}

export function mimeToImageFormat(mime: string): ImageFormat | undefined {
  switch (mime.toLowerCase()) {
    case 'image/png': return 'png';
    case 'image/jpeg':
    case 'image/jpg': return 'jpeg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    case 'image/svg+xml': return 'svg';
    default: return undefined;
  }
}
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) {
    throw new Error('转存图片失败: 无效的 Data URL');
  }
  const header = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const mime = header.slice(5).split(';')[0] || 'image/png';
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    if (/;base64$/i.test(header)) {
      const binary = atob(data);
      bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }
  } catch {
    throw new Error('转存图片失败: 无效的 Data URL');
  }
  return new Blob([bytes], { type: detectImageMimeType(bytes) || mime });
}

export async function urlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url);
  }

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('转存图片失败: 远程地址无法跨域读取，请使用返回 Base64 的接口');
  }
  if (!res.ok) {
    throw new Error(`转存图片失败: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  if (blob.size === 0) {
    throw new Error('转存图片失败: 空文件');
  }
  const actualMime = await detectBlobImageMimeType(blob);
  return actualMime && actualMime !== blob.type ? blob.slice(0, blob.size, actualMime) : blob;
}

export async function materializeImageBlob(source: {
  url?: string;
  b64_json?: string;
}): Promise<Blob> {
  if (source.b64_json) {
    const dataUrl = source.b64_json.startsWith('data:')
      ? source.b64_json
      : source.url?.startsWith('data:')
        ? source.url
        : `data:image/png;base64,${source.b64_json}`;
    return dataUrlToBlob(dataUrl);
  }
  if (!source.url) {
    throw new Error('转存图片失败: 缺少图像数据');
  }
  return urlToBlob(source.url);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export function revokeObjectUrl(url?: string) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
