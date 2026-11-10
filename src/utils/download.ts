import { dataUrlToBlob } from '@/core/storage/imageBlob';

/**
 * 安全触发浏览器原生文件下载
 */
function triggerBrowserDownload(url: string, filename: string, isTemporaryBlob: boolean = false): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  // 严禁设置 a.target = '_blank'，否则 Chromium 会将其作为页面导航并忽略 a.download 文件名与后缀
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (isTemporaryBlob) {
    // 延迟 60 秒注销，确保浏览器后台下载进程已完成异步流读取
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 60000);
  }
}

export async function downloadImage(url: string, filename: string): Promise<void> {
  if (!url) return;

  // 1. 如果本身就是 data: URL 或 blob: URL，直接触发下载
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    triggerBrowserDownload(url, filename, false);
    return;
  }

  // 2. 远程 http/https 链接，通过 fetch 转 blob 避免跨域导致浏览器直接打开网页
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP fetch status ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, filename, true);
  } catch (err) {
    console.warn('远程图片流式下载失败，降级为直连下载:', err);
    triggerBrowserDownload(url, filename, false);
  }
}

export function supportsCanvasImageFormat(format: string): boolean {
  return ['png', 'jpg', 'jpeg', 'webp'].includes(format.toLowerCase().replace(/^\./, ''));
}

export async function downloadRotatedImage(
  url: string,
  filename: string,
  rotationDeg: number = 0,
  format: string = 'png',
  originalFormat?: string
): Promise<void> {
  const normDeg = ((rotationDeg % 360) + 360) % 360;
  const cleanTargetFormat = format.toLowerCase().replace(/^\./, '');
  const cleanOriginalFormat = (originalFormat || '').toLowerCase().replace(/^\./, '');
  const needsConversion = cleanOriginalFormat ? cleanTargetFormat !== cleanOriginalFormat : false;

  // Canvas 无法编码 GIF/SVG；原格式下载保留动画与矢量，不能将 PNG 字节伪装为这些格式。
  if (!supportsCanvasImageFormat(cleanTargetFormat)) {
    if (!['gif', 'svg'].includes(cleanTargetFormat) ||
      cleanTargetFormat !== cleanOriginalFormat) {
      throw new Error('浏览器不支持转换为该格式，请选择 PNG、JPEG 或 WebP');
    }
    return downloadImage(url, filename.replace(/_r\d+(?=\.(?:gif|svg)$)/i, ''));
  }

  if (normDeg === 0 && !needsConversion) {
    return downloadImage(url, filename);
  }

  let cleanupUrl: string | null = null;
  try {
    let imgSource = url;

    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`读取原图失败: HTTP ${resp.status}`);
      const blob = await resp.blob();
      if (blob.size === 0) throw new Error('原图内容为空');
      imgSource = URL.createObjectURL(blob);
      cleanupUrl = imgSource;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('原图无法解码，请尝试下载原格式'));
      img.src = imgSource;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法处理图片，请尝试下载原格式');

    const isSwap = normDeg === 90 || normDeg === 270;
    canvas.width = isSwap ? img.naturalHeight : img.naturalWidth;
    canvas.height = isSwap ? img.naturalWidth : img.naturalHeight;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normDeg * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const cleanFormat = cleanTargetFormat;
    const mime = (cleanFormat === 'jpg' || cleanFormat === 'jpeg')
      ? 'image/jpeg'
      : cleanFormat === 'webp'
        ? 'image/webp'
        : 'image/png';

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mime, 0.95);
    });

    if (!blob || blob.size === 0) throw new Error('图片编码失败，请尝试下载原格式');
    if (blob.type !== mime) throw new Error(`当前浏览器不支持 ${cleanTargetFormat.toUpperCase()} 编码，请选择其他下载格式`);

    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, filename, true);
  } catch (err) {
    const detail = err instanceof Error ? err.message : '图片转换或旋转失败';
    throw new Error(`图像导出失败: ${detail}`, { cause: err });
  } finally {
    if (cleanupUrl) {
      try {
        URL.revokeObjectURL(cleanupUrl);
      } catch {
        // URL 回收失败不能覆盖原始导出错误。
      }
    }
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
}

export interface AssetFilenameOptions {
  pattern?: string;
  targetFormat?: string;
}

/**
 * 格式化生成图像下载文件名
 * 规范: 对应的前缀标识_xxxx.xx.xx_xx.xx.xx_时间戳后四位.扩展名
 * 示例:
 *   - 文生图: t2i_2026.08.31_02.57.33_1234.png
 *   - 图生图: i2i_2026.08.31_02.57.33_1234.png
 */
export function generateAssetFilename(
  asset: {
    type?: 't2i' | 'i2i' | string;
    referenceImages?: string[];
    timestamp?: number;
    format?: string;
    prompt?: string;
  },
  batchIndex?: number,
  rotationDeg: number = 0,
  options?: AssetFilenameOptions
): string {
  // 1. 判断前缀标识 (文生图: t2i, 图生图: i2i)
  const isI2I = asset.type === 'i2i' || (Boolean(asset.referenceImages && asset.referenceImages.length > 0));
  const prefix = isI2I ? 'i2i' : 't2i';

  // 2. 时间戳与日期解析
  let ts = asset.timestamp && !isNaN(asset.timestamp) && asset.timestamp > 0 ? asset.timestamp : Date.now();
  if (typeof batchIndex === 'number' && batchIndex > 0) {
    ts += batchIndex;
  }
  const date = new Date(ts);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // 时间戳后四位
  const tsStr = String(ts);
  const lastFour = tsStr.length >= 4 ? tsStr.slice(-4) : tsStr.padStart(4, '0');

  // 旋转后缀（若存在旋转）
  const normRot = ((rotationDeg % 360) + 360) % 360;
  const rotSuffix = normRot !== 0 ? `_r${normRot}` : '';

  // 目标扩展名
  const rawTargetFormat = options?.targetFormat && options.targetFormat !== 'auto'
    ? options.targetFormat
    : (asset.format || 'png');
  const ext = rawTargetFormat.toLowerCase().replace(/^\./, '');
  const cleanExt = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) ? ext : 'png';
  const effectiveRotSuffix = supportsCanvasImageFormat(cleanExt) ? rotSuffix : '';

  const pattern = (options?.pattern || '').trim();

  // 若无自定义模式，采用默认规范
  if (!pattern || pattern === '{prefix}_{date}_{time}_{id}') {
    return `${prefix}_${year}.${month}.${day}_${hours}.${minutes}.${seconds}_${lastFour}${effectiveRotSuffix}.${cleanExt}`;
  }

  // 提示词安全化
  const sanitizedPrompt = (asset.prompt || '')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim()
    .slice(0, 30);

  let filename = pattern
    .replace(/\{prefix\}/gi, prefix)
    .replace(/\{type\}/gi, prefix)
    .replace(/\{date\}/gi, `${year}.${month}.${day}`)
    .replace(/\{time\}/gi, `${hours}.${minutes}.${seconds}`)
    .replace(/\{YYYY\}/gi, String(year))
    .replace(/\{MM\}/gi, month)
    .replace(/\{DD\}/gi, day)
    .replace(/\{HH\}/gi, hours)
    .replace(/\{mm\}/gi, minutes)
    .replace(/\{ss\}/gi, seconds)
    .replace(/\{id\}/gi, lastFour)
    .replace(/\{timestamp\}/gi, String(ts))
    .replace(/\{prompt\}/gi, sanitizedPrompt || 'image')
    .replace(/\{index\}/gi, typeof batchIndex === 'number' ? String(batchIndex + 1) : '1');

  filename = filename.replace(/\.(png|jpg|jpeg|webp|gif|svg)$/i, '');

  return `${filename}${effectiveRotSuffix}.${cleanExt}`;
}


