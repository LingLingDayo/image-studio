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

export const ASPECT_RATIO_OPTIONS: { label: string; value: string }[] = [
  { label: '自动', value: 'auto' },
  { label: '1:1', value: '1:1' },
  { label: '5:4', value: '5:4' },
  { label: '4:5', value: '4:5' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '16:10', value: '16:10' },
  { label: '10:16', value: '10:16' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1.91:1', value: '1.91:1' },
  { label: '1:1.91', value: '1:1.91' },
  { label: '2:1', value: '2:1' },
  { label: '1:2', value: '1:2' },
  { label: '21:9', value: '21:9' },
  { label: '9:21', value: '9:21' },
  { label: '3:1', value: '3:1' },
  { label: '1:3', value: '1:3' }
];

const MIN_DIM = 1;
const MAX_DIM = 8192;
const PRESET_RATIO_VALUES = ASPECT_RATIO_OPTIONS
  .map((opt) => opt.value)
  .filter((value) => value !== 'auto');

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
  if (!ratio || ratio === 'auto') return null;
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

export function calcMaxSize(
  resolution: ResolutionTier,
  aspectRatio: string
): { width: number; height: number } | null {
  const cap = resolutionCap(resolution);
  const ratio = parseRatio(aspectRatio);
  if (cap == null || !ratio) return null;

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
  source: 'width' | 'height' | 'max'
): { width: number; height: number } | null {
  const ratio = parseRatio(aspectRatio);
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

export function applyResolutionChange(state: ImageSizeState, next: ResolutionTier): ImageSizeState {
  const nextState: ImageSizeState = { ...state, resolution: next };
  const maxSize = calcMaxSize(next, state.aspectRatio);
  if (maxSize) {
    return { ...nextState, width: maxSize.width, height: maxSize.height };
  }

  if (next !== 'auto' && hasConcreteSize(state)) {
    const fitted = scaleToFitCap(state.width as number, state.height as number, RESOLUTION_PIXELS[next]);
    return { ...nextState, width: fitted.width, height: fitted.height };
  }

  return nextState;
}

export function applyAspectRatioChange(state: ImageSizeState, next: string): ImageSizeState {
  const nextState: ImageSizeState = { ...state, aspectRatio: next };
  if (next === 'auto') return nextState;

  const maxSize = calcMaxSize(state.resolution, next);
  if (maxSize) {
    return { ...nextState, width: maxSize.width, height: maxSize.height };
  }

  if (hasConcreteSize(state)) {
    const locked = applyLockedRatio(state.width, state.height, next, 'max');
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

export function applyWidthChange(state: ImageSizeState, next: number | null): ImageSizeState {
  if (next == null) {
    return { ...state, width: null, height: null };
  }

  const width = sanitizeDim(next);
  if (state.aspectRatio !== 'auto') {
    const locked = applyLockedRatio(width, state.height, state.aspectRatio, 'width');
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

export function applyHeightChange(state: ImageSizeState, next: number | null): ImageSizeState {
  if (next == null) {
    return { ...state, width: null, height: null };
  }

  const height = sanitizeDim(next);
  if (state.aspectRatio !== 'auto') {
    const locked = applyLockedRatio(state.width, height, state.aspectRatio, 'height');
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

export function materializeSize(state: ImageSizeState): ImageSizeState {
  if (hasConcreteSize(state)) return state;

  const maxSize = calcMaxSize(state.resolution, state.aspectRatio);
  if (maxSize) {
    return { ...state, width: maxSize.width, height: maxSize.height };
  }

  if (state.resolution !== 'auto') {
    const cap = RESOLUTION_PIXELS[state.resolution];
    return { ...state, width: cap, height: cap };
  }

  if (state.aspectRatio !== 'auto') {
    const fallback = calcMaxSize('1k', state.aspectRatio);
    if (fallback) {
      return { ...state, width: fallback.width, height: fallback.height };
    }
  }

  return { ...state, width: 1024, height: 1024 };
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
        const presetFromItem = (targetRatio && targetRatio !== 'auto')
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

  const presetFromItem = input.ratio && parseRatio(input.ratio) ? input.ratio : null;
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


export function buildSizePromptHint(state: Pick<ImageSizeState, 'resolution' | 'aspectRatio' | 'width' | 'height'>): string | null {
  if (hasConcreteSize(state)) return null;

  const parts: string[] = [];
  if (state.resolution !== 'auto') {
    const label = RESOLUTION_OPTIONS.find((opt) => opt.value === state.resolution)?.label || state.resolution.toUpperCase();
    parts.push(`${label}分辨率`);
  }
  if (state.aspectRatio && state.aspectRatio !== 'auto') {
    parts.push(`${state.aspectRatio}比例`);
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
  const cleaned = ratio.replace(/^[≈~#\s]+/, '').trim();
  if (!cleaned || cleaned === 'auto') return '1:1';

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
  if ((!targetRatio || targetRatio === 'auto') && dimensions?.width && dimensions?.height) {
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

  if (!targetRatio || targetRatio === 'auto') return '1:1';

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


