import type { GenerationTask, TaskGenerationParams } from '@/types/task';
import type { ModelProfile } from '@/types/model';
import type { ProviderConfig } from '@/types/provider';
import type { MediaAsset } from '@/types/asset';
import { defaultImagePipeline, type ImagePipeline } from '@/core/pipeline/ImagePipeline';

export interface TaskExecuteCallbacks {
  onStatusChange?: (task: GenerationTask) => void;
  onProgress?: (task: GenerationTask) => void;
  onImageComplete?: (task: GenerationTask, assets: MediaAsset[]) => void;
  onSuccess?: (task: GenerationTask, assets: MediaAsset[]) => void;
  onError?: (task: GenerationTask, error: Error) => void;
}

/**
 * 根据分辨率等级获取任务基准估算耗时（秒）
 * 1k: 30s
 * 2k: 40s
 * 4k: 50s
 * auto / 其它: 40s
 */
export function getBaseDurationSeconds(resolution?: string | null): number {
  if (!resolution) return 40;
  const lower = resolution.toLowerCase();
  if (lower === '1k') return 30;
  if (lower === '2k') return 40;
  if (lower === '4k') return 50;
  return 40;
}

/**
 * 进度估算计算器
 * 在基准时间内：平滑从 0% 增长到 95%
 * 超过基准时间：卡在 95%，随后每 5s~10s 递增 1%（96% -> 97% -> 98% -> 99%），达到 99% 后保持不变
 */
export class TaskProgressTracker {
  private baseSeconds: number;
  private stepThresholds: number[];

  constructor(resolution?: string | null, customDelays?: number[]) {
    this.baseSeconds = getBaseDurationSeconds(resolution);
    let current = this.baseSeconds;
    this.stepThresholds = [];
    for (let i = 0; i < 4; i++) {
      const stepDuration = customDelays?.[i] ?? (5 + Math.random() * 5);
      current += stepDuration;
      this.stepThresholds.push(current);
    }
  }

  public getBaseSeconds(): number {
    return this.baseSeconds;
  }

  public calculateProgress(elapsedSeconds: number): number {
    if (elapsedSeconds <= 0) {
      return 0;
    }

    if (elapsedSeconds <= this.baseSeconds) {
      // 基准时间内，平滑增长到 95%
      const ratio = elapsedSeconds / this.baseSeconds;
      return Math.min(95, Math.floor(ratio * 95));
    }

    // 超出基准时间：卡在 95%，每 5s~10s 加 1%，一直加到 99%
    if (elapsedSeconds < this.stepThresholds[0]) {
      return 95;
    } else if (elapsedSeconds < this.stepThresholds[1]) {
      return 96;
    } else if (elapsedSeconds < this.stepThresholds[2]) {
      return 97;
    } else if (elapsedSeconds < this.stepThresholds[3]) {
      return 98;
    } else {
      return 99;
    }
  }
}

/**
 * 任务调度器 (Task Scheduler)
 * 负责任务生命周期管理、动态平滑计时进度与取消机制
 */
export class TaskScheduler {
  private activeAbortControllers = new Map<string, AbortController>();
  private pipeline: ImagePipeline;

  constructor(pipeline: ImagePipeline = defaultImagePipeline) {
    this.pipeline = pipeline;
  }

  public createTask(params: TaskGenerationParams): GenerationTask {
    const now = Date.now();
    return {
      id: `task_${now}_${Math.random().toString(36).substring(2, 7)}`,
      type: params.type,
      params: { ...params },
      status: 'idle',
      progress: 0,
      currentIndex: 1,
      elapsedSeconds: 0,
      durationFormatted: '0.0s',
      resultAssetIds: [],
      createdAt: now,
      updatedAt: now
    };
  }

  public async execute(
    task: GenerationTask,
    config: ProviderConfig,
    modelProfile: ModelProfile,
    callbacks?: TaskExecuteCallbacks
  ): Promise<MediaAsset[]> {
    const controller = new AbortController();
    this.activeAbortControllers.set(task.id, controller);

    const total = Math.max(1, task.params.count || 1);
    const allAssets: MediaAsset[] = [];

    task.status = 'processing';
    task.progress = 0;
    task.currentIndex = 1;
    task.elapsedSeconds = 0;
    task.durationFormatted = '0.0s';
    task.updatedAt = Date.now();
    callbacks?.onStatusChange?.(task);
    callbacks?.onProgress?.(task);

    try {
      for (let i = 0; i < total; i++) {
        if (controller.signal.aborted) {
          throw new Error('任务已被用户取消');
        }

        task.currentIndex = i + 1;
        const assets = await this.executeSingleImage(
          task,
          config,
          modelProfile,
          controller.signal,
          callbacks
        );
        allAssets.push(...assets);
        callbacks?.onImageComplete?.(task, assets);
      }

      task.status = 'succeeded';
      task.progress = 100;
      task.updatedAt = Date.now();
      callbacks?.onProgress?.(task);
      callbacks?.onStatusChange?.(task);
      callbacks?.onSuccess?.(task, allAssets);
      return allAssets;
    } catch (err: any) {
      if (controller.signal.aborted) {
        task.status = 'cancelled';
        task.errorMessage = '已取消生成';
      } else {
        task.status = 'failed';
        task.errorMessage = err.message || '未知生成错误';
      }

      task.updatedAt = Date.now();
      callbacks?.onStatusChange?.(task);
      callbacks?.onError?.(task, err);
      throw err;
    } finally {
      this.activeAbortControllers.delete(task.id);
    }
  }

  /**
   * 生成单张图片：进度从 0 平滑增长，完成后由外层循环归零进入下一张
   */
  private async executeSingleImage(
    task: GenerationTask,
    config: ProviderConfig,
    modelProfile: ModelProfile,
    signal: AbortSignal,
    callbacks?: TaskExecuteCallbacks
  ): Promise<MediaAsset[]> {
    const tracker = new TaskProgressTracker(task.params.resolution);
    task.progress = 0;
    task.elapsedSeconds = 0;
    task.durationFormatted = '0.0s';
    task.updatedAt = Date.now();
    callbacks?.onProgress?.(task);

    const startTime = Date.now();
    const timer = setInterval(() => {
      task.elapsedSeconds = (Date.now() - startTime) / 1000;
      task.durationFormatted = `${task.elapsedSeconds.toFixed(1)}s`;
      task.progress = tracker.calculateProgress(task.elapsedSeconds);
      callbacks?.onProgress?.(task);
    }, 100);

    try {
      const assets = await this.pipeline.run({
        task,
        config,
        modelProfile,
        signal,
        generatedAssets: []
      });

      task.elapsedSeconds = (Date.now() - startTime) / 1000;
      task.durationFormatted = `${task.elapsedSeconds.toFixed(1)}s`;
      task.progress = 100;
      task.updatedAt = Date.now();
      callbacks?.onProgress?.(task);
      return assets;
    } finally {
      clearInterval(timer);
    }
  }

  public cancel(taskId: string): boolean {
    const controller = this.activeAbortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(taskId);
      return true;
    }
    return false;
  }
}

export const defaultTaskScheduler = new TaskScheduler();
