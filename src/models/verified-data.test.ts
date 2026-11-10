import { describe, expect, it } from 'vitest';
import { createImageModelProfile, IMAGE_MODEL_DEFINITIONS } from './index';
import { validateModelGenerationParams } from '@/core/models/settings';

const MODEL_IDS = ['gpt-image-2', 'gpt-image-2.5', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'];
const EXTENDED_QUALITY = ['auto', 'low', 'medium', 'high', 'xhigh', 'max'];

describe('基于官方文档核实的模型数据', () => {
  it('六个精确 ID 都有独立配置与可追溯的核实记录', () => {
    expect(IMAGE_MODEL_DEFINITIONS.map((definition) => definition.id)).toEqual(MODEL_IDS);
    for (const id of MODEL_IDS) {
      const profile = createImageModelProfile(id);
      expect(profile.verification?.checkedAt).toBe('2026-11-10');
      expect(profile.verification?.sources.length).toBeGreaterThan(0);
      expect(profile.verification?.sources.every((source) => new URL(source).hostname === 'developers.openai.com')).toBe(true);
    }
  });

  it('独立 2.5 模型使用与 Flare 相同的参数配置，保留自身 ID 和名称', () => {
    const model = createImageModelProfile('gpt-image-2.5');
    const flare = createImageModelProfile('gpt-image-2.5-flare');
    expect(model).toEqual({
      ...flare,
      id: 'gpt-image-2.5',
      name: 'GPT-Image-2.5',
      description: '与 GPT-Image-2.5 Flare 使用相同的参数配置',
      verification: expect.objectContaining({
        status: 'unverified',
        unverifiedFields: ['id', ...flare.verification!.unverifiedFields!]
      })
    });
    expect(model.verification?.notes.join(' ')).toContain('参数配置与 gpt-image-2.5-flare 相同');
    expect(model.verification?.notes.join(' ')).not.toContain('别名');
    model.qualityOptions[0].label = 'changed';
    expect(createImageModelProfile('gpt-image-2.5-flare').qualityOptions[0].label).toBe('自动');
  });

  it('gpt-image-2 的真实尺寸限制、预览透明与响应契约覆盖旧兜底', () => {
    const profile = createImageModelProfile('gpt-image-2');
    expect(profile.supportsResponseFormat).toBe(false);
    expect(profile.qualityOptions.map((option) => option.value)).toEqual(['auto', 'low', 'medium', 'high']);
    expect(profile.sizeConstraints).toEqual({ dimensionMultiple: 16, maxDimension: 3840, maxAspectRatio: 3, minPixels: 655360, maxPixels: 8294400 });
    expect(profile.verification?.notes.join(' ')).toContain('预览');
    expect(() => validateModelGenerationParams(profile, { ...profile.defaultParams, model: profile.id, prompt: 'size', type: 't2i', size: '4096x4096' })).toThrow('模型限制');
  });

  it.each(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'])('%s 使用明确确认的画质及静态尺寸限制', (id) => {
    const profile = createImageModelProfile(id);
    expect(profile.qualityOptions.map((option) => option.value)).toEqual(EXTENDED_QUALITY);
    expect(profile.formatOptions.map((option) => option.value)).toEqual(['png', 'jpeg', 'webp']);
    expect(profile.sizeConstraints?.maxDimension).toBe(3840);
    expect(profile.sizeConstraints?.maxPixels).toBe(8294400);
    expect(profile.referenceImageConstraints?.maxCount).toBe(16);
    expect(profile.referenceImageConstraints?.maxBytes).toBeUndefined();
  });

  it.each(['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst'])('%s 保留指南确认的高级画质，未确认限制不从 2.5 外推', (id) => {
    const profile = createImageModelProfile(id);
    expect(profile.qualityOptions.map((option) => option.value)).toEqual(EXTENDED_QUALITY);
    expect(profile.formatOptions.map((option) => option.value)).toEqual(['png', 'jpeg', 'webp', 'gif', 'svg']);
    expect(profile.sizeConstraints).toBeUndefined();
    expect(profile.referenceImageConstraints?.maxBytes).toBeUndefined();
    expect(profile.verification?.unverifiedFields).toContain('supportsTransparent');
    expect(profile.verification?.unverifiedFields).toContain('referenceImageConstraints.mimeTypes');
    expect(profile.apiDefaults).toMatchObject({ complexity: 'high', frameCount: 9, frameDurationMs: 200 });
    expect(profile.formatOptions.find((option) => option.value === 'svg')?.maxRequestCount).toBe(1);
    expect(profile.animation?.frameDurationMs.max).toBe(2000);
    expect(profile.verification?.notes.join(' ')).toContain('指南推荐范围');
  });

  it('官方省略参数默认值与工作台默认值分开，不将 count=4 当成 API 上限', () => {
    for (const id of MODEL_IDS) {
      const profile = createImageModelProfile(id);
      expect(profile.apiDefaults).toMatchObject({ size: 'auto', quality: 'auto', format: 'png', background: 'auto', moderation: 'auto', count: 1, outputCompression: 100 });
      expect(profile.defaultParams).toMatchObject({ quality: 'medium', format: 'jpeg', moderation: 'low' });
      expect(profile.apiRequestCount).toEqual({ min: 1, max: 10, default: 1 });
      expect(profile.maxBatchCount).toBe(4);
    }
  });
});
