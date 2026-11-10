import type {
  ModelFormatOption, ModelGenerationSettings, ModelMode, ModelNumberRange, ModelOption, ModelProfile
} from '@/types/model';
import type { TaskGenerationParams } from '@/types/task';
import { parseSizeString } from '@/utils/imageSize';

export function getModelFormatOptions(profile: ModelProfile, mode: ModelMode, transparent = false): ModelFormatOption[] {
  return profile.formatOptions.filter((option) =>
    (!option.supportedModes || option.supportedModes.includes(mode)) &&
    (!transparent || profile.supportsTransparent && profile.transparentFormats.includes(option.value))
  );
}

function selectValue<T>(value: T | undefined, options: ModelOption<T>[], fallback: T): T {
  if (options.some((option) => option.value === value)) return value as T;
  return options.find((option) => option.value === fallback)?.value ?? options[0]?.value ?? fallback;
}

function normalizeNumber(value: number | undefined, range: ModelNumberRange, fallback = range.min): number {
  const number = value !== undefined && Number.isFinite(value) ? value : fallback;
  return Math.max(range.min, Math.min(range.max, Math.round(number / range.step) * range.step));
}

/** 兼容的值保持不动，失效的值才回落到模型默认值或首个支持选项。 */
export function normalizeModelSettings(
  profile: ModelProfile, settings: ModelGenerationSettings, mode: ModelMode
): ModelGenerationSettings {
  const defaults = profile.defaultParams;
  const transparent = settings.transparent && profile.supportsTransparent &&
    getModelFormatOptions(profile, mode, true).length > 0;
  const formats = getModelFormatOptions(profile, mode, transparent);
  const format = selectValue(settings.format, formats, transparent ? profile.transparentFormats[0] : defaults.format);
  const animation = profile.animation;
  return {
    ...settings,
    size: profile.supportsCustomSize || profile.recommendedSizes.includes(settings.size) || settings.size === 'auto' && defaults.size === 'auto'
      ? settings.size : defaults.size,
    resolution: selectValue(settings.resolution, profile.resolutionOptions, defaults.resolution),
    aspectRatio: selectValue(settings.aspectRatio, profile.aspectRatioOptions, defaults.aspectRatio),
    quality: selectValue(settings.quality, profile.qualityOptions, defaults.quality),
    format,
    transparent,
    moderation: selectValue(settings.moderation, profile.moderationOptions, defaults.moderation),
    count: normalizeNumber(settings.count, { min: 1, max: profile.maxBatchCount, step: 1 }, defaults.count),
    complexity: profile.complexityOptions.length > 0
      ? selectValue(settings.complexity, profile.complexityOptions, defaults.complexity ?? profile.complexityOptions[0].value)
      : undefined,
    outputCompression: profile.compression.formats.includes(format) && settings.outputCompression !== undefined
      ? normalizeNumber(settings.outputCompression, profile.compression.range, defaults.outputCompression)
      : undefined,
    frameCount: animation ? normalizeNumber(settings.frameCount, animation.frameCount, defaults.frameCount) : undefined,
    frameDurationMs: animation
      ? normalizeNumber(settings.frameDurationMs, animation.frameDurationMs, defaults.frameDurationMs)
      : undefined
  };
}

function validateNumber(value: number | undefined, range: ModelNumberRange, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < range.min || value > range.max || value % range.step !== 0) {
    throw new Error(`${label}必须在 ${range.min}–${range.max} 之间，且为 ${range.step} 的倍数`);
  }
}

/** 协议边界拒绝无效参数，避免历史任务重试时静默改变用户请求。 */
export function validateModelGenerationParams(profile: ModelProfile, params: TaskGenerationParams): void {
  const mode = params.referenceImages?.length ? 'i2i' : params.type;
  if (!profile.supportedModes.includes(mode)) throw new Error(`${profile.name}不支持当前生成模式`);
  if (!getModelFormatOptions(profile, mode, params.transparent).some((option) => option.value === params.format)) {
    throw new Error(`${profile.name}不支持当前模式或背景下的 ${params.format.toUpperCase()} 格式`);
  }
  if (profile.qualityOptions.length > 0 && !profile.qualityOptions.some((option) => option.value === params.quality)) {
    throw new Error(`${profile.name}不支持 ${params.quality} 画质`);
  }
  if (profile.maxPromptLength && params.prompt.length > profile.maxPromptLength) {
    throw new Error(`提示词不能超过 ${profile.maxPromptLength} 个字符`);
  }
  if (params.complexity && !profile.complexityOptions.some((option) => option.value === params.complexity)) {
    throw new Error(`${profile.name}不支持当前复杂度`);
  }
  if (params.outputCompression !== undefined) {
    if (!profile.compression.formats.includes(params.format)) throw new Error('当前输出格式不支持自定义压缩');
    validateNumber(params.outputCompression, profile.compression.range, '压缩值');
  }
  if (params.frameCount !== undefined || params.frameDurationMs !== undefined) {
    if (params.format !== 'gif' || !profile.animation) throw new Error('只有支持动画的 GIF 输出可以设置帧参数');
    validateNumber(params.frameCount, profile.animation.frameCount, '帧数');
    validateNumber(params.frameDurationMs, profile.animation.frameDurationMs, '每帧时长');
  }
  const refs = params.referenceImages ?? [];
  const constraints = profile.referenceImageConstraints;
  if (constraints) {
    if (refs.length > constraints.maxCount) throw new Error(`参考图不能超过 ${constraints.maxCount} 张`);
    for (const ref of refs) {
      if (!constraints.mimeTypes.includes(ref.file.type)) throw new Error(`当前模型不支持 ${ref.file.type || '未知格式'} 参考图`);
      if (constraints.maxBytes && ref.file.size > constraints.maxBytes) throw new Error('参考图文件超过模型大小限制');
    }
  }
  if (params.size && params.size !== 'auto') {
    const size = /^\d+x\d+$/.test(params.size) ? parseSizeString(params.size) : null;
    if (!size || size.width <= 0 || size.height <= 0) throw new Error('图片尺寸必须是有效的正整数宽高');
    if (!profile.supportsCustomSize && !profile.recommendedSizes.includes(params.size)) {
      throw new Error('当前模型不支持自定义尺寸');
    }
    const limits = profile.sizeConstraints;
    const multiple = limits?.dimensionMultiple ?? (params.format === 'gif' ? 16 : undefined);
    if (multiple && (size.width % multiple !== 0 || size.height % multiple !== 0)) {
      throw new Error(`图片宽高必须是 ${multiple} 的倍数`);
    }
    if (limits) {
      const pixels = size.width * size.height;
      const ratio = Math.max(size.width / size.height, size.height / size.width);
      if (Math.max(size.width, size.height) > limits.maxDimension || ratio > limits.maxAspectRatio ||
          pixels < limits.minPixels || pixels > limits.maxPixels) {
        throw new Error(`图片尺寸超过模型限制：边长不超过 ${limits.maxDimension}，比例不超过 ${limits.maxAspectRatio}:1，像素总量 ${limits.minPixels}–${limits.maxPixels}`);
      }
    }
  }
}


/** 仅调整由分辨率/比例推导的尺寸；手填尺寸由边界校验明确反馈。 */
export function fitModelGeneratedSize(profile: ModelProfile, size: string, format: ModelGenerationSettings['format']): string {
  const dimensions = parseSizeString(size);
  if (!dimensions) return size;
  const limits = profile.sizeConstraints;
  const multiple = limits?.dimensionMultiple ?? (format === 'gif' ? 16 : 1);
  if (!limits && multiple === 1) return size;
  const { width, height } = dimensions;
  let scale = 1;
  if (limits) {
    if (Math.max(width / height, height / width) > limits.maxAspectRatio) return 'auto';
    const minScale = Math.sqrt(limits.minPixels / (width * height));
    const maxScale = Math.min(limits.maxDimension / Math.max(width, height), Math.sqrt(limits.maxPixels / (width * height)));
    if (minScale > maxScale) return 'auto';
    scale = Math.max(minScale, Math.min(1, maxScale));
  }
  let nextWidth = Math.max(multiple, Math.floor(width * scale / multiple) * multiple);
  let nextHeight = Math.max(multiple, Math.floor(height * scale / multiple) * multiple);
  if (limits && nextWidth * nextHeight < limits.minPixels) {
    nextWidth = Math.ceil(width * scale / multiple) * multiple;
    nextHeight = Math.ceil(height * scale / multiple) * multiple;
  }
  if (limits && (Math.max(nextWidth, nextHeight) > limits.maxDimension ||
    nextWidth * nextHeight > limits.maxPixels || nextWidth * nextHeight < limits.minPixels ||
    Math.max(nextWidth / nextHeight, nextHeight / nextWidth) > limits.maxAspectRatio)) return 'auto';
  return `${nextWidth}x${nextHeight}`;
}
