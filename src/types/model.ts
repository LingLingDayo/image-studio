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
 * 候选默认生图模型优先级（降序）：
 * 1. gpt-image-2.6-flare
 * 2. gpt-image-2.5-flare
 * 3. gpt-image-2
 */
export const PREFERRED_IMAGE_MODEL_IDS: readonly string[] = [
  'gpt-image-2.6-flare',
  'gpt-image-2.5-flare',
  'gpt-image-2'
];

/**
 * 默认活跃模型 ID: gpt-image-2.6-flare
 * // Extension Point: 后续若需新增模型，在此注册对应 ModelProfile 即可
 */
export const DEFAULT_IMAGE_MODEL_ID = PREFERRED_IMAGE_MODEL_IDS[0];

const IMAGE_MODEL_LABELS: Record<string, string> = {
  'gpt-image-2.6-flare': 'GPT-Image-2.6 Flare',
  'gpt-image-2.5-flare': 'GPT-Image-2.5 Flare',
  'gpt-image-2.5-sunburst': 'GPT-Image-2.5 Sunburst',
  'gpt-image-2': 'GPT-Image-2',
  'gpt-image-1.5': 'GPT-Image-1.5',
  'gpt-image-1': 'GPT-Image-1',
  'gpt-image-1-mini': 'GPT-Image-1 Mini'
};

export function formatImageModelName(id: string): string {
  if (IMAGE_MODEL_LABELS[id]) return IMAGE_MODEL_LABELS[id];
  const undated = id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (undated !== id && IMAGE_MODEL_LABELS[undated]) {
    return IMAGE_MODEL_LABELS[undated];
  }
  return id;
}

export function isImageGenerationModel(id: string): boolean {
  return /image|dall-e|dalle/i.test(id);
}

/** 优先保留生图模型；若 Key 未返回任何生图模型则回退完整列表。 */
export function resolveImageModelList(rawList: string[]): string[] {
  const unique = Array.from(new Set(rawList.filter((id) => id && id.trim().length > 0)));
  const imageOnly = unique.filter(isImageGenerationModel);
  return imageOnly.length > 0 ? imageOnly : unique;
}

/**
 * 默认选中可用生图模型：
 * 若当前选择仍可用则保持；否则按优先级回退：
 * 1. gpt-image-2.6-flare
 * 2. gpt-image-2.5-flare
 * 3. gpt-image-2
 * 4. 生图 key 模型列表第一项
 */
export function pickAvailableImageModel(list: string[], current?: string): string {
  if (current && list.includes(current)) return current;
  for (const preferred of PREFERRED_IMAGE_MODEL_IDS) {
    if (list.includes(preferred)) {
      return preferred;
    }
  }
  return list[0] ?? current ?? DEFAULT_IMAGE_MODEL_ID;
}

export function createImageModelProfile(id: string): ModelProfile {
  return {
    ...GPT_IMAGE_2_PROFILE,
    id,
    name: formatImageModelName(id),
    defaultParams: { ...GPT_IMAGE_2_PROFILE.defaultParams }
  };
}

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
  supportsTransparent: true,
  maxBatchCount: 4,
  defaultParams: {
    size: 'auto',
    resolution: 'auto',
    aspectRatio: 'auto',
    quality: 'medium',
    format: 'jpeg',
    transparent: false,
    count: 1
  }
};
