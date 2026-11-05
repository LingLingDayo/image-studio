import { describe, it, expect } from 'vitest';
import {
  GPT_IMAGE_2_PROFILE,
  DEFAULT_IMAGE_MODEL_ID,
  PREFERRED_IMAGE_MODEL_IDS,
  formatImageModelName,
  isImageGenerationModel,
  pickAvailableImageModel,
  resolveImageModelList,
  resolveTransparentOutputFormat,
  supportsAlphaChannel
} from './model';

describe('Model Profile Specification (model.ts)', () => {
  it('should define valid default image model and preferences', () => {
    expect(DEFAULT_IMAGE_MODEL_ID).toBe('gpt-image-2.6-flare');
    expect(PREFERRED_IMAGE_MODEL_IDS).toEqual([
      'gpt-image-2.6-flare',
      'gpt-image-2.5-flare',
      'gpt-image-2'
    ]);
  });
  it('should define valid gpt-image-2 profile configuration', () => {
    expect(GPT_IMAGE_2_PROFILE.id).toBe('gpt-image-2');
    expect(GPT_IMAGE_2_PROFILE.providerType).toBe('openai-compatible');
    expect(GPT_IMAGE_2_PROFILE.supportedModes).toContain('t2i');
    expect(GPT_IMAGE_2_PROFILE.supportedModes).toContain('i2i');
    expect(GPT_IMAGE_2_PROFILE.supportsTransparent).toBe(true);
  });

  it('should include correct default parameters', () => {
    expect(GPT_IMAGE_2_PROFILE.defaultParams.size).toBe('auto');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.resolution).toBe('auto');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.aspectRatio).toBe('auto');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.quality).toBe('medium');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.format).toBe('jpeg');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.count).toBe(1);
  });

  it('should list quality options in Chinese without extra notes', () => {
    expect(GPT_IMAGE_2_PROFILE.qualityOptions).toEqual([
      { label: '自动', value: 'auto' },
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' }
    ]);
  });

  it('should expose resolution and aspect ratio options', () => {
    const resolutionValues = GPT_IMAGE_2_PROFILE.resolutionOptions.map((item) => item.value);
    expect(resolutionValues).toEqual(['auto', '1k', '2k', '4k']);

    const ratioValues = GPT_IMAGE_2_PROFILE.aspectRatioOptions.map((item) => item.value);
    expect(ratioValues).toContain('auto');
    expect(ratioValues).toContain('1:1');
    expect(ratioValues).toContain('16:9');
    expect(ratioValues).toContain('9:16');
    expect(ratioValues).toContain('4:3');
    expect(ratioValues).toContain('3:4');
  });

  it('should coerce jpeg to png for transparent output', () => {
    expect(supportsAlphaChannel('png')).toBe(true);
    expect(supportsAlphaChannel('webp')).toBe(true);
    expect(supportsAlphaChannel('jpeg')).toBe(false);
    expect(resolveTransparentOutputFormat('jpeg')).toBe('png');
    expect(resolveTransparentOutputFormat('webp')).toBe('webp');
    expect(resolveTransparentOutputFormat('png')).toBe('png');
    expect(resolveTransparentOutputFormat()).toBe('png');
  });

  it('should format known image model names and detect image models', () => {
    expect(formatImageModelName('gpt-image-2.6-flare')).toBe('GPT-Image-2.6 Flare');
    expect(formatImageModelName('gpt-image-2.6-flare-2026-03-01')).toBe('GPT-Image-2.6 Flare');
    expect(formatImageModelName('gpt-image-2')).toBe('GPT-Image-2');
    expect(formatImageModelName('gpt-image-2.5-flare')).toBe('GPT-Image-2.5 Flare');
    expect(formatImageModelName('gpt-image-2.5-sunburst')).toBe('GPT-Image-2.5 Sunburst');
    expect(formatImageModelName('gpt-image-2.5-flare-2026-09-08')).toBe('GPT-Image-2.5 Flare');
    expect(formatImageModelName('custom-flux')).toBe('custom-flux');
    expect(isImageGenerationModel('gpt-image-2.6-flare')).toBe(true);
    expect(isImageGenerationModel('gpt-image-2.5-flare')).toBe(true);
    expect(isImageGenerationModel('dall-e-3')).toBe(true);
    expect(isImageGenerationModel('gpt-4o')).toBe(false);
  });

  it('should pick image models by priority: 2.6-flare -> 2.5-flare -> 2 -> first model in list', () => {
    expect(
      resolveImageModelList(['gpt-4o', 'gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare'])
    ).toEqual(['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare']);

    // 1. 有 2.6-flare 时默认优先选中 2.6-flare
    expect(
      pickAvailableImageModel(['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.6-flare'])
    ).toBe('gpt-image-2.6-flare');

    // 2. 没有 2.6-flare 时选中 2.5-flare
    expect(
      pickAvailableImageModel(['gpt-image-2', 'gpt-image-2.5-flare'])
    ).toBe('gpt-image-2.5-flare');

    // 3. 再没有 2.5-flare 时选中 gpt-image-2
    expect(
      pickAvailableImageModel(['gpt-image-2', 'custom-model'])
    ).toBe('gpt-image-2');

    // 4. 还没有时选中生图 key 模型列表的第一个模型
    expect(
      pickAvailableImageModel(['custom-model-a', 'custom-model-b'])
    ).toBe('custom-model-a');

    // 5. 当前已选且依然在列表中时保持当前选择
    expect(
      pickAvailableImageModel(['gpt-image-2', 'gpt-image-2.6-flare', 'custom-model'], 'custom-model')
    ).toBe('custom-model');
  });
});
