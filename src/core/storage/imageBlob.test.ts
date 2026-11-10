import { describe, it, expect, vi, afterEach } from 'vitest';
import { dataUrlToBlob, detectImageMimeType, imageFormatToMimeType, materializeImageBlob, mimeToImageFormat, urlToBlob } from './imageBlob';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_DATA_URL = `data:image/png;base64,${PNG_B64}`;

describe('imageBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png', format: 'png' },
    { bytes: [0xff, 0xd8, 0xff, 0xe0], mime: 'image/jpeg', format: 'jpeg' },
    { bytes: [0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], mime: 'image/webp', format: 'webp' },
    { bytes: [...new TextEncoder().encode('GIF87a')], mime: 'image/gif', format: 'gif' },
    { bytes: [...new TextEncoder().encode('GIF89a')], mime: 'image/gif', format: 'gif' }
  ])('按真实字节识别 $format，即使Data URL声明错误', async ({ bytes, mime, format }) => {
    const base64 = btoa(String.fromCharCode(...bytes));
    const blob = dataUrlToBlob(`data:image/unknown;base64,${base64}`);
    expect(detectImageMimeType(new Uint8Array(bytes))).toBe(mime);
    expect(mimeToImageFormat(mime)).toBe(format);
    expect(blob.type).toBe(mime);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array(bytes));
    expect((await materializeImageBlob({ b64_json: base64 })).type).toBe(mime);
  });


  it('识别带 XML 声明的 SVG 并保留 Base64 和 URL 编码内容', async () => {
    const svg = '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>山海</text></svg>';
    const bytes = new TextEncoder().encode(svg);
    const base64 = btoa(String.fromCharCode(...bytes));
    expect(detectImageMimeType(bytes)).toBe('image/svg+xml');
    expect(mimeToImageFormat('image/svg+xml')).toBe('svg');
    expect(imageFormatToMimeType('svg')).toBe('image/svg+xml');
    expect(imageFormatToMimeType('gif')).toBe('image/gif');
    expect(imageFormatToMimeType('unknown')).toBe('image/png');
    for (const source of [
      `data:image/png;base64,${base64}`,
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    ]) {
      const blob = dataUrlToBlob(source);
      expect(blob.type).toBe('image/svg+xml');
      expect(await blob.text()).toBe(svg);
    }
    expect(await (await materializeImageBlob({ b64_json: base64 })).text()).toBe(svg);
  });

  it('类型识别不执行 SVG 中的脚本，也不将 HTML 或普通文本识别为 SVG', () => {
    const append = vi.spyOn(document.body, 'appendChild');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>globalThis.svgExecuted = true</script></svg>';
    expect(detectImageMimeType(new TextEncoder().encode(svg))).toBe('image/svg+xml');
    expect(append).not.toHaveBeenCalled();
    expect('svgExecuted' in globalThis).toBe(false);
    for (const invalid of ['hello <svg xmlns="http://www.w3.org/2000/svg"/>', '<html><svg xmlns="http://www.w3.org/2000/svg"/></html>', '<svg xmlns="urn:not-svg"/>']) {
      expect(detectImageMimeType(new TextEncoder().encode(invalid))).toBeUndefined();
    }
  });

  it('远程 SVG 即使声明为 PNG 也按完整 XML 内容识别', async () => {
    const svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>';
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([svg], { type: 'image/png' }) });
    const blob = await urlToBlob('https://cdn.example.com/actual.svg');
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toBe(svg);
  });

  it('裸 Base64 配合已声明的 Data URL 时不会退回错误 PNG MIME', async () => {
    const source = 'not-signature-test-fixture';
    const base64 = btoa(source);
    const blob = await materializeImageBlob({ b64_json: base64, url: `data:image/svg+xml;base64,${base64}` });
    expect(blob.type).toBe('image/svg+xml');
    expect(await blob.text()).toBe(source);
  });

  it('拒绝格式无效的 Data URL', () => {
    expect(() => dataUrlToBlob('not-data-url')).toThrow('无效的 Data URL');
    expect(() => dataUrlToBlob('data:image/svg+xml,%XX')).toThrow('无效的 Data URL');
    expect(() => dataUrlToBlob('data:image/png;base64,!bad')).toThrow('无效的 Data URL');
  });

  it('不能识别的字节不凭请求格式猜测，保留原声明', () => {
    expect(detectImageMimeType(new Uint8Array([1, 2, 3]))).toBeUndefined();
    expect(mimeToImageFormat('application/octet-stream')).toBeUndefined();
    expect(dataUrlToBlob('data:image/webp;base64,AQID').type).toBe('image/webp');
  });

  it('远程响应声明JPEG但实际PNG时规范化MIME而不转换像素', async () => {
    const source = dataUrlToBlob(PNG_DATA_URL);
    const incorrectlyTyped = new Blob([source], { type: 'image/jpeg' });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => incorrectlyTyped });
    const result = await urlToBlob('https://cdn.example.com/actual.png');
    expect(result.type).toBe('image/png');
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array(await source.arrayBuffer()));
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
