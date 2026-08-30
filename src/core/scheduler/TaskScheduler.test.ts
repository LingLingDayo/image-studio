import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskScheduler } from './TaskScheduler';
import { GPT_IMAGE_2_PROFILE } from '@/types/model';
import type { TaskGenerationParams } from '@/types/task';
import { assetRepository } from '@/core/storage/AssetRepository';

describe('TaskScheduler (TaskScheduler.ts)', () => {
  beforeEach(async () => {
    await assetRepository.clearAll();
    vi.restoreAllMocks();
  });

  it('should initialize and create task with idle status', () => {
    const scheduler = new TaskScheduler();
    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'cyberpunk city at dusk',
      type: 't2i',
      size: '1024x1024',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    const task = scheduler.createTask(params);
    expect(task.id).toBeDefined();
    expect(task.status).toBe('idle');
    expect(task.progress).toBe(0);
    expect(task.params.prompt).toBe('cyberpunk city at dusk');
  });

  it('should support task execution with progress and timing updates', async () => {
    const scheduler = new TaskScheduler();
    const params: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: 'peaceful zen garden',
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
            data: [{ b64_json: 'iVBORw0KGgo=', revised_prompt: 'detailed zen garden' }]
          })
        };
      }
      return {
        ok: true,
        blob: async () => new Blob(['png'], { type: 'image/png' })
      };
    });

    const task = scheduler.createTask(params);
    let lastProgress = 0;

    const assets = await scheduler.execute(
      task,
      { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
      GPT_IMAGE_2_PROFILE,
      {
        onProgress: (t) => {
          lastProgress = t.progress;
        }
      }
    );

    expect(task.status).toBe('succeeded');
    expect(lastProgress).toBe(100);
    expect(assets).toHaveLength(1);
    expect(assets[0].prompt).toBe('peaceful zen garden');
    expect(assets[0].blob).toBeInstanceOf(Blob);
  });
});
