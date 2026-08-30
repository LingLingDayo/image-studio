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
  quality: string;
  format?: string;
  transparent?: boolean;
  duration: string;
  timestamp: number;
  isFavorite?: boolean;
  type?: 't2i' | 'i2i';
  referenceImages?: string[];
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
  quality: string;
  format?: string;
  transparent?: boolean;
  duration: string;
  timestamp: number;
  isFavorite?: boolean;
  type?: 't2i' | 'i2i';
  referenceImages?: string[];
  assets: MediaAsset[];
}

