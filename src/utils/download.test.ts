import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadImage, downloadRotatedImage, supportsCanvasImageFormat, dataUrlToFile, formatTime, formatFullTime, generateAssetFilename } from './download';

describe('download utils', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads data URL directly by creating link without target="_blank"', async () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    
    let clickedHref = '';
    let clickedDownload = '';
    let clickedTarget = '';

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        el.click = () => {
          clickedHref = (el as HTMLAnchorElement).href;
          clickedDownload = (el as HTMLAnchorElement).download;
          clickedTarget = (el as HTMLAnchorElement).target;
        };
      }
      return el;
    });

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await downloadImage(dataUrl, 'test_image.png');

    expect(clickedDownload).toBe('test_image.png');
    expect(clickedHref).toBe(dataUrl);
    expect(clickedTarget).toBe(''); // Must not be _blank
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('downloads blob URL directly without refetching and without target="_blank"', async () => {
    let clickedDownload = '';
    let clickedHref = '';
    let clickedTarget = '';

    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        el.click = () => {
          clickedHref = (el as HTMLAnchorElement).href;
          clickedDownload = (el as HTMLAnchorElement).download;
          clickedTarget = (el as HTMLAnchorElement).target;
        };
      }
      return el;
    });

    const blobUrl = 'blob:http://localhost:3001/87472e1c-b56e-4b8d-a432-3ecfd3ade50d';
    await downloadImage(blobUrl, 'image_123.png');

    expect(clickedDownload).toBe('image_123.png');
    expect(clickedHref).toBe(blobUrl);
    expect(clickedTarget).toBe('');
  });

  it('generates filename for text-to-image (t2i) correctly', () => {
    const fixedTime = new Date('2026-08-31T02:57:33.456').getTime();
    const filename = generateAssetFilename({
      type: 't2i',
      timestamp: fixedTime,
      format: 'png'
    });

    // 格式: t2i_xxxx.xx.xx_xx.xx.xx_时间戳后四位.png
    const lastFour = String(fixedTime).slice(-4);
    expect(filename).toBe(`t2i_2026.08.31_02.57.33_${lastFour}.png`);
  });

  it('generates filename for image-to-image (i2i) correctly', () => {
    const fixedTime = new Date('2026-08-31T02:57:33.789').getTime();
    const filename = generateAssetFilename({
      type: 'i2i',
      referenceImages: ['data:image/png;base64,...'],
      timestamp: fixedTime,
      format: 'jpeg'
    });

    const lastFour = String(fixedTime).slice(-4);
    expect(filename).toBe(`i2i_2026.08.31_02.57.33_${lastFour}.jpeg`);
  });

  it('generates filename with rotation suffix when rotated', () => {
    const fixedTime = new Date('2026-08-31T02:57:33.123').getTime();
    const filename = generateAssetFilename({
      type: 't2i',
      timestamp: fixedTime,
      format: 'webp'
    }, undefined, 90);

    const lastFour = String(fixedTime).slice(-4);
    expect(filename).toBe(`t2i_2026.08.31_02.57.33_${lastFour}_r90.webp`);
  });

  it('converts dataUrl to File correctly', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const file = dataUrlToFile(dataUrl, 'sample.png');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('sample.png');
    expect(file.type).toBe('image/png');
  });


  it.each(['gif', 'svg'])('下载 %s 原件时不丢失扩展名且不添加旋转后缀', async (format) => {
    const timestamp = new Date('2026-08-31T02:57:33.123').getTime();
    const filename = generateAssetFilename({ format, timestamp }, undefined, 90);
    expect(filename).toMatch(new RegExp(`\\.${format}$`));
    expect(filename).not.toContain('_r90');
    expect(generateAssetFilename({ format, timestamp }, undefined, 90, { pattern: `custom_{id}.${format}` })).toBe(`custom_${String(timestamp).slice(-4)}.${format}`);
    expect(supportsCanvasImageFormat(format)).toBe(false);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createElement = vi.spyOn(document, 'createElement');
    await downloadRotatedImage('blob:original', filename, 90, format, format);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0]).toMatchObject({ download: filename });
    expect(createElement.mock.calls).toEqual([['a']]);
  });

  it.each(['gif', 'svg'])('拒绝把栅格图伪装成 %s 文件', async (format) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(downloadRotatedImage('blob:png', `image.${format}`, 0, format, 'png')).rejects.toThrow('不支持转换');
    await expect(downloadRotatedImage('blob:unknown', `image.${format}`, 0, format)).rejects.toThrow('不支持转换');
    expect(click).not.toHaveBeenCalled();
  });


  it.each(['gif', 'svg'])('%s 转 PNG 时 Canvas 不可用也不会下载伪装原件', async (format) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(downloadRotatedImage('blob:original', 'converted.png', 0, 'png', format)).rejects.toThrow('图像导出失败');
    expect(click).not.toHaveBeenCalled();
  });

  it.each([null, new Blob(['png'], { type: 'image/png' })])('Canvas 编码失败或返回错误 MIME 时拒绝伪装下载', async (blob) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(blob));
    await expect(downloadRotatedImage('blob:original', 'converted.webp', 90, 'webp', 'gif')).rejects.toThrow('图像导出失败');
    expect(click).not.toHaveBeenCalled();
  });

  it('远程图片解码失败时释放临时 URL，且不下载原件', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, blob: async () => new Blob(['gif'], { type: 'image/gif' }) } as Response);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temporary-source');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(Image.prototype, 'src', 'set').mockImplementation(function(this: HTMLImageElement) {
      this.onerror?.(new Event('error'));
    });
    await expect(downloadRotatedImage('https://example.com/source.gif', 'converted.png', 0, 'png', 'gif')).rejects.toThrow('图像导出失败');
    expect(revoke).toHaveBeenCalledWith('blob:temporary-source');
    expect(click).not.toHaveBeenCalled();
  });

  it('远程图片转换成功后释放输入 URL，并使用实际目标 MIME 下载', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, blob: async () => new Blob(['gif'], { type: 'image/gif' }) } as Response);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:temporary-source').mockReturnValueOnce('blob:encoded-output');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);
    const encoded = new Blob(['png'], { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(encoded));
    await downloadRotatedImage('https://example.com/source.gif', 'converted.png', 90, 'png', 'gif');
    expect(createUrl.mock.calls[1]).toEqual([encoded]);
    expect(click.mock.instances[0]).toMatchObject({ href: 'blob:encoded-output', download: 'converted.png' });
    expect(revoke).toHaveBeenCalledWith('blob:temporary-source');
    expect(revoke).not.toHaveBeenCalledWith('blob:encoded-output');
  });

  it('URL 编码 SVG 可以完整复用为参考文件', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>山海</text></svg>';
    const file = dataUrlToFile(`data:image/svg+xml,${encodeURIComponent(svg)}`, 'reference.svg');
    expect(file.name).toBe('reference.svg');
    expect(file.type).toBe('image/svg+xml');
    expect(await file.text()).toBe(svg);
  });

  it('formats timestamp correctly', () => {
    const ts = new Date('2026-08-31T10:20:00').getTime();
    expect(formatTime(ts)).toBe('08-31 10:20');
    expect(formatFullTime(ts)).toBe('2026.08.31 10:20:00');
  });

  it('supports custom filename pattern and custom target format', () => {
    const fixedTime = new Date('2026-08-31T02:57:33.456').getTime();
    const lastFour = String(fixedTime).slice(-4);

    // 自定义 pattern: {type}_{date}_{id}
    const fn1 = generateAssetFilename(
      { type: 't2i', timestamp: fixedTime, format: 'png' },
      undefined,
      0,
      { pattern: '{type}_{date}_{id}' }
    );
    expect(fn1).toBe(`t2i_2026.08.31_${lastFour}.png`);

    // 自定义目标格式: webp
    const fn2 = generateAssetFilename(
      { type: 't2i', timestamp: fixedTime, format: 'png' },
      undefined,
      0,
      { targetFormat: 'webp' }
    );
    expect(fn2).toBe(`t2i_2026.08.31_02.57.33_${lastFour}.webp`);

    // 组合自定义 pattern 与自定义格式
    const fn3 = generateAssetFilename(
      { type: 'i2i', timestamp: fixedTime, format: 'png', prompt: 'cute cyber cat' },
      undefined,
      0,
      { pattern: 'myart_{prefix}_{prompt}_{time}', targetFormat: 'jpeg' }
    );
    expect(fn3).toBe('myart_i2i_cute cyber cat_02.57.33.jpeg');
  });
});

