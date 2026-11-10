import type { ModelFormat, ModelModeration } from '@/types/model';

export const MODERATION_OPTIONS: { label: string; value: ModelModeration }[] = [
  { label: '默认', value: 'auto' },
  { label: '低', value: 'low' }
];
export const TRANSPARENT_CAPABLE_FORMATS: ModelFormat[] = ['png', 'webp'];
export const TRANSPARENT_DEFAULT_FORMAT: ModelFormat = 'png';

export function supportsAlphaChannel(format: ModelFormat): boolean {
  return TRANSPARENT_CAPABLE_FORMATS.includes(format);
}

export function resolveTransparentOutputFormat(format?: ModelFormat | null): ModelFormat {
  return format && supportsAlphaChannel(format) ? format : TRANSPARENT_DEFAULT_FORMAT;
}
