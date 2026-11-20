import { resolveImageModelDefinition } from './catalog';

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
 */
export const DEFAULT_IMAGE_MODEL_ID = PREFERRED_IMAGE_MODEL_IDS[0];

const IMAGE_MODEL_LABELS: Record<string, string> = {
  'gpt-image-2': 'GPT-Image-2',
  'gpt-image-1.5': 'GPT-Image-1.5',
  'gpt-image-1': 'GPT-Image-1',
  'gpt-image-1-mini': 'GPT-Image-1 Mini'
};

export function formatImageModelName(id: string): string {
  const configuredName = resolveImageModelDefinition(id)?.name;
  if (configuredName) return configuredName;
  if (IMAGE_MODEL_LABELS[id]) return IMAGE_MODEL_LABELS[id];
  const undated = id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  if (undated !== id && IMAGE_MODEL_LABELS[undated]) {
    return IMAGE_MODEL_LABELS[undated];
  }
  return id;
}

/**
 * 主流生图模型家族的名称片段，用于从 OpenAI 兼容 /models 结果中筛出候选。
 * /models 通常只返回 id、不含能力字段，因此按家族名做部分匹配；只登记当前仍在
 * 使用的家族，不枚举历史版本、日期快照或冷门别名，也不用厂商名泛化，避免把
 * doubao-pro、gemini-2.5-pro、seedance 等同厂商的对话/视频模型混入列表。
 * 片段只决定列表可见性；模型能力仍按精确 ID 解析，未登记模型使用默认配置。
 */
export const IMAGE_MODEL_FAMILY_TOKENS: readonly string[] = [
  // 通用 *-image 命名：gpt-image、qwen-image、hunyuan-image、glm-image、imagen、image-01
  'image',
  // xAI grok-imagine
  'imagine',
  // Google nano-banana 全系
  'banana',
  // 字节跳动即梦 / 豆包：seedream、seededit、jimeng
  'seedream',
  'seededit',
  'jimeng',
  // Black Forest Labs FLUX 全系
  'flux',
  // Stability AI（存量仍广泛使用）
  'diffusion',
  'sdxl',
  // 主流第三方生图服务
  'midjourney',
  'recraft',
  'ideogram',
  // 国内其他主流生图家族
  'cogview',
  'kolors',
  'wanx',
  // OpenAI 存量 DALL·E
  'dalle'
];

/** 抹平大小写与 - _ . 空格差异，让 Nano_Banana_Pro、DALL-E-3 也能命中家族名。 */
function normalizeModelId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isImageGenerationModel(id: string): boolean {
  const normalized = normalizeModelId(id);
  return IMAGE_MODEL_FAMILY_TOKENS.some((token) => normalized.includes(token));
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
