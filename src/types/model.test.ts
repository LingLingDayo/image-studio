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
    expect(GPT_IMAGE_2_PROFILE.defaultParams.moderation).toBe('low');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.count).toBe(1);
  });

  it('should list moderation options with auto and low', () => {
    expect(GPT_IMAGE_2_PROFILE.moderationOptions).toEqual([
      { label: '默认', value: 'auto' },
      { label: '低', value: 'low' }
    ]);
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
    expect(isImageGenerationModel('flux-1-schnell')).toBe(true);
    expect(isImageGenerationModel('sdxl-turbo')).toBe(true);
    expect(isImageGenerationModel('gpt-4o')).toBe(false);
  });

  it('should recognize current mainstream image model families by partial tokens', () => {
    const imageModels = [
      'gpt-image-2.6-flare',
      'qwen-image-plus',
      'hunyuan-image-v3.0',
      'gemini-3.1-flash-image-preview',
      'imagen-4-ultra',
      'MiniMax-Image-01',
      'nano-banana',
      'nano-banana-pro',
      'Nano_Banana_2',
      'seedream-5.5',
      'doubao-seedream-4.5',
      'seededit-3.0',
      'jimeng-4.0',
      'flux-2-pro',
      'stable-diffusion-3.5',
      'sdxl-turbo',
      'midjourney-v7',
      'recraft-v3',
      'ideogram-v3',
      'cogview-4',
      'kolors-2.0',
      'wanx-2.1-t2i',
      'grok-imagine',
      'dall-e-3'
    ];
    for (const id of imageModels) {
      expect(isImageGenerationModel(id), id).toBe(true);
    }
  });

  it('should not treat chat, video or embedding models as image models', () => {
    const otherModels = [
      'gpt-4o',
      'deepseek-v4.1-flash',
      'qwen-max',
      'doubao-pro-32k',
      'gemini-2.5-pro',
      'sora-2',
      'seedance-1.0',
      'veo-3',
      'wan2.5-t2v',
      'text-embedding-3-large',
      'whisper-1'
    ];
    for (const id of otherModels) {
      expect(isImageGenerationModel(id), id).toBe(false);
    }
  });

  it('should keep every recognized image model from a mixed key list', () => {
    expect(resolveImageModelList([
      'gpt-4o',
      'seedream-5.5',
      'nano-banana-pro',
      'gemini-3.1-flash-image',
      'deepseek-v4.1-flash'
    ])).toEqual(['seedream-5.5', 'nano-banana-pro', 'gemini-3.1-flash-image']);
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
