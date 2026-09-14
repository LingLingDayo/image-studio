import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRemoteModels } from './fetchRemoteModels';

describe('fetchRemoteModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
