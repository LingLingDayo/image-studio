import type { ModelComplexity, ModelFormat, ModelModeration, ModelQuality, ResolutionTier } from './model';

export type TaskStatus = 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
export type TaskType = 't2i' | 'i2i';

/** 预览弹窗所需的最小结构：作品里持久化的参考图只有地址，没有 File。 */
export interface ReferencePreviewItem {
  id: string;
  previewUrl: string;
}

export interface TaskReferenceImage extends ReferencePreviewItem {
  file: File;
  width?: number;
  height?: number;
  ratio?: string;
}

export interface TaskGenerationParams {
  model: string;
  prompt: string;
  type: TaskType;
  size: string;
  resolution?: ResolutionTier;
  aspectRatio?: string;
  quality: ModelQuality;
  format: ModelFormat;
  transparent: boolean;
  moderation?: ModelModeration;
  count: number;
  complexity?: ModelComplexity;
  outputCompression?: number;
  frameCount?: number;
  frameDurationMs?: number;
  referenceImages?: TaskReferenceImage[];
}

export interface GenerationTask {
  id: string;
  type: TaskType;
  params: TaskGenerationParams;
  status: TaskStatus;
  progress: number; // 当前这张图的进度 0 ~ 100，完成一张后归零
  currentIndex: number; // 正在生成的第几张（从 1 开始）
  elapsedSeconds: number;
  durationFormatted: string;
  errorMessage?: string;
  resultAssetIds: number[];
  createdAt: number;
  updatedAt: number;
}
