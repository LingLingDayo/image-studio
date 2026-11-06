export interface ImageDimensions {
  width: number;
  height: number;
  ratioStr: string;
}

function resolveImageDimensions(width: number, height: number): ImageDimensions {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  let ratioStr = `${width / divisor}:${height / divisor}`;

  if (divisor < 100) {
    const ratio = width / height;
    if (Math.abs(ratio - 1) < 0.05) ratioStr = '1:1';
    else if (Math.abs(ratio - 0.75) < 0.08) ratioStr = '3:4';
    else if (Math.abs(ratio - 1.33) < 0.08) ratioStr = '4:3';
    else if (Math.abs(ratio - 0.5625) < 0.08) ratioStr = '9:16';
    else if (Math.abs(ratio - 1.777) < 0.08) ratioStr = '16:9';
    else if (Math.abs(ratio - 0.5) < 0.08) ratioStr = '1:2';
    else ratioStr = `${Math.round(ratio * 10) / 10}:1`;
  }
  return { width, height, ratioStr };
}

export async function loadImageDimensions(
  url: string,
  timeoutMs: number = 3000
): Promise<ImageDimensions> {
  if (typeof Image === 'undefined') {
    throw new Error('当前环境无法读取图片');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (result: ImageDimensions | Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const timer = setTimeout(() => {
      finish(new Error('图片读取超时，请重新选择图片'));
    }, timeoutMs);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        finish(new Error('图片无法解码：尺寸无效'));
        return;
      }
      finish(resolveImageDimensions(width, height));
    };
    img.onerror = () => finish(new Error('图片无法解码，请使用有效的图片文件'));

    try {
      img.src = url;
    } catch {
      finish(new Error('无法读取图片，请检查图片地址'));
    }
  });
}

/**
 * 尺寸估算允许降级，图片有效性校验应使用严格的 loadImageDimensions。
 */
export async function calculateImageDimensions(
  url: string,
  timeoutMs: number = 3000
): Promise<ImageDimensions> {
  try {
    return await loadImageDimensions(url, timeoutMs);
  } catch {
    return { width: 1024, height: 1024, ratioStr: '1:1' };
  }
}
