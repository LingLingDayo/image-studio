import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter';
import type { TaskGenerationParams } from '@/types/task';

describe('OpenAICompatibleAdapter (OpenAICompatibleAdapter.ts)', () => {
  const adapter = new OpenAICompatibleAdapter();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct providerId and name', () => {
    expect(adapter.providerId).toBe('openai-compatible');
    expect(adapter.name).toContain('OpenAI');
  });

  it('should throw error when api key is missing', async () => {
    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a futuristic cyberpunk cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await expect(
      adapter.execute({ baseUrl: 'https://example.com/v1', apiKey: '', model: 'gpt-image-2' }, params)
    ).rejects.toThrow('未配置 API Key');
  });

  it('should execute text-to-image request and parse response correctly', async () => {
    const mockResponse = {
      created: 1720000000,
      data: [{ url: 'https://example.com/img1.png', revised_prompt: 'detailed prompt' }]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute anime cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    const result = await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    expect(result.created).toBe(1720000000);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe('https://example.com/img1.png');
    expect(result.items[0].revised_prompt).toBe('detailed prompt');

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBe('1024x1024');
    expect(body.prompt).toBe('a cute anime cat');
    expect(body.response_format).toBe('b64_json');
    expect(body.n).toBe(1);
  });

  it('should always request a single image even when task count is greater than 1', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'four cats',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 4
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.n).toBe(1);
  });

  it('should append ratio constraint to prompt when size is auto', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute anime cat',
      type: 't2i',
      size: 'auto',
      resolution: 'auto',
      aspectRatio: '16:9',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBeUndefined();
    expect(body.prompt).toBe('a cute anime cat\n\n[输出要求: 16:9比例]');
  });

  it('should append resolution and ratio constraints when size stays auto', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute anime cat',
      type: 't2i',
      size: 'auto',
      resolution: '1k',
      aspectRatio: '16:9',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.size).toBeUndefined();
    expect(body.prompt).toBe('a cute anime cat\n\n[输出要求: 1K分辨率，16:9比例]');
  });

  it('should send official background=transparent and keep png output', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a sticker of a cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'high',
      format: 'png',
      transparent: true,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.background).toBe('transparent');
    expect(body.output_format).toBe('png');
    expect(body.transparent_background).toBeUndefined();
  });

  it('should coerce jpeg to png when transparent is enabled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a sticker of a cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'jpeg',
      transparent: true,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.background).toBe('transparent');
    expect(body.output_format).toBe('png');
  });

  it('should keep webp when transparent is enabled', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.webp' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a sticker of a cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'webp',
      transparent: true,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.background).toBe('transparent');
    expect(body.output_format).toBe('webp');
  });

  it('should omit background when transparent is off', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ url: 'https://example.com/img1.png' }] })
    } as any);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute anime cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'jpeg',
      transparent: false,
      count: 1
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.background).toBeUndefined();
    expect(body.output_format).toBe('jpeg');
  });

  it('should send background=transparent on image edit form data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1720000000, data: [{ b64_json: 'abc' }] })
    } as any);

    const file = new File(['fake'], 'ref.png', { type: 'image/png' });
    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'remove the background',
      type: 'i2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'jpeg',
      transparent: true,
      count: 1,
      referenceImages: [{ id: '1', file, previewUrl: '' }]
    };

    await adapter.execute(
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      params
    );

    const formData = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(formData.get('background')).toBe('transparent');
    expect(formData.get('output_format')).toBe('png');
    expect(formData.get('response_format')).toBe('b64_json');
    expect(formData.get('n')).toBe('1');
    expect(formData.get('transparent_background')).toBeNull();
  });

  it('should parse HTML 502 response and throw friendly error without syntax error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head></html>', {
        status: 502,
        statusText: 'Bad Gateway'
      })
    );

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute anime cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await expect(
      adapter.execute({ baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' }, params)
    ).rejects.toThrow('502 Bad Gateway');
  });

  it('should identify content safety policy violations accurately', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'content_policy_violation: prompt was flagged' } }), {
        status: 400,
        statusText: 'Bad Request'
      })
    );

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'sensitive content prompt',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await expect(
      adapter.execute({ baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' }, params)
    ).rejects.toThrow('[内容安全审核拦截]');
  });
});
