import { describe, it, expect, vi, afterEach } from 'vitest';
import { dataUrlToBlob, materializeImageBlob, urlToBlob } from './imageBlob';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG_B64}`;

describe('imageBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should convert data URL and raw base64 into a local blob', async () => {
    const fromDataUrl = dataUrlToBlob(PNG_DATA_URL);
    expect(fromDataUrl).toBeInstanceOf(Blob);
    expect(fromDataUrl.type).toBe('image/png');
    expect(fromDataUrl.size).toBeGreaterThan(0);

    const fromRaw = await materializeImageBlob({ b64_json: PNG_B64 });
    expect(fromRaw.size).toBe(fromDataUrl.size);
  });

  it('should fetch remote url into a blob', async () => {
    const remoteBlob = new Blob(['png-bytes'], { type: 'image/png' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => remoteBlob
    });

    const blob = await urlToBlob('https://cdn.example.com/a.png');
    expect(blob).toBe(remoteBlob);
  });

  it('should reject empty remote files', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([])
    });

    await expect(urlToBlob('https://cdn.example.com/empty.png')).rejects.toThrow('空文件');
  });

  it('should map cross-origin fetch failures to a persist error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(urlToBlob('https://cdn.example.com/blocked.png')).rejects.toThrow('无法跨域读取');
  });
});
