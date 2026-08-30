import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImagePipeline, ValidationStage } from './ImagePipeline';
import { GPT_IMAGE_2_PROFILE } from '@/types/model';
import type { TaskGenerationParams } from '@/types/task';
import { assetRepository } from '@/core/storage/AssetRepository';

describe('ImagePipeline (ImagePipeline.ts)', () => {
  beforeEach(async () => {
    await assetRepository.clearAll();
    vi.restoreAllMocks();
  });

  it('should reject prompt validation on empty input', async () => {
    const stage = new ValidationStage();
    const mockCtx: any = {
      config: { apiKey: 'sk-test', baseUrl: 'https://example.com/v1' },
      task: { params: { prompt: '   ', type: 't2i' } }
    };

    await expect(stage.process(mockCtx)).rejects.toThrow('请输入提示词');
  });

  it('should reject missing API base URL', async () => {
    const stage = new ValidationStage();
    const mockCtx: any = {
      config: { apiKey: 'sk-test', baseUrl: '  ' },
      task: { params: { prompt: 'a cat', type: 't2i' } }
    };

    await expect(stage.process(mockCtx)).rejects.toThrow('未配置 API Base URL');
  });

  it('should run custom pipeline with custom injected stages', async () => {
    const customPipeline = new ImagePipeline();
    let customStageExecuted = false;

    customPipeline.useStage({
      name: 'CustomPromptEnrichStage',
      process: async (ctx) => {
        customStageExecuted = true;
        ctx.task.params.prompt = `${ctx.task.params.prompt}, ultra-detailed`;
      }
    }, 0);

    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'a cute robot cat',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    globalThis.fetch = vi.fn().mockImplementation(async (_input: any, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            created: 1720000000,
            data: [{ b64_json: 'iVBORw0KGgo=' }]
          })
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(['png'], { type: 'image/png' })
      };
    });

    const task: any = {
      id: 'task_1',
      params,
      durationFormatted: '1.2s',
      resultAssetIds: []
    };

    const assets = await customPipeline.run({
      task,
      config: { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      modelProfile: GPT_IMAGE_2_PROFILE,
      generatedAssets: []
    });

    expect(customStageExecuted).toBe(true);
    expect(assets).toHaveLength(1);
    expect(assets[0].prompt).toBe('a cute robot cat, ultra-detailed');
    expect(assets[0].blob).toBeInstanceOf(Blob);
    expect(assets[0].url.startsWith('blob:')).toBe(true);

    const stored = await assetRepository.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0].blob).toBeInstanceOf(Blob);
  });

  it('should persist a remote image URL by fetching it into a local blob', async () => {
    const pipeline = new ImagePipeline();
    const remoteBlob = new Blob(['png-bytes'], { type: 'image/png' });
    globalThis.fetch = vi.fn().mockImplementation(async (input: any, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            created: 1720000000,
            data: [{ url: 'https://cdn.example.com/generated.png' }]
          })
        };
      }
      expect(String(input)).toBe('https://cdn.example.com/generated.png');
      return {
        ok: true,
        blob: async () => remoteBlob
      };
    });

    const assets = await pipeline.run({
      task: {
        id: 'task_url',
        params: {
          model: 'gpt-image-2',
          prompt: 'url persist',
          type: 't2i',
          size: '1024x1024',
          quality: 'medium',
          format: 'png',
          transparent: false,
          count: 1
        },
        durationFormatted: '0.8s',
        resultAssetIds: []
      } as any,
      config: { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      modelProfile: GPT_IMAGE_2_PROFILE,
      generatedAssets: []
    });

    expect(assets).toHaveLength(1);
    expect(assets[0].blob).toBeInstanceOf(Blob);
    expect(assets[0].url.startsWith('blob:')).toBe(true);
  });
});

