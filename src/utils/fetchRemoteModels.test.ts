import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRemoteModels } from './fetchRemoteModels';

describe('fetchRemoteModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('默认模型查询仅使用 Bearer，保持前三参数与 signal 兼容', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'model-a' }] })));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    expect(await fetchRemoteModels('https://api.example.com', ' test-key ', controller.signal)).toEqual(['model-a']);
    expect(fetchMock.mock.calls[0][1]).toEqual({
      method: 'GET', headers: { Authorization: 'Bearer test-key' }, signal: controller.signal
    });
  });

  it('显式提供协议认证头时不再混入默认 Bearer 或 POST Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'model-a' }] })));
    vi.stubGlobal('fetch', fetchMock);
    const headers = { 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' };
    await fetchRemoteModels('https://api.example.com', 'test-key', undefined, { headers });
    expect(fetchMock.mock.calls[0][1].headers).toEqual(headers);
  });

  it('should keep API order and dedupe without optimizer-style sorting', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            { id: 'gpt-image-2.5-flare' },
            { id: 'gpt-4o' },
            { id: 'gpt-image-2' },
            { id: 'gpt-image-2' },
            { name: 'gpt-image-2.5-sunburst' }
          ]
        })
    });

    const models = await fetchRemoteModels('https://api.example.com', 'sk-test');
    expect(models).toEqual([
      'gpt-image-2.5-flare',
      'gpt-4o',
      'gpt-image-2',
      'gpt-image-2.5-sunburst'
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/models',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should throw when the request fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'Invalid token' } }),
      json: async () => ({ error: { message: 'Invalid token' } })
    });

    await expect(fetchRemoteModels('https://api.example.com', 'sk-bad')).rejects.toThrow('Invalid token');
  });
});
