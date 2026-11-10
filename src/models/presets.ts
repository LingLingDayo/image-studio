import type { ModelApiDefaults, ModelProfileDefinition, ModelSizeConstraints } from '@/types/model';
import { GPT_IMAGE_2_PROFILE } from './fallback';

export const IMAGE_GENERATION_GUIDE = 'https://developers.openai.com/api/docs/guides/image-generation';
export const IMAGE_GENERATE_API = 'https://developers.openai.com/api/reference/resources/images/methods/generate';
export const IMAGE_EDIT_API = 'https://developers.openai.com/api/reference/resources/images/methods/edit';
export const MODEL_DATA_CHECKED_AT = '2026-11-10';

export const GPT_IMAGE_API_DEFAULTS: ModelApiDefaults = {
  size: 'auto', quality: 'auto', format: 'png', background: 'auto', moderation: 'auto', count: 1, outputCompression: 100
};

/** 指南明确分别适用于 gpt-image-2 和 2.5，不能外推成 2.6 的硬限制。 */
export const GPT_IMAGE_2_AND_25_SIZE_CONSTRAINTS: ModelSizeConstraints = {
  dimensionMultiple: 16,
  maxDimension: 3840,
  maxAspectRatio: 3,
  minPixels: 655360,
  maxPixels: 8294400
};

const GPT_IMAGE_COMMON_CAPABILITIES: Omit<ModelProfileDefinition, 'id'> = {
  documentationUrl: IMAGE_GENERATION_GUIDE,
  supportedModes: ['t2i', 'i2i'],
  formatOptions: GPT_IMAGE_2_PROFILE.formatOptions,
  supportsResponseFormat: false,
  maxPromptLength: 32000,
  apiDefaults: GPT_IMAGE_API_DEFAULTS,
  apiRequestCount: { min: 1, max: 10, default: 1 },
  // 这里是工作台接受的栅格格式范围，不猜测普通参考图未明确说明的文件字节上限。
  referenceImageConstraints: { mimeTypes: ['image/png', 'image/jpeg', 'image/webp'], maxCount: 16 }
};

const EXTENDED_QUALITY_OPTIONS = [
  ...GPT_IMAGE_2_PROFILE.qualityOptions,
  { label: '极高', value: 'xhigh' },
  { label: '最高', value: 'max' }
];

export const GPT_IMAGE_2_CAPABILITIES: Omit<ModelProfileDefinition, 'id'> = {
  ...GPT_IMAGE_COMMON_CAPABILITIES,
  qualityOptions: GPT_IMAGE_2_PROFILE.qualityOptions,
  sizeConstraints: GPT_IMAGE_2_AND_25_SIZE_CONSTRAINTS,
  recommendedSizes: ['1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'],
  supportsTransparent: true,
  transparentFormats: ['png', 'webp']
};

export const GPT_IMAGE_25_CAPABILITIES: Omit<ModelProfileDefinition, 'id'> = {
  ...GPT_IMAGE_COMMON_CAPABILITIES,
  qualityOptions: EXTENDED_QUALITY_OPTIONS,
  sizeConstraints: GPT_IMAGE_2_AND_25_SIZE_CONSTRAINTS,
  supportsTransparent: true,
  transparentFormats: ['png', 'webp']
};

export const GPT_IMAGE_26_CAPABILITIES: Omit<ModelProfileDefinition, 'id'> = {
  ...GPT_IMAGE_COMMON_CAPABILITIES,
  // 指南 Calculating costs 段明确点名 2.6 的 xhigh/max，不依赖 2.5 的枚举推断。
  qualityOptions: EXTENDED_QUALITY_OPTIONS,
  sizeConstraints: undefined,
  formatOptions: [
    ...GPT_IMAGE_2_PROFILE.formatOptions,
    { label: 'GIF', value: 'gif', tip: '动态图片；需要当前模型的 GIF 预览访问权限。' },
    { label: 'SVG', value: 'svg', supportedModes: ['t2i'], maxRequestCount: 1, tip: '静态矢量图；仅文生图，需要相应项目访问权限。' }
  ],
  complexityOptions: [
    { label: '低', value: 'low' },
    { label: '中', value: 'medium' },
    { label: '高', value: 'high' }
  ],
  animation: {
    frameCount: { min: 2, max: 16, step: 1 },
    // 指南推荐范围；API 未声明 2000ms 请求上限，不能将此值解释为服务端硬上限。
    frameDurationMs: { min: 20, max: 2000, step: 10 }
  },
  apiDefaults: { ...GPT_IMAGE_API_DEFAULTS, complexity: 'high', frameCount: 9, frameDurationMs: 200 },
  defaultParams: { complexity: 'high', frameCount: 9, frameDurationMs: 200 }
};
