import { describe, expect, it } from 'vitest';
import { createImageModelProfile, GPT_IMAGE_2_PROFILE, IMAGE_MODEL_DEFINITIONS } from './index';
import { fitModelGeneratedSize, getModelFormatOptions, normalizeModelSettings, resolveModelComplexity, validateModelGenerationParams } from '@/core/models/settings';
import type { ModelGenerationSettings } from '@/types/model';
import { calcMaxSize } from '@/utils/imageSize';
import type { TaskGenerationParams } from '@/types/task';

function params(overrides: Partial<TaskGenerationParams> = {}): TaskGenerationParams & ModelGenerationSettings {
  return { ...createImageModelProfile('gpt-image-2.6-flare').defaultParams, model: 'gpt-image-2.6-flare',
    prompt: 'test', type: 't2i', ...overrides };
}

describe('独立模型能力配置', () => {
  it('未知模型使用原有兜底，不猜测相似模型的能力', () => {
    for (const id of ['custom-model', 'gpt-image-2.7-flare', 'gpt-image-2.6-flare-fast']) {
      const profile = createImageModelProfile(id);
      expect(profile.id).toBe(id);
      expect(profile.formatOptions).toEqual(GPT_IMAGE_2_PROFILE.formatOptions);
      expect(profile.defaultParams).toEqual(GPT_IMAGE_2_PROFILE.defaultParams);
    }
  });

  it('日期快照继承对应模型能力并保留请求 ID', () => {
    const profile = createImageModelProfile('gpt-image-2.6-sunburst-2026-11-01');
    expect(profile.id).toBe('gpt-image-2.6-sunburst-2026-11-01');
    expect(profile.formatOptions.map((option) => option.value)).toEqual(['png', 'jpeg', 'webp', 'gif', 'svg']);
    expect(profile.qualityOptions.map((option) => option.value)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh', 'max']);
    expect(getModelFormatOptions(profile, 'i2i').map((option) => option.value)).not.toContain('svg');
    expect(getModelFormatOptions(profile, 't2i', true).map((option) => option.value)).toEqual(['png', 'webp']);
  });

  it('模型文件可只覆盖部分能力与默认值，实例之间完全隔离', () => {
    const profile = createImageModelProfile('custom', { id: 'custom', maxBatchCount: 2, defaultParams: { quality: 'low' } });
    expect(profile.defaultParams).toEqual({ ...GPT_IMAGE_2_PROFILE.defaultParams, quality: 'low' });
    profile.formatOptions[0].label = 'changed';
    profile.defaultParams.format = 'png';
    expect(createImageModelProfile('custom').formatOptions[0].label).toBe('PNG');
    expect(GPT_IMAGE_2_PROFILE.defaultParams.format).toBe('jpeg');
  });

  it('每份登记配置的默认值都在支持范围内', () => {
    for (const definition of IMAGE_MODEL_DEFINITIONS) {
      const profile = createImageModelProfile(definition.id);
      expect(normalizeModelSettings(profile, profile.defaultParams, 't2i')).toEqual(profile.defaultParams);
    }
    expect(createImageModelProfile('gpt-image-2.5-flare').formatOptions.some((option) => option.value === 'gif')).toBe(false);
  });

  it('切回旧模型时修正新格式画质和附加参数，保留兼容的选择', () => {
    const settings = normalizeModelSettings(GPT_IMAGE_2_PROFILE, params({ quality: 'max', format: 'svg', count: 99 }), 't2i');
    expect(settings.quality).toBe('medium');
    expect(settings.format).toBe('jpeg');
    expect(settings.count).toBe(4);
    expect(normalizeModelSettings(GPT_IMAGE_2_PROFILE, params({ quality: 'low', format: 'webp' }), 't2i').quality).toBe('low');
  });

  it('透明背景回落到当前模型允许的透明格式，而非硬编码 PNG', () => {
    const profile = createImageModelProfile('custom', { id: 'custom', transparentFormats: ['webp'] });
    expect(normalizeModelSettings(profile, params({ format: 'jpeg', transparent: true }), 't2i').format).toBe('webp');
  });

  it('GIF 数值按声明范围校正，SVG 编辑与无效帧参数在边界拒绝', () => {
    const profile = createImageModelProfile('gpt-image-2.6-flare');
    expect(normalizeModelSettings(profile, params({ format: 'gif', frameCount: 30, frameDurationMs: 203 }), 't2i'))
      .toMatchObject({ frameCount: 16, frameDurationMs: 200 });
    expect(() => validateModelGenerationParams(profile, params({ format: 'svg', type: 'i2i', frameCount: undefined, frameDurationMs: undefined })))
      .toThrow('SVG');
    expect(() => validateModelGenerationParams(profile, params({ format: 'gif', frameCount: 1 }))).toThrow('帧数');
    expect(() => validateModelGenerationParams(profile, params({ format: 'gif', outputCompression: 50 }))).toThrow('压缩');
  });
});


describe('模型尺寸和默认配置约束', () => {
  it('只支持固定尺寸的模型允许选择推荐尺寸', () => {
    const profile = createImageModelProfile('fixed', { id: 'fixed', supportsCustomSize: false });
    const settings = normalizeModelSettings(profile, params({ size: '1536x1024' }), 't2i');
    expect(settings.size).toBe('1536x1024');
    expect(normalizeModelSettings(profile, params({ size: '2000x2000' }), 't2i').size).toBe('auto');
  });

  it('没有画质和审核参数的模型不因空列表拒绝生成', () => {
    const profile = createImageModelProfile('simple', { id: 'simple', qualityOptions: [], moderationOptions: [], complexityOptions: [] });
    expect(() => validateModelGenerationParams(profile, params({ model: 'simple', format: 'png', complexity: undefined, frameCount: undefined, frameDurationMs: undefined }))).not.toThrow();
  });
});


describe('复杂度按分辨率与输出格式派生', () => {
  const profile = createImageModelProfile('gpt-image-2.6-flare');

  it('1K 静帧用 medium，2K/4K 与未指定分辨率沿用官方缺省 high', () => {
    expect(resolveModelComplexity(profile, '1k', 'png')).toBe('medium');
    expect(resolveModelComplexity(profile, '2k', 'jpeg')).toBe('high');
    expect(resolveModelComplexity(profile, '4k', 'webp')).toBe('high');
    expect(resolveModelComplexity(profile, 'auto', 'png')).toBe('high');
    expect(resolveModelComplexity(profile, undefined, 'png')).toBe('high');
  });

  it('GIF 与 SVG 覆盖分辨率规则，始终使用 high', () => {
    expect(resolveModelComplexity(profile, '1k', 'gif')).toBe('high');
    expect(resolveModelComplexity(profile, '1k', 'svg')).toBe('high');
  });

  it('未声明该能力的模型不发送复杂度', () => {
    expect(resolveModelComplexity(GPT_IMAGE_2_PROFILE, '1k', 'png')).toBeUndefined();
    expect(resolveModelComplexity(GPT_IMAGE_2_PROFILE, '4k', 'gif')).toBeUndefined();
  });

  it('自定义模型缺少目标档位时回落到已声明的值', () => {
    const custom = createImageModelProfile('custom-complexity', {
      id: 'custom-complexity', complexityOptions: [{ label: '低', value: 'low' }]
    });
    expect(resolveModelComplexity(custom, '1k', 'png')).toBe('low');
    expect(resolveModelComplexity(custom, '4k', 'gif')).toBe('low');
  });
});


describe('可扩展画质与尺寸适配', () => {
  it('模型文件可以声明专属画质值，不需要再修改全局枚举', () => {
    const profile = createImageModelProfile('custom-quality', { id: 'custom-quality',
      qualityOptions: [{ label: '草稿', value: 'draft' }, { label: '超精细', value: 'ultra' }], defaultParams: { quality: 'draft' } });
    expect(normalizeModelSettings(profile, params({ quality: 'max' }), 't2i').quality).toBe('draft');
    expect(normalizeModelSettings(profile, params({ quality: 'ultra' }), 't2i').quality).toBe('ultra');
  });

  it('所有预设比例和分辨率推导出的 2.5 尺寸都满足已知约束', () => {
    const profile = createImageModelProfile('gpt-image-2.5-flare');
    for (const resolution of profile.resolutionOptions) {
      for (const ratio of profile.aspectRatioOptions) {
        const dimensions = calcMaxSize(resolution.value, ratio.value);
        if (!dimensions) continue;
        const size = fitModelGeneratedSize(profile, `${dimensions.width}x${dimensions.height}`, 'png');
        expect(() => validateModelGenerationParams(profile, { ...profile.defaultParams, model: profile.id,
          prompt: 'size', type: 't2i', format: 'png', size })).not.toThrow();
      }
    }
    expect(fitModelGeneratedSize(createImageModelProfile('gpt-image-2.6-flare'), '1024x683', 'gif')).toBe('1024x672');
  });
});
