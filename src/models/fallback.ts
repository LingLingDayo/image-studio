import type { ModelProfile } from '@/types/model';
import { ASPECT_RATIO_OPTIONS, RESOLUTION_OPTIONS } from '@/utils/imageSize';
import { MODERATION_OPTIONS } from './formats';

/** 未登记的模型保持原工作台行为；未经确认的服务限制不在兜底里猜测。 */
export const GPT_IMAGE_2_PROFILE: ModelProfile = {
  id: 'gpt-image-2',
  name: 'GPT-Image-2',
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
  moderationOptions: MODERATION_OPTIONS,
  complexityOptions: [],
  supportsTransparent: true,
  transparentFormats: ['png', 'webp'],
  supportsCustomSize: true,
  recommendedSizes: ['1024x1024', '1536x1024', '1024x1536'],
  compression: {
    formats: ['jpeg', 'webp'],
    range: { min: 0, max: 100, step: 1 }
  },
  supportsResponseFormat: true,
  maxBatchCount: 4,
  defaultParams: {
    size: 'auto',
    resolution: 'auto',
    aspectRatio: 'auto',
    quality: 'medium',
    format: 'jpeg',
    transparent: false,
    moderation: 'low',
    count: 1
  }
};
