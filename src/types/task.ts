import type { ModelFormat, ModelQuality, ResolutionTier } from './model';

export type TaskStatus = 'idle' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
export type TaskType = 't2i' | 'i2i';

export interface TaskReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
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
  count: number;
  referenceImages?: TaskReferenceImage[];
}

export interface GenerationTask {
  id: string;
  type: TaskType;
  params: TaskGenerationParams;
  status: TaskStatus;
  progress: number; // 0 ~ 100
  elapsedSeconds: number;
  durationFormatted: string;
  errorMessage?: string;
  resultAssetIds: number[];
  createdAt: number;
  updatedAt: number;
}
