import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyImageToClipboard } from './clipboard';

class MockClipboardItem {
  readonly items: Record<string, Blob | Promise<Blob>>;
  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.items = items;
  }
}

describe('clipboard utils (src/utils/clipboard.ts)', () => {
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = globalThis.ClipboardItem;

  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: MockClipboardItem
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    });
    if (originalClipboardItem !== undefined) {
      Object.defineProperty(globalThis, 'ClipboardItem', {
        configurable: true,
        writable: true,
        value: originalClipboardItem
      });
    } else {
      Reflect.deleteProperty(globalThis, 'ClipboardItem');
    }
  });

  it('无图片数据时抛出明确错误', async () => {
    await expect(copyImageToClipboard({ url: '' })).rejects.toThrow('当前图片数据不可用');
  });

  it('不支持 Clipboard API 时抛出友好错误', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined
    });
    await expect(
      copyImageToClipboard({ url: 'blob:test', blob: new Blob(['png'], { type: 'image/png' }) })
    ).rejects.toThrow('不支持复制图片');
  });

  it('未旋转的 PNG 图片直接写入 image/png 到剪贴板', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write }
    });

    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    await copyImageToClipboard({ url: 'blob:png', blob }, 0);

    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0][0] as MockClipboardItem[];
    expect(items[0].items['image/png']).toBe(blob);
  });

  it('非 PNG 或存在旋转角度时经 Canvas 转码为 PNG 后写入剪贴板并释放临时 URL', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write }
    });

    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temp-src');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const translate = vi.fn();
    const rotate = vi.fn();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      translate,
      rotate,
      drawImage
    } as unknown as CanvasRenderingContext2D);
    const encodedPng = new Blob(['encoded-png'], { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(encodedPng));

    const jpegBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
    await copyImageToClipboard({ url: 'blob:jpeg', blob: jpegBlob }, 90);

    expect(createObjectURL).toHaveBeenCalledWith(jpegBlob);
    expect(rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(drawImage).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:temp-src');
    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0][0] as MockClipboardItem[];
    expect(items[0].items['image/png']).toBe(encodedPng);
  });

  it('仅传入 Data URL 时自动解析并写入剪贴板', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write }
    });

    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await copyImageToClipboard({ url: dataUrl }, 0);

    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0][0] as MockClipboardItem[];
    const writtenBlob = items[0].items['image/png'] as Blob;
    expect(writtenBlob.type).toBe('image/png');
    expect(writtenBlob.size).toBeGreaterThan(0);
  });

  it('仅传入远程或对象 URL 且无缓存 blob 时通过 fetch 读取后复制', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write }
    });
    const fetchedBlob = new Blob(['remote-png'], { type: 'image/png' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      blob: async () => fetchedBlob
    } as Response);

    await copyImageToClipboard({ url: 'https://example.com/art.png' }, 0);

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/art.png');
    expect(write).toHaveBeenCalledTimes(1);
    const items = write.mock.calls[0][0] as MockClipboardItem[];
    expect(items[0].items['image/png']).toBe(fetchedBlob);
  });
});
