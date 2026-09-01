import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateImageDimensions } from './image';

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
