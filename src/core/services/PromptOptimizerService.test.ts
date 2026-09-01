import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptOptimizerService, normalizeEndpointUrl } from './PromptOptimizerService';

describe('PromptOptimizerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeEndpointUrl', () => {
    it('should correctly join base and path without duplicating /v1', () => {
      expect(normalizeEndpointUrl('https://api.example.com', '/models')).toBe('https://api.example.com/v1/models');
      expect(normalizeEndpointUrl('https://api.example.com/v1', '/models')).toBe('https://api.example.com/v1/models');
      expect(normalizeEndpointUrl('https://api.example.com/v1/', '/v1/chat/completions')).toBe(
        'https://api.example.com/v1/chat/completions'
      );
      expect(normalizeEndpointUrl('https://api.example.com', '/v1/chat/completions')).toBe(
        'https://api.example.com/v1/chat/completions'
      );
    });
  });

  describe('fetchModels', () => {
    it('should fetch and sort models correctly with gpt-5.6-terra prioritized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'b-model' },
            { id: 'gpt-4o' },
            { id: 'gpt-5.6-terra' },
            { id: 'a-model' },
            { id: 'claude-3-5-sonnet' }
          ]
        })
      });

      const models = await PromptOptimizerService.fetchModels('https://api.example.com', 'sk-test');
      expect(models).toContain('gpt-5.6-terra');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('claude-3-5-sonnet');
      // Priority models come first
      expect(models[0]).toBe('gpt-5.6-terra');
      expect(models[1]).toBe('gpt-4o');
      expect(models[2]).toBe('claude-3-5-sonnet');
    });

    it('should throw error when request fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid token' } })
      });

      await expect(
        PromptOptimizerService.fetchModels('https://api.example.com', 'sk-bad')
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('optimizePrompt', () => {
    it('should substitute template {prompt} and return cleaned response', async () => {
      let sentBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: any, init: any) => {
        sentBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '"A cinematic photo of a beautiful bird, highly detailed, soft sunlight"'
                }
              }
            ]
          })
        };
      });

      const result = await PromptOptimizerService.optimizePrompt(
        {
          baseUrl: 'https://api.example.com',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          endpoint: '/v1/chat/completions'
        },
        'a cute bird',
        'Optimize this: {prompt}'
      );

      expect(sentBody.messages[0].content).toBe('Optimize this: a cute bird');
      expect(result).toBe('A cinematic photo of a beautiful bird, highly detailed, soft sunlight');
    });

    it('should correctly format request and parse response for Claude Messages API', async () => {
      let sentBody: any = null;
      let sentHeaders: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: any, init: any) => {
        sentBody = JSON.parse(init.body);
        sentHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'A majestic lion basking in golden hour light, 8k resolution'
              }
            ]
          })
        };
      });

      const result = await PromptOptimizerService.optimizePrompt(
        {
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-ant-test',
          model: 'claude-3-5-sonnet-20241022',
          endpoint: '/v1/messages'
        },
        'a golden lion',
        'Enhance: {prompt}'
      );

      expect(sentBody.max_tokens).toBe(2048);
      expect(sentBody.messages[0].content).toBe('Enhance: a golden lion');
      expect(sentHeaders['x-api-key']).toBe('sk-ant-test');
      expect(sentHeaders['anthropic-version']).toBe('2023-06-01');
      expect(result).toBe('A majestic lion basking in golden hour light, 8k resolution');
    });

    it('should throw error if prompt is empty', async () => {
      await expect(
        PromptOptimizerService.optimizePrompt(
          {
            baseUrl: 'https://api.example.com',
            apiKey: 'sk-test',
            model: 'gpt-4o-mini',
            endpoint: '/v1/chat/completions'
          },
          '   '
        )
      ).rejects.toThrow('请输入提示词后再进行优化');
    });
  });
});
