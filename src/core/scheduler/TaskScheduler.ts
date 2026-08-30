import type { GenerationTask, TaskGenerationParams } from '@/types/task';
import type { ModelProfile } from '@/types/model';
import type { ProviderConfig } from '@/types/provider';
import type { MediaAsset } from '@/types/asset';
import { defaultImagePipeline, type ImagePipeline } from '@/core/pipeline/ImagePipeline';

export interface TaskExecuteCallbacks {
  onStatusChange?: (task: GenerationTask) => void;
  onProgress?: (task: GenerationTask) => void;
  onSuccess?: (task: GenerationTask, assets: MediaAsset[]) => void;
  onError?: (task: GenerationTask, error: Error) => void;
}

/**
 * 任务调度器 (Task Scheduler)
 * 负责任务生命周期管理、计时器控制与取消机制
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

    task.status = 'processing';
    task.progress = 5;
    task.updatedAt = Date.now();
    callbacks?.onStatusChange?.(task);

    const startTime = Date.now();
    const timer = setInterval(() => {
      task.elapsedSeconds = (Date.now() - startTime) / 1000;
      task.durationFormatted = `${task.elapsedSeconds.toFixed(1)}s`;
      callbacks?.onProgress?.(task);
    }, 100);

    try {
      const assets = await this.pipeline.run({
        task,
        config,
        modelProfile,
        signal: controller.signal,
        onProgress: (percent) => {
          task.progress = percent;
          callbacks?.onProgress?.(task);
        },
        generatedAssets: []
      });

      clearInterval(timer);
      task.elapsedSeconds = (Date.now() - startTime) / 1000;
      task.durationFormatted = `${task.elapsedSeconds.toFixed(1)}s`;
      task.status = 'succeeded';
      task.progress = 100;
      task.updatedAt = Date.now();

      callbacks?.onStatusChange?.(task);
      callbacks?.onSuccess?.(task, assets);
      return assets;
    } catch (err: any) {
      clearInterval(timer);
      task.elapsedSeconds = (Date.now() - startTime) / 1000;
      task.durationFormatted = `${task.elapsedSeconds.toFixed(1)}s`;

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
      clearInterval(timer);
      this.activeAbortControllers.delete(task.id);
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
