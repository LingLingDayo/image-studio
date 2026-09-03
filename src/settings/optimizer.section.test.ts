import { describe, it, expect, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createSettingsMutator, isGroupVisible, listVisibleFields } from '@/core/settings';
import { SETTING_KEYS, SETTING_RUNTIME } from './keys';

vi.mock('@/core/services/PromptOptimizerService', () => ({
  PromptOptimizerService: {
    fetchModels: vi.fn()
  }
}));

import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import {
  fetchOptimizerModels,
  optimizerSection,
  selectPreferredOptimizerModel
} from './optimizer.section';
import { useConfigStore } from '@/stores/configStore';

describe('optimizer section schema', () => {
  it('prefers current model, then terra, then the first item', () => {
    expect(selectPreferredOptimizerModel(['gpt-4o', 'gpt-5.6-terra'], 'gpt-4o')).toBe('gpt-4o');
    expect(selectPreferredOptimizerModel(['gpt-4o', 'gpt-5.6-terra'], '')).toBe('gpt-5.6-terra');
    expect(selectPreferredOptimizerModel(['claude-3', 'gpt-4o'], '')).toBe('claude-3');
  });

  it('hides model group until api key is present and clears runtime when key is wiped', async () => {
    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.optimizerApiKey]: '',
        [SETTING_KEYS.optimizerModel]: 'gpt-4o'
      },
      {
        [SETTING_RUNTIME.optimizerModels]: ['gpt-4o'],
        [SETTING_RUNTIME.optimizerFetchStatus]: { type: 'success', message: 'ok' }
      }
    );
    const modelsGroup = optimizerSection.groups.find((group) => group.id === 'optimizer.models')!;
    expect(isGroupVisible(modelsGroup, ctx)).toBe(false);

    const apiKeyField = optimizerSection.groups
      .flatMap((group) => group.fields)
      .find((field) => field.key === SETTING_KEYS.optimizerApiKey)!;

    if (typeof apiKeyField.onChange === 'function') {
      await apiKeyField.onChange('', ctx);
    }
    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual([]);

    ctx.setValue(SETTING_KEYS.optimizerApiKey, 'sk-new');
    expect(isGroupVisible(modelsGroup, ctx)).toBe(true);
  });

  it('switches model widget from text to select after models are fetched', () => {
    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.optimizerApiKey]: 'sk',
        [SETTING_KEYS.optimizerModel]: ''
      },
      { [SETTING_RUNTIME.optimizerModels]: [] }
    );
    const modelsGroup = optimizerSection.groups.find((group) => group.id === 'optimizer.models')!;
    const visibleIds = () => listVisibleFields(modelsGroup.fields, ctx).map((field) => field.id ?? field.key);

    expect(visibleIds()).toContain('optimizer.model.text');
    expect(visibleIds()).not.toContain('optimizer.model.select');

    ctx.setRuntime(SETTING_RUNTIME.optimizerModels, ['gpt-5.6-terra']);
    expect(visibleIds()).toContain('optimizer.model.select');
    expect(visibleIds()).not.toContain('optimizer.model.text');
  });

  it('writes preferred model after a successful fetch', async () => {
    vi.mocked(PromptOptimizerService.fetchModels).mockResolvedValueOnce(['gpt-4o', 'gpt-5.6-terra']);
    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.optimizerBaseUrl]: 'https://api.example.com',
        [SETTING_KEYS.optimizerApiKey]: 'sk-test',
        [SETTING_KEYS.optimizerModel]: ''
      },
      {
        [SETTING_RUNTIME.optimizerModels]: [],
        [SETTING_RUNTIME.optimizerIsFetching]: false
      }
    );

    await fetchOptimizerModels(null, ctx);

    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual(['gpt-4o', 'gpt-5.6-terra']);
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('gpt-5.6-terra');
    expect((ctx.runtime[SETTING_RUNTIME.optimizerFetchStatus] as { type: string }).type).toBe('success');
  });

  it('hydrates from store and commits only unlocked optimizer fields', () => {
    setActivePinia(createPinia());
    localStorage.clear();
    const store = useConfigStore();
    store.updateOptimizerConfig({
      baseUrl: 'https://opt.example.com',
      apiKey: 'sk-opt',
      model: 'gpt-4o',
      endpoint: '/v1/messages'
    });

    const slice = optimizerSection.hydrate!();
    const locks = slice.locks ?? {};
    expect(locks[SETTING_KEYS.optimizerBaseUrl]).toBe(store.hasEnvOptimizerBaseUrl);
    expect(slice.values[SETTING_KEYS.optimizerModel]).toBe('gpt-4o');

    if (store.hasEnvOptimizerBaseUrl) {
      expect(slice.values[SETTING_KEYS.optimizerBaseUrl]).toBe(store.effectiveOptimizerBaseUrl);
    } else {
      expect(slice.values[SETTING_KEYS.optimizerBaseUrl]).toBe('https://opt.example.com');
    }

    const ctx = createSettingsMutator(
      {
        ...slice.values,
        [SETTING_KEYS.optimizerModel]: 'gpt-5.6-terra',
        [SETTING_KEYS.optimizerEndpoint]: '/v1/messages'
      },
      {},
      locks
    );
    optimizerSection.commit!(ctx);
    expect(store.optimizerModel).toBe('gpt-5.6-terra');
    expect(store.optimizerEndpoint).toBe('/v1/messages');
  });
});
