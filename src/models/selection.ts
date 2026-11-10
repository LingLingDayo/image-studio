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

export function isImageGenerationModel(id: string): boolean {
  return /image|dall-e|dalle|flux|diffusion|sdxl|midjourney|recraft|ideogram/i.test(id);
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
