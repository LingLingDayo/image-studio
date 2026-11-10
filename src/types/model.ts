import type { AspectRatioOption, ResolutionTier } from '@/utils/imageSize';

export type { ResolutionTier };
// 画质取值由模型文件约束，兼容 standard/hd 等第三方档位，无需修改全局枚举。
export type ModelQuality = string;
export type ModelFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';
export type ModelModeration = 'auto' | 'low';
export type ModelComplexity = 'low' | 'medium' | 'high';
export type ModelMode = 't2i' | 'i2i';

export interface ModelOption<T> {
  label: string;
  value: T;
  tip?: string;
}

export interface ModelFormatOption extends ModelOption<ModelFormat> {
  /** 未指定时适用于该模型的所有生成模式。 */
  supportedModes?: ModelMode[];
  maxRequestCount?: number;
}

export interface ModelNumberRange {
  min: number;
  max: number;
  step: number;
}

export interface ModelSizeConstraints {
  dimensionMultiple: number;
  maxDimension: number;
  maxAspectRatio: number;
  minPixels: number;
  maxPixels: number;
}

export interface ModelReferenceImageConstraints {
  mimeTypes: string[];
  maxCount: number;
  maxBytes?: number;
}

export interface ModelGenerationSettings {
  size: string;
  resolution: ResolutionTier;
  aspectRatio: string;
  quality: ModelQuality;
  format: ModelFormat;
  transparent: boolean;
  moderation: ModelModeration;
  count: number;
  complexity?: ModelComplexity;
  outputCompression?: number;
  frameCount?: number;
  frameDurationMs?: number;
}

export interface ModelVerification {
  status: 'verified' | 'partial' | 'unverified';
  checkedAt: string;
  sources: string[];
  unverifiedFields?: string[];
  notes: string[];
}

/** 按生成端点核实的参数缺省值，与工作台 defaultParams 分开维护。 */
export interface ModelApiDefaults {
  size: string;
  quality: ModelQuality;
  format: ModelFormat;
  background: 'auto' | 'opaque' | 'transparent';
  moderation: ModelModeration;
  count: number;
  outputCompression: number;
  complexity?: ModelComplexity;
  frameCount?: number;
  frameDurationMs?: number;
}

export interface ModelProfile {
  id: string;
  name: string;
  providerType: 'openai-compatible' | 'custom';
  description?: string;
  documentationUrl?: string;
  verification?: ModelVerification;
  apiDefaults?: ModelApiDefaults;
  apiRequestCount?: { min: number; max: number; default: number };
  supportedModes: ModelMode[];
  resolutionOptions: ModelOption<ResolutionTier>[];
  aspectRatioOptions: AspectRatioOption[];
  qualityOptions: ModelOption<ModelQuality>[];
  formatOptions: ModelFormatOption[];
  moderationOptions: ModelOption<ModelModeration>[];
  complexityOptions: ModelOption<ModelComplexity>[];
  supportsTransparent: boolean;
  transparentFormats: ModelFormat[];
  supportsCustomSize: boolean;
  recommendedSizes: string[];
  sizeConstraints?: ModelSizeConstraints;
  referenceImageConstraints?: ModelReferenceImageConstraints;
  compression: { formats: ModelFormat[]; range: ModelNumberRange; options: ModelOption<number | 'auto'>[] };
  animation?: { frameCount: ModelNumberRange; frameDurationMs: ModelNumberRange };
  /** 老兼容服务使用 response_format，现代 GPT Image 接口固定返回 Base64。 */
  supportsResponseFormat: boolean;
  /** 工作台逐张请求的数量上限，不是 API 单次请求的 n 上限。 */
  maxBatchCount: number;
  maxPromptLength?: number;
  defaultParams: ModelGenerationSettings;
}

/** 模型文件只声明差异；数组整体替换，默认参数按字段合并。 */
export type ModelProfileDefinition = Partial<Omit<ModelProfile, 'id' | 'defaultParams'>> & {
  id: string;
  defaultParams?: Partial<ModelGenerationSettings>;
};

export {
  DEFAULT_IMAGE_MODEL_ID,
  GPT_IMAGE_2_PROFILE,
  MODERATION_OPTIONS,
  PREFERRED_IMAGE_MODEL_IDS,
  TRANSPARENT_CAPABLE_FORMATS,
  TRANSPARENT_DEFAULT_FORMAT,
  createImageModelProfile,
  formatImageModelName,
  isImageGenerationModel,
  pickAvailableImageModel,
  resolveImageModelList,
  resolveTransparentOutputFormat,
  supportsAlphaChannel
} from '@/models';
