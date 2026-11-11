import type { ResolutionTier } from './model';

export interface MediaAsset {
  id?: number;
  batchId?: string;
  url: string;
  blob: Blob;
  prompt: string;
  revisedPrompt?: string;
  model: string;
  size: string;
  ratio?: string;
  width?: number;
  height?: number;
  targetResolution?: ResolutionTier;
  targetRatio?: string;
  targetSize?: string;
  targetFormat?: string;
  quality: string;
  format?: string;
  transparent?: boolean;
  moderation?: string;
  complexity?: string;
  outputCompression?: number;
  frameCount?: number;
  frameDurationMs?: number;
  duration: string;
  timestamp: number;
  isFavorite?: boolean;
  type?: 't2i' | 'i2i';
  referenceImages?: string[];
  status?: 'succeeded' | 'failed';
  errorMessage?: string;
  /** 运行时标记：存储中是否存在可加载的像素数据，false 表示已确认无可用图像。不持久化。 */
  hasImage?: boolean;
}

export interface ArtworkBatch {
  id: string;
  batchId?: string;
  prompt: string;
  revisedPrompt?: string;
  model: string;
  size: string;
  ratio?: string;
  width?: number;
  height?: number;
  targetResolution?: ResolutionTier;
  targetRatio?: string;
  targetSize?: string;
  targetFormat?: string;
  quality: string;
  format?: string;
  transparent?: boolean;
  moderation?: string;
  complexity?: string;
  outputCompression?: number;
  frameCount?: number;
  frameDurationMs?: number;
  duration: string;
  timestamp: number;
  isFavorite?: boolean;
  type?: 't2i' | 'i2i';
  referenceImages?: string[];
  assets: MediaAsset[];
}

