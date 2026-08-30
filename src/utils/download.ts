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

export async function downloadRotatedImage(
  url: string,
  filename: string,
  rotationDeg: number = 0,
  format: string = 'png'
): Promise<void> {
  const normDeg = ((rotationDeg % 360) + 360) % 360;
  if (normDeg === 0) {
    return downloadImage(url, filename);
  }

  try {
    let imgSource = url;
    let cleanupUrl: string | null = null;

    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      try {
        const resp = await fetch(url);
        const blob = await resp.blob();
        imgSource = URL.createObjectURL(blob);
        cleanupUrl = imgSource;
      } catch {
        // Fallback to direct url with crossOrigin
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imgSource;
    });

    if (cleanupUrl) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(cleanupUrl!);
        } catch {
          // ignore
        }
      }, 60000);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return downloadImage(url, filename);
    }

    const isSwap = normDeg === 90 || normDeg === 270;
    canvas.width = isSwap ? img.naturalHeight : img.naturalWidth;
    canvas.height = isSwap ? img.naturalWidth : img.naturalHeight;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normDeg * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    const cleanFormat = format.toLowerCase().replace(/^\./, '');
    const mime = (cleanFormat === 'jpg' || cleanFormat === 'jpeg')
      ? 'image/jpeg'
      : cleanFormat === 'webp'
        ? 'image/webp'
        : 'image/png';

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mime, 0.95);
    });

    if (!blob) {
      return downloadImage(url, filename);
    }

    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, filename, true);
  } catch (err) {
    console.warn('旋转图像导出失败，降级使用原图下载:', err);
    return downloadImage(url, filename);
  }
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function formatFullTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', { hour12: false });
}

