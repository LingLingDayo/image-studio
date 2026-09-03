import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createSettingsMutator, listVisibleFields } from '@/core/settings';
import { useConfigStore } from '@/stores/configStore';
import { imageSection } from './image.section';
import { SETTING_KEYS } from './keys';

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
});
