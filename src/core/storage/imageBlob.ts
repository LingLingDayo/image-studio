export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) {
    throw new Error('转存图片失败: 无效的 Data URL');
  }
  const header = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
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
  return blob;
}

export async function materializeImageBlob(source: {
  url?: string;
  b64_json?: string;
}): Promise<Blob> {
  if (source.b64_json) {
    const dataUrl = source.b64_json.startsWith('data:')
      ? source.b64_json
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
