import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadImage, dataUrlToFile, formatTime, formatFullTime } from './download';

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
    expect(formatFullTime(ts)).toContain('2026');
  });
});
