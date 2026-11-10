import type { ModelProfile } from '@/types/model';
import { GPT_IMAGE_2_PROFILE } from './fallback';
import { formatImageModelName } from './selection';
import { resolveImageModelDefinition } from './catalog';

export { GPT_IMAGE_2_PROFILE } from './fallback';
export * from './catalog';
export * from './formats';
export * from './selection';

export function createImageModelProfile(id: string, definition = resolveImageModelDefinition(id)): ModelProfile {
  return structuredClone({
    ...GPT_IMAGE_2_PROFILE,
    ...definition,
    id,
    name: definition?.name ?? formatImageModelName(id),
    defaultParams: { ...GPT_IMAGE_2_PROFILE.defaultParams, ...definition?.defaultParams }
  });
}
