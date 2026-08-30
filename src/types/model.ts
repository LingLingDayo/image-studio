import {
  ASPECT_RATIO_OPTIONS,
  RESOLUTION_OPTIONS,
  type ResolutionTier
} from '@/utils/imageSize';

export type { ResolutionTier };

export type ModelQuality = 'auto' | 'low' | 'medium' | 'high';
export type ModelFormat = 'png' | 'jpeg' | 'webp';

export const TRANSPARENT_CAPABLE_FORMATS: ModelFormat[] = ['png', 'webp'];
export const TRANSPARENT_DEFAULT_FORMAT: ModelFormat = 'png';

export function supportsAlphaChannel(format: ModelFormat): boolean {
  return format === 'png' || format === 'webp';
}

/** jpeg 无 alpha，透明背景必须落到 png/webp；缺省与非法值一律切到 png */
export function resolveTransparentOutputFormat(format?: ModelFormat | null): ModelFormat {
  if (format && supportsAlphaChannel(format)) return format;
  return TRANSPARENT_DEFAULT_FORMAT;
}

export interface ModelProfile {
  id: string;
  name: string;
  providerType: 'openai-compatible' | 'custom';
  description?: string;
  supportedModes: ('t2i' | 'i2i')[];
  resolutionOptions: { label: string; value: ResolutionTier }[];
  aspectRatioOptions: { label: string; value: string; description?: string }[];
  qualityOptions: { label: string; value: ModelQuality }[];
  formatOptions: { label: string; value: ModelFormat }[];
  supportsTransparent: boolean;
  maxBatchCount: number;
  defaultParams: {
    size: string;
    resolution: ResolutionTier;
    aspectRatio: string;
    quality: ModelQuality;
    format: ModelFormat;
    transparent: boolean;
    count: number;
  };
}

/**
 * 默认活跃模型画像: gpt-image-2
 * // Extension Point: 后续若需新增模型，在此注册对应 ModelProfile 即可
 */
export const GPT_IMAGE_2_PROFILE: ModelProfile = {
  id: 'gpt-image-2',
  name: 'GPT-Image-2 (默认)',
  providerType: 'openai-compatible',
  description: '极速、高保真度图像生成与编辑模型',
  supportedModes: ['t2i', 'i2i'],
  resolutionOptions: RESOLUTION_OPTIONS,
  aspectRatioOptions: ASPECT_RATIO_OPTIONS,
  qualityOptions: [
    { label: '自动', value: 'auto' },
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' }
  ],
  formatOptions: [
    { label: 'PNG', value: 'png' },
    { label: 'JPEG', value: 'jpeg' },
    { label: 'WEBP', value: 'webp' }
  ],
  supportsTransparent: true,
  maxBatchCount: 4,
  defaultParams: {
    size: 'auto',
    resolution: 'auto',
    aspectRatio: 'auto',
    quality: 'medium',
    format: 'png',
    transparent: false,
    count: 1
  }
};
