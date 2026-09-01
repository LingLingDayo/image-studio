export interface ImageDimensions {
  width: number;
  height: number;
  ratioStr: string;
}

/**
 * 异步获取远程/本地图像尺寸与最简宽高比 (附带安全超时降级)
 */
export async function calculateImageDimensions(
  url: string,
  timeoutMs: number = 3000
): Promise<ImageDimensions> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 1024, height: 1024, ratioStr: '1:1' });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ width: 1024, height: 1024, ratioStr: '1:1' });
      }
    }, timeoutMs);

    const img = new Image();
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const w = img.naturalWidth || 1024;
      const h = img.naturalHeight || 1024;
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(w, h);
      let ratioStr = `${w / divisor}:${h / divisor}`;

      if (divisor < 100) {
        const r = w / h;
        if (Math.abs(r - 1) < 0.05) ratioStr = '1:1';
        else if (Math.abs(r - 0.75) < 0.08) ratioStr = '3:4';
        else if (Math.abs(r - 1.33) < 0.08) ratioStr = '4:3';
        else if (Math.abs(r - 0.5625) < 0.08) ratioStr = '9:16';
        else if (Math.abs(r - 1.777) < 0.08) ratioStr = '16:9';
        else if (Math.abs(r - 0.5) < 0.08) ratioStr = '1:2';
        else ratioStr = `${Math.round(r * 10) / 10}:1`;
      }
      resolve({ width: w, height: h, ratioStr });
    };

    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ width: 1024, height: 1024, ratioStr: '1:1' });
    };

    img.src = url;
  });
}
