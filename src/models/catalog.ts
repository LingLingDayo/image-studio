import type { ModelProfileDefinition } from '@/types/model';
import { GPT_IMAGE_2 } from './profiles/gpt-image-2';
import { GPT_IMAGE_25 } from './profiles/gpt-image-2.5';
import { GPT_IMAGE_25_FLARE } from './profiles/gpt-image-2.5-flare';
import { GPT_IMAGE_25_SUNBURST } from './profiles/gpt-image-2.5-sunburst';
import { GPT_IMAGE_26_FLARE } from './profiles/gpt-image-2.6-flare';
import { GPT_IMAGE_26_SUNBURST } from './profiles/gpt-image-2.6-sunburst';


export const IMAGE_MODEL_DEFINITIONS: readonly ModelProfileDefinition[] = [
  GPT_IMAGE_2,
  GPT_IMAGE_25,
  GPT_IMAGE_25_FLARE,
  GPT_IMAGE_25_SUNBURST,
  GPT_IMAGE_26_FLARE,
  GPT_IMAGE_26_SUNBURST
];

/** 只接受完整 ID 或日期快照，不将未来版本或相似命名误识别成已有模型。 */
export function resolveImageModelDefinition(id: string): ModelProfileDefinition | undefined {
  return IMAGE_MODEL_DEFINITIONS.find((definition) => definition.id === id)
    ?? IMAGE_MODEL_DEFINITIONS.find((definition) => definition.id === id.replace(/-\d{4}-\d{2}-\d{2}$/, ''));
}
