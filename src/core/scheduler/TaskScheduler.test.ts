import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskScheduler, TaskProgressTracker, getBaseDurationSeconds } from './TaskScheduler';
import { GPT_IMAGE_2_PROFILE } from '@/types/model';
import type { TaskGenerationParams } from '@/types/task';
import { assetRepository } from '@/core/storage/AssetRepository';

describe('TaskScheduler & TaskProgressTracker', () => {
  beforeEach(async () => {
    await assetRepository.clearAll();
    vi.restoreAllMocks();
  });

  describe('getBaseDurationSeconds', () => {
    it('should return correct base durations for 1k, 2k, 4k and auto/default', () => {
      expect(getBaseDurationSeconds('1k')).toBe(30);
      expect(getBaseDurationSeconds('1K')).toBe(30);
      expect(getBaseDurationSeconds('2k')).toBe(40);
      expect(getBaseDurationSeconds('2K')).toBe(40);
      expect(getBaseDurationSeconds('4k')).toBe(50);
      expect(getBaseDurationSeconds('4K')).toBe(50);
      expect(getBaseDurationSeconds('auto')).toBe(40);
      expect(getBaseDurationSeconds(undefined)).toBe(40);
      expect(getBaseDurationSeconds(null)).toBe(40);
      expect(getBaseDurationSeconds('unknown')).toBe(40);
    });
  });

  describe('TaskProgressTracker', () => {
    it('should smoothly calculate progress within base duration up to 95%', () => {
      // 1k: 30s 基准时间
      const tracker = new TaskProgressTracker('1k', [6, 6, 6, 6]);
      expect(tracker.getBaseSeconds()).toBe(30);

      // 0s
      expect(tracker.calculateProgress(0)).toBe(0);
      // 15s (一半时间) -> floor(15 / 30 * 95) = 47%
      expect(tracker.calculateProgress(15)).toBe(47);
      // 30s (到达基准时间) -> 95%
      expect(tracker.calculateProgress(30)).toBe(95);
    });

    it('should hold at 95% when overdue, increment by 1% per interval up to 99% and then stay at 99%', () => {
      // 1k: 30s 基准时间，自定义超时延迟分别为 5s, 5s, 5s, 5s
      // 阶段阈值点：35s(96%), 40s(97%), 45s(98%), 50s(99%)
      const tracker = new TaskProgressTracker('1k', [5, 5, 5, 5]);

      // 刚超过基准时间 (32s < 35s) -> 卡在 95%
      expect(tracker.calculateProgress(32)).toBe(95);
      // 达到第1个递增点 (35s <= 36s < 40s) -> 96%
      expect(tracker.calculateProgress(36)).toBe(96);
      // 达到第2个递增点 (40s <= 41s < 45s) -> 97%
      expect(tracker.calculateProgress(41)).toBe(97);
      // 达到第3个递增点 (45s <= 46s < 50s) -> 98%
      expect(tracker.calculateProgress(46)).toBe(98);
      // 达到第4个递增点 (50s) -> 99%
      expect(tracker.calculateProgress(50)).toBe(99);
      // 超时更长时间 (100s) -> 依然保持在 99%
      expect(tracker.calculateProgress(100)).toBe(99);
    });

    it('should support auto resolution base duration (40s)', () => {
      const tracker = new TaskProgressTracker('auto', [7, 7, 7, 7]);
      expect(tracker.getBaseSeconds()).toBe(40);
      expect(tracker.calculateProgress(20)).toBe(47);
      expect(tracker.calculateProgress(40)).toBe(95);
    });
  });

  describe('TaskScheduler execution', () => {
    it('should initialize and create task with idle status', () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'cyberpunk city at dusk',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      };

      const task = scheduler.createTask(params);
      expect(task.id).toBeDefined();
      expect(task.status).toBe('idle');
      expect(task.progress).toBe(0);
      expect(task.currentIndex).toBe(1);
      expect(task.params.prompt).toBe('cyberpunk city at dusk');
      expect(task.params.resolution).toBe('1k');
    });

    it('should support task execution with progress and timing updates', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'peaceful zen garden',
        type: 't2i',
        size: '1024x1024',
        resolution: '2k',
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

    it('should cancel running task properly', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'a running task to cancel',
        type: 't2i',
        size: '1024x1024',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      };

      let abortSignal: AbortSignal | undefined;
      globalThis.fetch = vi.fn().mockImplementation(async (_input: any, init?: RequestInit) => {
        abortSignal = init?.signal as AbortSignal;
        return new Promise((_resolve, reject) => {
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        });
      });

      const task = scheduler.createTask(params);
      const execPromise = scheduler.execute(
        task,
        { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
        GPT_IMAGE_2_PROFILE
      );

      // 稍后取消
      setTimeout(() => {
        scheduler.cancel(task.id);
      }, 50);

      await expect(execPromise).rejects.toThrow();
      expect(task.status).toBe('cancelled');
      expect(task.errorMessage).toBe('已取消生成');
    });

    it('should generate images one by one and reset progress between each', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'batch of three cats',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 3
      };

      let postCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (_input: any, init?: RequestInit) => {
        if (init?.method === 'POST') {
          postCount += 1;
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

      const task = scheduler.createTask(params);
      const snapshots: Array<{ index: number; progress: number }> = [];
      const completedIndexes: number[] = [];

      const assets = await scheduler.execute(
        task,
        { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
        GPT_IMAGE_2_PROFILE,
        {
          onProgress: (t) => {
            snapshots.push({ index: t.currentIndex, progress: t.progress });
          },
          onImageComplete: (t) => {
            completedIndexes.push(t.currentIndex);
          }
        }
      );

      expect(postCount).toBe(3);
      expect(assets).toHaveLength(3);
      expect(task.status).toBe('succeeded');
      expect(task.currentIndex).toBe(3);
      expect(task.progress).toBe(100);
      expect(completedIndexes).toEqual([1, 2, 3]);

      const zeroSnapshots = snapshots.filter((s) => s.progress === 0);
      expect(zeroSnapshots.map((s) => s.index)).toEqual(expect.arrayContaining([1, 2, 3]));

      const firstDoneAt = snapshots.findIndex((s) => s.index === 1 && s.progress === 100);
      const secondStartAt = snapshots.findIndex((s) => s.index === 2 && s.progress === 0);
      expect(firstDoneAt).toBeGreaterThanOrEqual(0);
      expect(secondStartAt).toBeGreaterThan(firstDoneAt);
    });

    it('should keep the provider error message on failed tasks', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'blocked prompt',
        type: 't2i',
        size: '1024x1024',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      };

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'content_policy_violation: prompt was flagged' } }),
          { status: 400, statusText: 'Bad Request' }
        )
      );

      const task = scheduler.createTask(params);
      await expect(
        scheduler.execute(
          task,
          { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
          GPT_IMAGE_2_PROFILE
        )
      ).rejects.toThrow('[内容安全审核拦截]');

      expect(task.status).toBe('failed');
      expect(task.errorMessage).toContain('[内容安全审核拦截]');
      expect(task.errorMessage).toContain('content_policy_violation');
    });

    it('多张生成时只要有成功的即视为任务成功，并持久化失败项记录供详情页查看', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'batch with one success and one failure',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 2
      };

      let reqCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (_input: any, init?: RequestInit) => {
        if (init?.method === 'POST') {
          reqCount += 1;
          if (reqCount === 1) {
            // 第1张成功
            return {
              ok: true,
              json: async () => ({
                created: 1720000000,
                data: [{ b64_json: 'iVBORw0KGgo=' }]
              })
            };
          } else {
            // 第2张模拟安全审核拦截
            return new Response(
              JSON.stringify({ error: { message: 'content_policy_violation: prompt was flagged' } }),
              { status: 400, statusText: 'Bad Request' }
            );
          }
        }
        return {
          ok: true,
          blob: async () => new Blob(['png'], { type: 'image/png' })
        };
      });

      const task = scheduler.createTask(params);
      const assets = await scheduler.execute(
        task,
        { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
        GPT_IMAGE_2_PROFILE
      );

      expect(reqCount).toBe(2);
      expect(task.status).toBe('succeeded');
      expect(assets).toHaveLength(2);

      const succeeded = assets.find((a) => a.status !== 'failed');
      const failed = assets.find((a) => a.status === 'failed');

      expect(succeeded).toBeDefined();
      expect(failed).toBeDefined();
      expect(failed?.errorMessage).toContain('[内容安全审核拦截]');
    });

    it('should start timer when response starts and stop timer when image is returned', async () => {
      const scheduler = new TaskScheduler();
      const params: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'timing precision test',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      };

      const payload = JSON.stringify({
        created: 1720000000,
        data: [{ b64_json: 'iVBORw0KGgo=' }]
      });
      const encoder = new TextEncoder();
      const chunk1 = encoder.encode(payload.slice(0, 20));
      const chunk2 = encoder.encode(payload.slice(20));

      let readStep = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(async () => {
          readStep++;
          if (readStep === 1) {
            return { done: false, value: chunk1 };
          }
          if (readStep === 2) {
            return { done: false, value: chunk2 };
          }
          return { done: true, value: undefined };
        })
      };

      globalThis.fetch = vi.fn().mockImplementation(async (_input: any, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return {
            ok: true,
            body: {
              getReader: () => mockReader
            }
          };
        }
        return {
          ok: true,
          blob: async () => new Blob(['png'], { type: 'image/png' })
        };
      });

      const task = scheduler.createTask(params);
      expect(task.durationFormatted).toBe('0.0s');

      const progressSnapshots: { progress: number; duration: string }[] = [];
      const assets = await scheduler.execute(
        task,
        { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
        GPT_IMAGE_2_PROFILE,
        {
          onProgress: (t) => {
            progressSnapshots.push({ progress: t.progress, duration: t.durationFormatted });
          }
        }
      );

      expect(task.status).toBe('succeeded');
      expect(task.progress).toBe(100);
      expect(assets).toHaveLength(1);
      expect(assets[0].duration).toBeDefined();
      expect(assets[0].duration).not.toBe('');
      // 生成耗时应格式化为形如 "X.Xs"
      expect(assets[0].duration).toMatch(/^\d+\.\d+s$/);
    });

    it('连续创建的任务应拥有严格递增的创建时间，且产物沿用任务创建时间', async () => {
      const scheduler = new TaskScheduler();
      const baseParams: TaskGenerationParams = {
        model: 'gpt-image-2',
        prompt: 'ordered task',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      };

      const task1 = scheduler.createTask({ ...baseParams, prompt: 'first' });
      const task2 = scheduler.createTask({ ...baseParams, prompt: 'second' });
      const task3 = scheduler.createTask({ ...baseParams, prompt: 'third' });

      expect(task2.createdAt).toBeGreaterThan(task1.createdAt);
      expect(task3.createdAt).toBeGreaterThan(task2.createdAt);

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

      const [asset] = await scheduler.execute(
        task1,
        { baseUrl: 'https://example.com/v1', apiKey: 'sk-test', model: 'gpt-image-2' },
        GPT_IMAGE_2_PROFILE
      );

      expect(asset.timestamp).toBe(task1.createdAt);
    });
  });
});
