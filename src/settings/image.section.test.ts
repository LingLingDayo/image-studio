import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createSettingsMutator, listVisibleFields } from '@/core/settings';
import { useConfigStore } from '@/stores/configStore';
import { imageSection } from './image.section';
import { SETTING_KEYS, SETTING_RUNTIME } from './keys';

describe('image section schema', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('hides env-locked credential fields', () => {
    const group = imageSection.groups[0];
    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.imageBaseUrl]: 'https://env.example.com',
        [SETTING_KEYS.imageApiKey]: 'sk-local'
      },
      {},
      {
        [SETTING_KEYS.imageBaseUrl]: true,
        [SETTING_KEYS.imageApiKey]: false
      }
    );

    const visible = listVisibleFields(group.fields, ctx).map((field) => field.key);
    expect(visible).toEqual([SETTING_KEYS.imageApiKey]);
  });

  it('rejects incomplete image credentials during validate', () => {
    const invalid = imageSection.validate!(
      createSettingsMutator({ [SETTING_KEYS.imageBaseUrl]: 'https://a.com', [SETTING_KEYS.imageApiKey]: '' }, {})
    );
    expect(invalid.ok).toBe(false);

    const valid = imageSection.validate!(
      createSettingsMutator(
        { [SETTING_KEYS.imageBaseUrl]: 'https://a.com', [SETTING_KEYS.imageApiKey]: 'sk-1' },
        {}
      )
    );
    expect(valid.ok).toBe(true);
  });

  it('hydrates from store and commits only unlocked fields', () => {
    const store = useConfigStore();
    store.updateConfig({
      baseUrl: 'https://image.example.com',
      apiKey: 'sk-image'
    });

    const slice = imageSection.hydrate!();
    const locks = slice.locks ?? {};
    expect(locks[SETTING_KEYS.imageBaseUrl]).toBe(store.hasEnvBaseUrl);
    expect(locks[SETTING_KEYS.imageApiKey]).toBe(store.hasEnvApiKey);

    if (store.hasEnvBaseUrl) {
      expect(slice.values[SETTING_KEYS.imageBaseUrl]).toBe(store.effectiveBaseUrl);
    } else {
      expect(slice.values[SETTING_KEYS.imageBaseUrl]).toBe('https://image.example.com');
    }

    if (store.hasEnvApiKey) {
      expect(slice.values[SETTING_KEYS.imageApiKey]).toBe(store.effectiveApiKey);
    } else {
      expect(slice.values[SETTING_KEYS.imageApiKey]).toBe('sk-image');
    }

    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.imageBaseUrl]: 'https://image-2.example.com',
        [SETTING_KEYS.imageApiKey]: 'sk-image-2'
      },
      {},
      locks
    );
    imageSection.commit!(ctx);

    if (!store.hasEnvBaseUrl) {
      expect(store.baseUrl).toBe('https://image-2.example.com');
    }
    if (!store.hasEnvApiKey) {
      expect(store.apiKey).toBe('sk-image-2');
    }
  });

  it('把提示词优化并入分区，并用独立标题区分两组凭据', () => {
    expect(imageSection.groups.map((group) => group.id)).toEqual([
      'image.credentials',
      'optimizer.service',
      'optimizer.advanced'
    ]);

    const optimizerGroup = imageSection.groups[1];
    expect(optimizerGroup.title).toContain('提示词优化');
    expect(optimizerGroup.layout).toBe('subcard');
    expect(optimizerGroup.fields.map((field) => field.label)).toEqual([
      '优化接口地址',
      '优化 API Key',
      '优化模型'
    ]);
  });

  it('hydrate 同时装载生图凭据、优化配置与模型拉取运行时', () => {
    const store = useConfigStore();
    store.updateOptimizerConfig({
      baseUrl: 'https://opt.example.com',
      apiKey: 'sk-opt',
      model: 'model-a',
      endpoint: '/v1/messages'
    });

    const slice = imageSection.hydrate!();
    expect(slice.values[SETTING_KEYS.imageBaseUrl]).toBeDefined();
    expect(slice.values[SETTING_KEYS.imageApiKey]).toBeDefined();
    expect(slice.values[SETTING_KEYS.optimizerModel]).toBe('model-a');
    expect(slice.values[SETTING_KEYS.optimizerEndpoint]).toBe('/v1/messages');
    expect(slice.runtime?.[SETTING_RUNTIME.optimizerModels]).toEqual([]);
  });

  it('仅改动优化配置时跳过生图凭据校验，且不写入生图配置', () => {
    const store = useConfigStore();
    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.imageBaseUrl]: '',
        [SETTING_KEYS.imageApiKey]: '',
        [SETTING_KEYS.optimizerBaseUrl]: 'https://opt.example.com',
        [SETTING_KEYS.optimizerApiKey]: 'sk-opt',
        [SETTING_KEYS.optimizerModel]: 'model-a',
        [SETTING_KEYS.optimizerEndpoint]: '/v1/chat/completions'
      },
      {},
      {}
    );
    const optimizerOnly = new Set([SETTING_KEYS.optimizerModel]);

    expect(imageSection.validate!(ctx).ok).toBe(false);
    expect(imageSection.validate!(ctx, optimizerOnly).ok).toBe(true);

    imageSection.commit!(ctx, optimizerOnly);
    expect(store.optimizerModel).toBe('model-a');
    expect(localStorage.getItem('gpt_image_api_key')).toBeNull();
  });

  it('仅改动生图凭据时仍按生图规则校验', () => {
    const ctx = createSettingsMutator(
      { [SETTING_KEYS.imageBaseUrl]: 'api.example.com', [SETTING_KEYS.imageApiKey]: 'sk-1' },
      {}
    );
    expect(imageSection.validate!(ctx, new Set([SETTING_KEYS.imageBaseUrl]))).toMatchObject({
      ok: false,
      message: expect.stringContaining('http://')
    });
  });
});
