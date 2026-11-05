export type ResolutionTier = 'auto' | '1k' | '2k' | '4k';

export interface ImageSizeState {
  resolution: ResolutionTier;
  aspectRatio: string;
  width: number | null;
  height: number | null;
}

export interface RatioParts {
  w: number;
  h: number;
}

export const RESOLUTION_PIXELS: Record<Exclude<ResolutionTier, 'auto'>, number> = {
  '1k': 1024,
  '2k': 2048,
  '4k': 4096
};

export const RESOLUTION_TIER_ORDER: ResolutionTier[] = ['auto', '1k', '2k', '4k'];

export const RESOLUTION_OPTIONS: { label: string; value: ResolutionTier }[] = [
  { label: '自动', value: 'auto' },
  { label: '1K', value: '1k' },
  { label: '2K', value: '2k' },
  { label: '4K', value: '4k' }
];

/**
 * 比例选项定义。
 * - auto: 自动，由模型或具体尺寸决定。
 * - reference: 同参考图，与上传的第一张参考图保持相同比例；若未上传参考图，则效果与 auto 自动一致。
 */
export const ASPECT_RATIO_OPTIONS: { label: string; value: string; description?: string }[] = [
  { label: '自动', value: 'auto' },
  { label: '同参考图', value: 'reference', description: '与第一张参考图比例相同' },
  { label: '1:1', value: '1:1' },
  { label: '2:1', value: '2:1' },
  { label: '1:2', value: '1:2' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '3:1', value: '3:1' },
  { label: '1:3', value: '1:3' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '5:4', value: '5:4' },
  { label: '4:5', value: '4:5' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '21:9', value: '21:9' },
  { label: '9:21', value: '9:21' },
];

const MIN_DIM = 1;
const MAX_DIM = 8192;
const STANDARD_RATIO_PRESETS = ['1.91:1', '1:1.91', '16:10', '10:16'];
const PRESET_RATIO_VALUES = Array.from(
  new Set([
    ...ASPECT_RATIO_OPTIONS.map((opt) => opt.value).filter((value) => value !== 'auto' && !isReferenceRatio(value)),
    ...STANDARD_RATIO_PRESETS
  ])
);

export function isReferenceRatio(ratio?: string | null): boolean {
  if (!ratio) return false;
  const lower = ratio.trim().toLowerCase();
  return lower === 'reference' || lower === 'same_as_reference' || lower === 'match_reference' || lower === '同参考图';
}

/**
 * 解析实际生效的宽高比。
 * 如果设置为「同参考图」(reference)，在提供第一张参考图比例时生效为第一张参考图比例；若未提供参考图或未上传参考图，则回退为 'auto'。
 */
export function resolveEffectiveAspectRatio(
  aspectRatio?: string | null,
  referenceRatio?: string | null
): string {
  if (!aspectRatio || aspectRatio === 'auto') return 'auto';
  if (isReferenceRatio(aspectRatio)) {
    if (referenceRatio && referenceRatio !== 'auto' && parseRatio(referenceRatio)) {
      return referenceRatio;
    }
    return 'auto';
  }
  return aspectRatio;
}

export function createDefaultImageSizeState(): ImageSizeState {
  return {
    resolution: 'auto',
    aspectRatio: 'auto',
    width: null,
    height: null
  };
}

export function hasConcreteSize(state: Pick<ImageSizeState, 'width' | 'height'>): boolean {
  return state.width != null && state.height != null;
}

export function parseRatio(ratio: string): RatioParts | null {
  if (!ratio || ratio === 'auto' || isReferenceRatio(ratio)) return null;
  const cleanRatio = ratio.replace(/^[≈~#\s]+/, '').trim();
  const parts = cleanRatio.split(':');
  if (parts.length !== 2) return null;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

export function sanitizeDim(value: number): number {
  if (!Number.isFinite(value)) return MIN_DIM;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(value)));
}

export function resolutionCap(resolution: ResolutionTier): number | null {
  if (resolution === 'auto') return null;
  return RESOLUTION_PIXELS[resolution];
}

export function inferResolutionTier(maxDim: number): Exclude<ResolutionTier, 'auto'> {
  if (maxDim <= RESOLUTION_PIXELS['1k']) return '1k';
  if (maxDim <= RESOLUTION_PIXELS['2k']) return '2k';
  return '4k';
}

export function bumpResolutionIfNeeded(
  current: ResolutionTier,
  width: number,
  height: number
): ResolutionTier {
  if (current === 'auto') return 'auto';
  const needed = inferResolutionTier(Math.max(width, height));
  const currentIndex = RESOLUTION_TIER_ORDER.indexOf(current);
  const neededIndex = RESOLUTION_TIER_ORDER.indexOf(needed);
  return neededIndex > currentIndex ? needed : current;
}

export function calcMaxSizeFromDimensions(
  resolutionOrCap: ResolutionTier | number,
  width: number,
  height: number
): { width: number; height: number } {
  const cap = typeof resolutionOrCap === 'number'
    ? resolutionOrCap
    : (resolutionCap(resolutionOrCap) || 1024);
  const w = sanitizeDim(width);
  const h = sanitizeDim(height);
  if (w >= h) {
    const resW = cap;
    const resH = sanitizeDim((cap * h) / w);
    return { width: resW, height: Math.min(resH, cap) };
  } else {
    const resH = cap;
    const resW = sanitizeDim((cap * w) / h);
    return { width: Math.min(resW, cap), height: resH };
  }
}

export function calcMaxSize(
  resolution: ResolutionTier,
  aspectRatio: string,
  referenceRatio?: string | null,
  referenceDimensions?: { width?: number; height?: number } | null
): { width: number; height: number } | null {
  const cap = resolutionCap(resolution);
  if (cap == null) return null;

  if (isReferenceRatio(aspectRatio) && referenceDimensions?.width && referenceDimensions?.height) {
    return calcMaxSizeFromDimensions(cap, referenceDimensions.width, referenceDimensions.height);
  }

  const effectiveRatio = resolveEffectiveAspectRatio(aspectRatio, referenceRatio);
  const ratio = parseRatio(effectiveRatio);
  if (!ratio) return null;

  if (ratio.w >= ratio.h) {
    const width = cap;
    const height = sanitizeDim((cap * ratio.h) / ratio.w);
    return { width, height: Math.min(height, cap) };
  }

  const height = cap;
  const width = sanitizeDim((cap * ratio.w) / ratio.h);
  return { width: Math.min(width, cap), height };
}

export function applyLockedRatio(
  width: number | null,
  height: number | null,
  aspectRatio: string,
  source: 'width' | 'height' | 'max',
  referenceRatio?: string | null
): { width: number; height: number } | null {
  const effectiveRatio = resolveEffectiveAspectRatio(aspectRatio, referenceRatio);
  const ratio = parseRatio(effectiveRatio);
  if (!ratio) return null;

  if (source === 'width') {
    if (width == null) return null;
    const w = sanitizeDim(width);
    return { width: w, height: sanitizeDim((w * ratio.h) / ratio.w) };
  }

  if (source === 'height') {
    if (height == null) return null;
    const h = sanitizeDim(height);
    return { width: sanitizeDim((h * ratio.w) / ratio.h), height: h };
  }

  if (width == null || height == null) return null;
  const w = sanitizeDim(width);
  const h = sanitizeDim(height);
  if (w >= h) {
    return { width: w, height: sanitizeDim((w * ratio.h) / ratio.w) };
  }
  return { width: sanitizeDim((h * ratio.w) / ratio.h), height: h };
}

function scaleToFitCap(
  width: number,
  height: number,
  cap: number
): { width: number; height: number } {
  const maxDim = Math.max(width, height);
  if (maxDim <= cap) return { width, height };
  const scale = cap / maxDim;
  return {
    width: sanitizeDim(width * scale),
    height: sanitizeDim(height * scale)
  };
}

export function applyResolutionChange(
  state: ImageSizeState,
  next: ResolutionTier,
  referenceRatio?: string | null,
  referenceDimensions?: { width?: number; height?: number } | null
): ImageSizeState {
  const nextState: ImageSizeState = { ...state, resolution: next };
  const maxSize = calcMaxSize(next, state.aspectRatio, referenceRatio, referenceDimensions);
  if (maxSize) {
    return { ...nextState, width: maxSize.width, height: maxSize.height };
  }

  if (next !== 'auto' && hasConcreteSize(state)) {
    const fitted = scaleToFitCap(state.width as number, state.height as number, RESOLUTION_PIXELS[next]);
    return { ...nextState, width: fitted.width, height: fitted.height };
  }

  return nextState;
}

export function applyAspectRatioChange(
  state: ImageSizeState,
  next: string,
  referenceRatio?: string | null,
  referenceDimensions?: { width?: number; height?: number } | null
): ImageSizeState {
  const nextState: ImageSizeState = { ...state, aspectRatio: next };
  const effectiveRatio = resolveEffectiveAspectRatio(next, referenceRatio);
  if (effectiveRatio === 'auto') {
    if (next === 'auto' || isReferenceRatio(next)) {
      return { ...nextState, width: null, height: null };
    }
    return nextState;
  }

  const maxSize = calcMaxSize(state.resolution, effectiveRatio, referenceRatio, referenceDimensions);
  if (maxSize) {
    return { ...nextState, width: maxSize.width, height: maxSize.height };
  }

  if (hasConcreteSize(state)) {
    const locked = applyLockedRatio(state.width, state.height, effectiveRatio, 'max');
    if (locked) {
      return {
        ...nextState,
        width: locked.width,
        height: locked.height,
        resolution: bumpResolutionIfNeeded(state.resolution, locked.width, locked.height)
      };
    }
  }

  return nextState;
}

export function applyWidthChange(
  state: ImageSizeState,
  next: number | null,
  referenceRatio?: string | null
): ImageSizeState {
  if (next == null) {
    return { ...state, width: null, height: null };
  }

  const width = sanitizeDim(next);
  const effectiveRatio = resolveEffectiveAspectRatio(state.aspectRatio, referenceRatio);
  if (effectiveRatio !== 'auto') {
    const locked = applyLockedRatio(width, state.height, effectiveRatio, 'width');
    if (locked) {
      return {
        ...state,
        width: locked.width,
        height: locked.height,
        resolution: bumpResolutionIfNeeded(state.resolution, locked.width, locked.height)
      };
    }
  }

  const height = state.height == null ? width : sanitizeDim(state.height);
  return {
    ...state,
    width,
    height,
    resolution: bumpResolutionIfNeeded(state.resolution, width, height)
  };
}

export function applyHeightChange(
  state: ImageSizeState,
  next: number | null,
  referenceRatio?: string | null
): ImageSizeState {
  if (next == null) {
    return { ...state, width: null, height: null };
  }

  const height = sanitizeDim(next);
  const effectiveRatio = resolveEffectiveAspectRatio(state.aspectRatio, referenceRatio);
  if (effectiveRatio !== 'auto') {
    const locked = applyLockedRatio(state.width, height, effectiveRatio, 'height');
    if (locked) {
      return {
        ...state,
        width: locked.width,
        height: locked.height,
        resolution: bumpResolutionIfNeeded(state.resolution, locked.width, locked.height)
      };
    }
  }

  const width = state.width == null ? height : sanitizeDim(state.width);
  return {
    ...state,
    width,
    height,
    resolution: bumpResolutionIfNeeded(state.resolution, width, height)
  };
}

export function applySizeAuto(state: ImageSizeState): ImageSizeState {
  return { ...state, width: null, height: null };
}

export function materializeSize(
  state: ImageSizeState,
  referenceRatio?: string | null,
  referenceDimensions?: { width?: number; height?: number } | null
): ImageSizeState {
  if (hasConcreteSize(state)) return state;

  if (isReferenceRatio(state.aspectRatio) && referenceDimensions?.width && referenceDimensions?.height) {
    const tier = state.resolution !== 'auto'
      ? state.resolution
      : inferResolutionTier(Math.max(referenceDimensions.width, referenceDimensions.height));
    const cap = RESOLUTION_PIXELS[tier];
    const maxSize = calcMaxSizeFromDimensions(cap, referenceDimensions.width, referenceDimensions.height);
    return { ...state, width: maxSize.width, height: maxSize.height };
  }

  const maxSize = calcMaxSize(state.resolution, state.aspectRatio, referenceRatio, referenceDimensions);
  if (maxSize) {
    return { ...state, width: maxSize.width, height: maxSize.height };
  }

  if (state.resolution !== 'auto') {
    const cap = RESOLUTION_PIXELS[state.resolution];
    return { ...state, width: cap, height: cap };
  }

  const effectiveRatio = resolveEffectiveAspectRatio(state.aspectRatio, referenceRatio);
  if (effectiveRatio !== 'auto') {
    const fallback = calcMaxSize('1k', effectiveRatio);
    if (fallback) {
      return { ...state, width: fallback.width, height: fallback.height };
    }
  }

  return { ...state, width: 1024, height: 1024 };
}

export interface ResolveGenerationSizeInput {
  sizeState: ImageSizeState;
  referenceImages?: { width?: number; height?: number; ratio?: string }[];
  primaryReferenceRatio?: string | null;
}

/**
 * 解析生成时实际生效的尺寸与分辨率。
 * 当用户设置了分辨率与比例（特别是同参考图且上传了参考图），但未设置具体尺寸时，
 * 自动使用满足该分辨率上限的最大尺寸。
 */
export function resolveEffectiveGenerationSize(input: ResolveGenerationSizeInput): {
  size: string;
  resolution: ResolutionTier;
} {
  const { sizeState, referenceImages, primaryReferenceRatio } = input;

  // 1. 若用户已手动设置了具体宽高，直接使用
  if (hasConcreteSize(sizeState)) {
    return {
      size: formatSizeParam(sizeState),
      resolution: sizeState.resolution
    };
  }

  // 2. 若比例为「同参考图」，且上传了参考图
  const firstRef = referenceImages?.[0];
  if (isReferenceRatio(sizeState.aspectRatio) && firstRef) {
    const refDims = firstRef.width && firstRef.height ? { width: firstRef.width, height: firstRef.height } : null;
    const refRatio = firstRef.ratio || primaryReferenceRatio || null;
    const materialized = materializeSize(sizeState, refRatio, refDims);
    if (hasConcreteSize(materialized)) {
      const tier = sizeState.resolution !== 'auto'
        ? sizeState.resolution
        : inferResolutionTier(Math.max(materialized.width as number, materialized.height as number));
      return {
        size: formatSizeParam(materialized),
        resolution: tier
      };
    }
  }

  // 3. 若用户设置了确定的分辨率（非 auto）和确定的预设比例（非 auto）
  if (sizeState.resolution !== 'auto' && sizeState.aspectRatio !== 'auto' && !isReferenceRatio(sizeState.aspectRatio)) {
    const maxSize = calcMaxSize(sizeState.resolution, sizeState.aspectRatio);
    if (maxSize) {
      return {
        size: `${maxSize.width}x${maxSize.height}`,
        resolution: sizeState.resolution
      };
    }
  }

  // 4. 其余情况回退为原始设定
  return {
    size: formatSizeParam(sizeState),
    resolution: sizeState.resolution
  };
}

export function formatSizeParam(state: Pick<ImageSizeState, 'width' | 'height'>): string {
  if (!hasConcreteSize(state)) return 'auto';
  return `${state.width}x${state.height}`;
}

export function parseSizeString(size?: string): { width: number; height: number } | null {
  if (!size || size === 'auto') return null;
  const match = String(size).match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function nearestAspectRatio(width: number, height: number, tolerance = 0.03): string {
  if (width <= 0 || height <= 0) return 'auto';
  const actual = width / height;
  let best: string = 'auto';
  let bestDiff = tolerance;

  for (const value of PRESET_RATIO_VALUES) {
    const parsed = parseRatio(value);
    if (!parsed) continue;
    const diff = Math.abs(actual - parsed.w / parsed.h);
    if (diff <= bestDiff) {
      best = value;
      bestDiff = diff;
    }
  }

  return best;
}

export function hydrateImageSizeFromSettings(input: {
  size?: string;
  width?: number;
  height?: number;
  ratio?: string;
  resolution?: ResolutionTier;
  aspectRatio?: string;
  targetResolution?: ResolutionTier;
  targetRatio?: string;
  targetSize?: string;
}): ImageSizeState {
  const targetResolution = input.targetResolution ?? input.resolution;
  const targetRatio = input.targetRatio ?? input.aspectRatio;
  const targetSize = input.targetSize ?? input.size;

  // 1. 优先使用生图设定 (targetResolution / targetRatio / targetSize 或 resolution / aspectRatio / size)
  if (targetResolution !== undefined || targetRatio !== undefined || targetSize !== undefined) {
    if (targetSize === 'auto' || (!targetSize && (targetResolution || targetRatio))) {
      return {
        width: null,
        height: null,
        resolution: targetResolution || 'auto',
        aspectRatio: targetRatio || 'auto'
      };
    }

    if (targetSize) {
      const parsed = parseSizeString(targetSize);
      if (parsed) {
        const presetFromItem = (targetRatio && targetRatio !== 'auto' && !isReferenceRatio(targetRatio))
          ? targetRatio
          : (input.ratio && parseRatio(input.ratio) ? input.ratio : null);
        const matchedPreset = presetFromItem && PRESET_RATIO_VALUES.includes(presetFromItem)
          ? presetFromItem
          : nearestAspectRatio(parsed.width, parsed.height);

        return {
          width: parsed.width,
          height: parsed.height,
          resolution: targetResolution || inferResolutionTier(Math.max(parsed.width, parsed.height)),
          aspectRatio: matchedPreset
        };
      }
    }
  }

  // 2. 向后兼容旧数据（无 target* 且无 resolution/aspectRatio 时回退到实际图片尺寸）
  const parsed =
    input.width && input.height
      ? { width: input.width, height: input.height }
      : parseSizeString(input.size);

  if (!parsed) {
    return {
      width: null,
      height: null,
      resolution: targetResolution || 'auto',
      aspectRatio: targetRatio || input.ratio || 'auto'
    };
  }

  const presetFromItem = input.ratio && parseRatio(input.ratio) && !isReferenceRatio(input.ratio) ? input.ratio : null;
  const matchedPreset = presetFromItem && PRESET_RATIO_VALUES.includes(presetFromItem)
    ? presetFromItem
    : nearestAspectRatio(parsed.width, parsed.height);

  return {
    width: parsed.width,
    height: parsed.height,
    resolution: targetResolution || inferResolutionTier(Math.max(parsed.width, parsed.height)),
    aspectRatio: matchedPreset
  };
}

export function hydrateImageSizeFromAsset(input: {
  size?: string;
  width?: number;
  height?: number;
  ratio?: string;
  targetResolution?: ResolutionTier;
  targetRatio?: string;
  targetSize?: string;
}): ImageSizeState {
  return hydrateImageSizeFromSettings(input);
}

export function hydrateImageSizeFromParams(input: {
  size?: string;
  width?: number;
  height?: number;
  ratio?: string;
  resolution?: ResolutionTier;
  aspectRatio?: string;
}): ImageSizeState {
  return hydrateImageSizeFromSettings(input);
}


export function buildSizePromptHint(
  state: Pick<ImageSizeState, 'resolution' | 'aspectRatio' | 'width' | 'height'>,
  referenceRatio?: string | null
): string | null {
  if (hasConcreteSize(state)) return null;

  const parts: string[] = [];
  if (state.resolution !== 'auto') {
    const label = RESOLUTION_OPTIONS.find((opt) => opt.value === state.resolution)?.label || state.resolution.toUpperCase();
    parts.push(`${label}分辨率`);
  }
  const effectiveRatio = resolveEffectiveAspectRatio(state.aspectRatio, referenceRatio);
  if (effectiveRatio && effectiveRatio !== 'auto') {
    parts.push(`${effectiveRatio}比例`);
  }
  if (parts.length === 0) return null;
  return parts.join('，');
}

export function applySizePromptHint(prompt: string, hint: string | null): string {
  if (!hint) return prompt;
  return `${prompt.trim()}\n\n[输出要求: ${hint}]`;
}

/**
 * 将质量英文/代码值转换为友好中文
 */
export function formatQualityLabel(quality?: string): string {
  if (!quality) return '中';
  const q = quality.toLowerCase().trim();
  const map: Record<string, string> = {
    auto: '自动',
    low: '低',
    medium: '中',
    high: '高',
    standard: '标准',
    hd: '高清'
  };
  return map[q] || quality;
}

/**
 * 推导或格式化作品/任务的分辨率标签 (1K/2K/4K)
 */
export function getResolutionDisplay(item?: {
  width?: number;
  height?: number;
  size?: string;
  resolution?: ResolutionTier;
}): string {
  if (item?.resolution && item.resolution !== 'auto') {
    return item.resolution.toUpperCase();
  }
  if (item?.width && item.height) {
    return inferResolutionTier(Math.max(item.width, item.height)).toUpperCase();
  }
  if (item?.size && item.size !== 'auto') {
    const parsed = parseSizeString(item.size);
    if (parsed) {
      return inferResolutionTier(Math.max(parsed.width, parsed.height)).toUpperCase();
    }
  }
  return '1K';
}

/**
 * 格式化用于界面内外展示的宽高比字符串
 * 去除前缀约等号 (≈/~) 与井号，最多保留一位小数，直接显示比例
 */
export function formatDisplayRatio(ratio?: string): string {
  if (!ratio || ratio === 'auto') return '1:1';
  if (isReferenceRatio(ratio)) return '同参考图';
  const cleaned = ratio.replace(/^[≈~#\s]+/, '').trim();
  if (!cleaned || cleaned === 'auto') return '1:1';
  if (isReferenceRatio(cleaned)) return '同参考图';

  // 检查是否为标准比例 16:9, 4:3, 3:4, 1:1, 1.91:1 等预设
  if (PRESET_RATIO_VALUES.includes(cleaned)) {
    return cleaned;
  }

  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      const formatNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
      return `${formatNum(w)}:${formatNum(h)}`;
    }
  }

  return cleaned;
}

/** 展示用户设定的分辨率：自动保持「自动」，生成前不得推断为 1K */
export function formatResolutionSetting(resolution?: ResolutionTier | string | null): string {
  if (!resolution || resolution === 'auto') return '自动';
  return String(resolution).toUpperCase();
}

/** 展示用户设定的宽高比：自动保持「自动」，生成前不得回退为 1:1 */
export function formatRatioSetting(ratio?: string | null): string {
  if (!ratio || ratio === 'auto') return '自动';
  if (isReferenceRatio(ratio)) return '同参考图';
  return formatDisplayRatio(ratio);
}

/** 展示用户设定的尺寸：自动保持「自动」 */
export function formatSizeSetting(size?: string | null): string {
  if (!size || size === 'auto') return '自动';
  return size.replace(/x/i, '×');
}

/**
 * 格式化作品详情页中的“实际比例”
 * 如果不是确定的比例（如带有约等号前缀、或非预设的小数近似比例），前面加上约等号 ≈
 */
export function formatActualRatio(
  ratio?: string,
  dimensions?: { width?: number; height?: number }
): string {
  let targetRatio = ratio;

  // 1. 如果没有 ratio，但有真实宽高，先推导 ratio
  if ((!targetRatio || targetRatio === 'auto' || isReferenceRatio(targetRatio)) && dimensions?.width && dimensions?.height) {
    const w = dimensions.width;
    const h = dimensions.height;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(w, h);
    const reducedW = w / divisor;
    const reducedH = h / divisor;
    const r = w / h;

    // 检查是否完美匹配已知预设
    const matchedPreset = PRESET_RATIO_VALUES.find((p) => {
      const parsed = parseRatio(p);
      return parsed && Math.abs(r - parsed.w / parsed.h) < 0.0001;
    });

    if (matchedPreset) {
      targetRatio = matchedPreset;
    } else if (reducedW <= 50 && reducedH <= 50) {
      targetRatio = `${reducedW}:${reducedH}`;
    } else {
      targetRatio = `≈${Math.round(r * 10) / 10}:1`;
    }
  }

  if (!targetRatio || targetRatio === 'auto' || isReferenceRatio(targetRatio)) return '1:1';

  const raw = String(targetRatio).trim();
  const hasApproxPrefix = /^[≈~]/.test(raw);
  const displayRatio = formatDisplayRatio(raw);

  // 1. 如果原始字符串本身带有约等号前缀，则输出带约等号
  if (hasApproxPrefix) {
    return `≈${displayRatio}`;
  }

  // 2. 如果是标准预设比例（如 16:9, 1:1, 1.91:1, 1:1.91 等），为确定比例
  if (PRESET_RATIO_VALUES.includes(displayRatio)) {
    return displayRatio;
  }

  // 3. 检查是否为整数之比（如 8:5）
  const parts = displayRatio.split(':');
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isInteger(w) && Number.isInteger(h)) {
      return displayRatio;
    }
  }

  // 4. 其他情况（如 2.3:1, 1.8:1, 0.6:1 等非预设小数近似比）属于约等于比例
  return `≈${displayRatio}`;
}


