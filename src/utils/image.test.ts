import { describe, it, expect, afterEach, vi } from 'vitest';
import { calculateImageDimensions, loadImageDimensions } from './image';

describe('calculateImageDimensions (image.ts)', () => {
  const originalImage = global.Image;

  afterEach(() => {
    global.Image = originalImage;
  });

  it('should resolve standard 1:1 ratio for square image', async () => {
    class MockImage {
      naturalWidth = 800;
      naturalHeight = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 10);
      }
    }
    // @ts-expect-error Mock Image
    global.Image = MockImage;

    const result = await calculateImageDimensions('data:image/png;base64,xxx');
    expect(result).toEqual({
      width: 800,
      height: 800,
      ratioStr: '1:1'
    });
  });

  it('should resolve custom ratio cleanly without approx symbol', async () => {
    class MockImage {
      naturalWidth = 1000;
      naturalHeight = 430; // r = 2.3255... -> 2.3:1
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onload?.(), 10);
      }
    }
    // @ts-expect-error Mock Image
    global.Image = MockImage;

    const result = await calculateImageDimensions('data:image/png;base64,xxx');
    expect(result.ratioStr).not.toContain('≈');
    expect(result.ratioStr).toBe('2.3:1');
  });

  it('should fallback to 1024x1024 1:1 on error', async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_val: string) {
        setTimeout(() => this.onerror?.(), 10);
      }
    }
    // @ts-expect-error Mock Image
    global.Image = MockImage;

    const result = await calculateImageDimensions('invalid-url');
    expect(result).toEqual({
      width: 1024,
      height: 1024,
      ratioStr: '1:1'
    });
  });
});

describe('loadImageDimensions 严格加载与降级兼容', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('仅创建一次 Image，返回真实尺寸和比例并解绑事件', async () => {
    let created = 0;
    let image!: MockImage;
    class MockImage {
      naturalWidth = 1920;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        created++;
        image = this;
      }
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    await expect(loadImageDimensions('blob:valid-image')).resolves.toEqual({
      width: 1920,
      height: 1080,
      ratioStr: '16:9'
    });
    expect(created).toBe(1);
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  });

  it('解码失败时拒绝并解绑事件、清理超时计时器', async () => {
    vi.useFakeTimers();
    let image!: MockImage;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        image = this;
      }
      set src(_url: string) {
        Promise.resolve().then(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    await expect(loadImageDimensions('blob:broken-image')).rejects.toThrow('无法解码');
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('加载超时会拒绝并清理事件与计时器', async () => {
    vi.useFakeTimers();
    let image!: MockImage;
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        image = this;
      }
      set src(_url: string) {}
    }
    vi.stubGlobal('Image', MockImage);
    const pending = loadImageDimensions('blob:pending-image', 100);
    const assertion = expect(pending).rejects.toThrow('超时');

    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, Number.NaN])('加载成功事件返回无效宽度 %s 时严格拒绝，原接口保持降级', async (width) => {
    class MockImage {
      naturalWidth = width;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', MockImage);

    await expect(loadImageDimensions('blob:invalid-dimensions')).rejects.toThrow('尺寸无效');
    await expect(calculateImageDimensions('blob:invalid-dimensions')).resolves.toEqual({
      width: 1024,
      height: 1024,
      ratioStr: '1:1'
    });
  });

  it('缺少浏览器 Image 能力时严格拒绝，原接口保持默认尺寸降级', async () => {
    vi.stubGlobal('Image', undefined);

    await expect(loadImageDimensions('blob:unavailable')).rejects.toThrow('无法读取图片');
    await expect(calculateImageDimensions('blob:unavailable')).resolves.toEqual({
      width: 1024,
      height: 1024,
      ratioStr: '1:1'
    });
  });

  it('原接口在加载超时时仍返回默认尺寸', async () => {
    vi.useFakeTimers();
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {}
    }
    vi.stubGlobal('Image', MockImage);
    const pending = calculateImageDimensions('blob:pending-image', 100);

    await vi.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toEqual({ width: 1024, height: 1024, ratioStr: '1:1' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
