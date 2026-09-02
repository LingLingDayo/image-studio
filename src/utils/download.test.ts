import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadImage, dataUrlToFile, formatTime, formatFullTime, generateAssetFilename } from './download';

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

  it('formats timestamp correctly', () => {
    const ts = new Date('2026-08-31T10:20:00').getTime();
    expect(formatTime(ts)).toBe('08-31 10:20');
    expect(formatFullTime(ts)).toBe('2026.08.31 10:20:00');
  });
});

