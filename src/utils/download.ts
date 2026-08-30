export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      URL.revokeObjectURL(cleanupUrl);
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

    const mime = (format.toLowerCase() === 'jpg' || format.toLowerCase() === 'jpeg')
      ? 'image/jpeg'
      : format.toLowerCase() === 'webp'
        ? 'image/webp'
        : 'image/png';

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mime, 0.95);
    });

    if (!blob) {
      return downloadImage(url, filename);
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.warn('Rotated image export error, falling back to original image', err);
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
