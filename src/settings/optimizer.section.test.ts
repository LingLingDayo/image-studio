import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  applyFieldChange,
  createSettingsMutator,
  isFieldDisabled,
  isGroupVisible,
  listVisibleFields,
  SETTING_WIDGET,
  type SettingSelectOption
} from '@/core/settings';
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

function createDraft(model = '') {
  return createSettingsMutator(
    {
      [SETTING_KEYS.optimizerBaseUrl]: 'https://api.example.com',
      [SETTING_KEYS.optimizerApiKey]: 'sk-test',
      [SETTING_KEYS.optimizerModel]: model,
      [SETTING_KEYS.optimizerEndpoint]: '/v1/chat/completions'
    },
    {
      [SETTING_RUNTIME.optimizerModels]: [],
      [SETTING_RUNTIME.optimizerFetchStatus]: { type: 'idle', message: '' },
      [SETTING_RUNTIME.optimizerIsFetching]: false
    }
  );
}

function findField(key: string) {
  return optimizerSection.groups.flatMap((group) => group.fields).find((field) => field.key === key)!;
}

function deferredModels() {
  let resolve!: (models: string[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('optimizer section schema', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(PromptOptimizerService.fetchModels).mockReset();
  });

  it('preserves a manually entered model and only defaults an empty selection', () => {
    expect(selectPreferredOptimizerModel(['model-a', 'model-b'], 'model-a')).toBe('model-a');
    expect(selectPreferredOptimizerModel(['model-a', 'model-b'], 'custom-model')).toBe('custom-model');
    expect(selectPreferredOptimizerModel(['model-a', 'model-b'], '')).toBe('model-a');
    expect(selectPreferredOptimizerModel([], '')).toBe('');
  });

  it('shows the model group before credentials are filled and keeps endpoints in advanced options', () => {
    const ctx = createDraft();
    ctx.setValue(SETTING_KEYS.optimizerApiKey, '');
    const modelsGroup = optimizerSection.groups.find((group) => group.id === 'optimizer.models')!;
    const advancedGroup = optimizerSection.groups.find((group) => group.id === 'optimizer.advanced');

    expect(isGroupVisible(modelsGroup, ctx)).toBe(true);
    expect(modelsGroup.fields.some((field) => field.key === SETTING_KEYS.optimizerEndpoint)).toBe(false);
    expect(advancedGroup?.collapsible).toBe(true);
    expect(advancedGroup?.fields.some((field) => field.key === SETTING_KEYS.optimizerEndpoint)).toBe(true);
  });

  it('does not automatically request models when the section opens', async () => {
    await optimizerSection.onOpen?.(createDraft('custom-model'));
    expect(PromptOptimizerService.fetchModels).not.toHaveBeenCalled();
  });

  it.each([SETTING_KEYS.optimizerBaseUrl, SETTING_KEYS.optimizerApiKey])(
    'clears stale model state whenever %s changes',
    async (key) => {
      const ctx = createDraft('custom-model');
      ctx.setRuntime(SETTING_RUNTIME.optimizerModels, ['old-model']);
      ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, { type: 'success', message: 'ok' });
      ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, true);

      await applyFieldChange(findField(key), key === SETTING_KEYS.optimizerBaseUrl ? 'https://new.example.com' : 'sk-new', ctx);

      expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual([]);
      expect(ctx.runtime[SETTING_RUNTIME.optimizerFetchStatus]).toEqual({ type: 'idle', message: '' });
      expect(ctx.runtime[SETTING_RUNTIME.optimizerIsFetching]).toBe(false);
      expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('custom-model');
    }
  );

  it('始终使用同一个可自定义输入的模型下拉框，刷新动作内嵌且不单独呈现', () => {
    const ctx = createDraft('custom-model');
    const group = optimizerSection.groups.find((group) => group.id === 'optimizer.models')!;
    const model = group.fields[0];
    expect(group.title).toBeUndefined();
    expect(group.headerActionId).toBeUndefined();
    expect(listVisibleFields(group.fields, ctx)).toHaveLength(1);
    expect(model.type).toBe(SETTING_WIDGET.COMBOBOX);
    expect(model.refreshAction?.persist).toBe(false);
    ctx.setRuntime(SETTING_RUNTIME.optimizerModels, ['model-a']);
    expect(listVisibleFields(group.fields, ctx)).toEqual([model]);
    const options = typeof model.options === 'function' ? model.options(ctx) : model.options;
    expect(options?.map((option: SettingSelectOption) => option.value)).toEqual(['model-a']);
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, { type: 'success', message: '已获取模型' });
    expect(typeof model.hint === 'function' ? model.hint(ctx) : model.hint).toBe('');
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, { type: 'error', message: '获取失败' });
    expect(typeof model.hint === 'function' ? model.hint(ctx) : model.hint).toBe('获取失败');
  });
  it('selects the first model only when the user has not chosen one', async () => {
    vi.mocked(PromptOptimizerService.fetchModels).mockResolvedValueOnce(['model-a', 'model-b']);
    const ctx = createDraft();
    await fetchOptimizerModels(null, ctx);

    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual(['model-a', 'model-b']);
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('model-a');
    expect((ctx.runtime[SETTING_RUNTIME.optimizerFetchStatus] as { type: string }).type).toBe('success');
  });

  it('keeps the user model after fetching a list that does not include it', async () => {
    vi.mocked(PromptOptimizerService.fetchModels).mockResolvedValueOnce(['model-a']);
    const ctx = createDraft('custom-model');
    await fetchOptimizerModels(null, ctx);
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('custom-model');
  });

  it('preserves a model edited while a fetch is pending', async () => {
    const request = deferredModels();
    vi.mocked(PromptOptimizerService.fetchModels).mockReturnValueOnce(request.promise);
    const ctx = createDraft();
    const pending = fetchOptimizerModels(null, ctx);
    ctx.setValue(SETTING_KEYS.optimizerModel, 'edited-model');

    request.resolve(['model-a']);
    await pending;
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('edited-model');
  });
  it('ignores stale successful responses and does not clear a newer request loading state', async () => {
    const first = deferredModels();
    const second = deferredModels();
    vi.mocked(PromptOptimizerService.fetchModels)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const ctx = createDraft();
    const firstRequest = fetchOptimizerModels(null, ctx);
    await applyFieldChange(findField(SETTING_KEYS.optimizerBaseUrl), 'https://new.example.com', ctx);
    const secondRequest = fetchOptimizerModels(null, ctx);

    first.resolve(['old-model']);
    await firstRequest;
    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual([]);
    expect(ctx.runtime[SETTING_RUNTIME.optimizerIsFetching]).toBe(true);
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('');

    second.resolve(['new-model']);
    await secondRequest;
    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual(['new-model']);
    expect(ctx.values[SETTING_KEYS.optimizerModel]).toBe('new-model');
    expect(ctx.runtime[SETTING_RUNTIME.optimizerIsFetching]).toBe(false);
  });

  it('ignores stale errors after credentials change, including a change back to the same key', async () => {
    const request = deferredModels();
    vi.mocked(PromptOptimizerService.fetchModels).mockReturnValueOnce(request.promise);
    const ctx = createDraft();
    const pending = fetchOptimizerModels(null, ctx);
    await applyFieldChange(findField(SETTING_KEYS.optimizerApiKey), 'sk-other', ctx);
    await applyFieldChange(findField(SETTING_KEYS.optimizerApiKey), 'sk-test', ctx);

    request.reject(new Error('old request failed'));
    await pending;
    expect(ctx.runtime[SETTING_RUNTIME.optimizerFetchStatus]).toEqual({ type: 'idle', message: '' });
    expect(ctx.runtime[SETTING_RUNTIME.optimizerModels]).toEqual([]);
  });

  it('disables fetching without both credentials and rejects malformed URLs', async () => {
    const ctx = createDraft();
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, '');
    expect(isFieldDisabled(findField(SETTING_KEYS.optimizerModel).refreshAction!, ctx)).toBe(true);
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, 'not-a-url');
    await fetchOptimizerModels(null, ctx);
    expect(PromptOptimizerService.fetchModels).not.toHaveBeenCalled();
    expect((ctx.runtime[SETTING_RUNTIME.optimizerFetchStatus] as { type: string }).type).toBe('error');
  });

  it('allows an unused optimizer but validates any configured credentials', () => {
    const ctx = createDraft('preset-model');
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, '');
    ctx.setValue(SETTING_KEYS.optimizerApiKey, '');
    expect(optimizerSection.validate!(ctx).ok).toBe(true);
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, 'https://api.example.com');
    expect(optimizerSection.validate!(ctx)).toMatchObject({ ok: false, message: expect.any(String) });
    ctx.setValue(SETTING_KEYS.optimizerApiKey, 'sk-test');
    ctx.setValue(SETTING_KEYS.optimizerModel, '');
    expect(optimizerSection.validate!(ctx)).toMatchObject({ ok: false, message: expect.any(String) });
    ctx.setValue(SETTING_KEYS.optimizerModel, 'model-a');
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, 'ftp://api.example.com');
    expect(optimizerSection.validate!(ctx).ok).toBe(false);
    ctx.setValue(SETTING_KEYS.optimizerBaseUrl, 'https://api.example.com');
    expect(optimizerSection.validate!(ctx).ok).toBe(true);
  });

  it('hydrates from store and commits only unlocked optimizer fields', () => {
    const store = useConfigStore();
    store.updateOptimizerConfig({
      baseUrl: 'https://opt.example.com',
      apiKey: 'sk-opt',
      model: 'model-a',
      endpoint: '/v1/messages'
    });

    const slice = optimizerSection.hydrate!();
    const locks = slice.locks ?? {};
    expect(locks[SETTING_KEYS.optimizerBaseUrl]).toBe(store.hasEnvOptimizerBaseUrl);
    expect(slice.values[SETTING_KEYS.optimizerModel]).toBe('model-a');
    expect(slice.values[SETTING_KEYS.optimizerBaseUrl]).toBe(
      store.hasEnvOptimizerBaseUrl ? store.effectiveOptimizerBaseUrl : 'https://opt.example.com'
    );

    const ctx = createSettingsMutator(
      { ...slice.values, [SETTING_KEYS.optimizerModel]: 'model-b', [SETTING_KEYS.optimizerEndpoint]: '/v1/messages' },
      {},
      locks
    );
    optimizerSection.commit!(ctx);
    expect(store.optimizerModel).toBe('model-b');
    expect(store.optimizerEndpoint).toBe('/v1/messages');
  });
});
