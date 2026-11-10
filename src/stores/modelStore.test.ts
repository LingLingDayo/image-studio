import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModelStore } from './modelStore';
import { useConfigStore } from './configStore';

vi.mock('@/types/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/types/config')>();
  return {
    ...actual,
    ENV_BASE_URL: '',
    ENV_API_KEY: '',
    DEFAULT_CONFIG: { ...actual.DEFAULT_CONFIG, baseUrl: '', apiKey: '' }
  };
});
function deferredModelResponse() {
  let resolve!: (models: string[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ ok: boolean; text: () => Promise<string> }>((res, rej) => {
    resolve = (models) => res({
      ok: true,
      text: async () => JSON.stringify({ data: models.map((id) => ({ id })) })
    });
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useModelStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('should default to gpt-image-2.6-flare', () => {
    const store = useModelStore();
    expect(store.activeModelId).toBe('gpt-image-2.6-flare');
    expect(store.activeModel.id).toBe('gpt-image-2.6-flare');
    expect(store.availableModels).toEqual(['gpt-image-2.6-flare']);
  });

  it('should register and persist an unlisted model when selected', () => {
    const store = useModelStore();
    const configStore = useConfigStore();

    store.setActiveModel('gpt-image-2.5-flare');

    expect(store.activeModelId).toBe('gpt-image-2.5-flare');
    expect(store.activeModel.name).toBe('GPT-Image-2.5 Flare');
    expect(store.availableModels[0]).toBe('gpt-image-2.5-flare');
    expect(configStore.model).toBe('gpt-image-2.5-flare');
    expect(localStorage.getItem('gpt_image_model')).toBe('gpt-image-2.5-flare');
  });

  it('should select gpt-image-2.6-flare when supported by key', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [
            { id: 'gpt-4o' },
            { id: 'gpt-image-2' },
            { id: 'gpt-image-2.5-flare' },
            { id: 'gpt-image-2.6-flare' }
          ]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.availableModels).toEqual([
      'gpt-image-2',
      'gpt-image-2.5-flare',
      'gpt-image-2.6-flare'
    ]);
    expect(store.activeModelId).toBe('gpt-image-2.6-flare');
  });

  it('should select gpt-image-2.5-flare when 2.6-flare is unavailable', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gpt-image-2' }, { id: 'gpt-image-2.5-flare' }]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.activeModelId).toBe('gpt-image-2.5-flare');
  });

  it('should select gpt-image-2 when 2.6 and 2.5 are unavailable', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gpt-image-2' }, { id: 'custom-flux' }]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.activeModelId).toBe('gpt-image-2');
  });

  it('should fall back to the first model when 2.6, 2.5, and 2 are all unavailable', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'custom-flux-pro' }, { id: 'custom-flux-dev' }]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.activeModelId).toBe('custom-flux-pro');
    expect(store.availableModels).toEqual(['custom-flux-pro', 'custom-flux-dev']);
  });

  it('should refresh the list on demand without changing a still-valid selection', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    const store = useModelStore();
    store.setActiveModel('gpt-image-2.5-sunburst');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gpt-image-2.5-flare' }, { id: 'gpt-image-2.5-sunburst' }]
        })
    });

    await store.refreshAvailableModels({ adjustSelection: false });

    expect(store.activeModelId).toBe('gpt-image-2.5-sunburst');
    expect(store.availableModels).toEqual(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);
  });

  it('should ignore fetch errors without changing the current model', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.activeModelId).toBe('gpt-image-2.6-flare');
    expect(store.availableModels).toEqual(['gpt-image-2.6-flare']);
  });

  it('shares concurrent requests for the same credentials while honoring selection adjustment', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({ baseUrl: 'https://api.example.com', apiKey: 'sk-test' });
    const response = deferredModelResponse();
    const fetchMock = vi.fn().mockReturnValue(response.promise);
    globalThis.fetch = fetchMock;
    const store = useModelStore();

    const first = store.refreshAvailableModels({ adjustSelection: false });
    const second = store.refreshAvailableModels({ adjustSelection: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    response.resolve(['gpt-image-2']);
    await Promise.all([first, second]);
    expect(store.availableModels).toEqual(['gpt-image-2']);
    expect(store.activeModelId).toBe('gpt-image-2');
    expect(store.isFetchingModels).toBe(false);
  });

  it.each(['baseUrl', 'apiKey'] as const)(
    'starts a fresh request after %s changes and ignores the old response',
    async (credential) => {
      const configStore = useConfigStore();
      configStore.updateConfig({ baseUrl: 'https://old.example.com', apiKey: 'sk-old' });
      const oldResponse = deferredModelResponse();
      const newResponse = deferredModelResponse();
      const fetchMock = vi.fn()
        .mockReturnValueOnce(oldResponse.promise)
        .mockReturnValueOnce(newResponse.promise);
      globalThis.fetch = fetchMock;
      const store = useModelStore();
      const initialModel = store.activeModelId;
      const oldRequest = store.refreshAvailableModels({ adjustSelection: true });

      configStore.updateConfig(credential === 'baseUrl'
        ? { baseUrl: 'https://new.example.com' }
        : { apiKey: 'sk-new' });
      const newRequest = store.refreshAvailableModels({ adjustSelection: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);

      oldResponse.resolve(['gpt-image-2']);
      await oldRequest;
      expect(store.availableModels).toEqual([initialModel]);
      expect(store.activeModelId).toBe(initialModel);
      expect(store.isFetchingModels).toBe(true);

      newResponse.resolve(['custom-image-new']);
      await newRequest;
      expect(store.availableModels).toEqual(['custom-image-new']);
      expect(store.activeModelId).toBe('custom-image-new');
      expect(configStore.model).toBe('custom-image-new');
      expect(store.isFetchingModels).toBe(false);
    }
  );

  it('does not overwrite a newer result or clear a third request when an older request finishes', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({ baseUrl: 'https://old.example.com', apiKey: 'sk-old' });
    const oldResponse = deferredModelResponse();
    const newResponse = deferredModelResponse();
    const thirdResponse = deferredModelResponse();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise)
      .mockReturnValueOnce(thirdResponse.promise);
    globalThis.fetch = fetchMock;
    const store = useModelStore();
    const oldRequest = store.refreshAvailableModels({ adjustSelection: true });

    configStore.updateConfig({ apiKey: 'sk-new' });
    const newRequest = store.refreshAvailableModels({ adjustSelection: true });
    newResponse.resolve(['custom-image-new']);
    await newRequest;
    const thirdRequest = store.refreshAvailableModels();

    oldResponse.resolve(['gpt-image-2']);
    await oldRequest;
    expect(store.availableModels).toEqual(['custom-image-new']);
    expect(store.activeModelId).toBe('custom-image-new');
    expect(store.isFetchingModels).toBe(true);

    const sharedThirdRequest = store.refreshAvailableModels();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    thirdResponse.resolve(['custom-image-new', 'custom-image-latest']);
    await Promise.all([thirdRequest, sharedThirdRequest]);
    expect(store.availableModels).toEqual(['custom-image-new', 'custom-image-latest']);
    expect(store.isFetchingModels).toBe(false);
  });

  it('ignores stale errors without stopping a newer request', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({ baseUrl: 'https://api.example.com', apiKey: 'sk-old' });
    const oldResponse = deferredModelResponse();
    const newResponse = deferredModelResponse();
    globalThis.fetch = vi.fn()
      .mockReturnValueOnce(oldResponse.promise)
      .mockReturnValueOnce(newResponse.promise);
    const store = useModelStore();
    const oldRequest = store.refreshAvailableModels();

    configStore.updateConfig({ apiKey: 'sk-new' });
    const newRequest = store.refreshAvailableModels();
    oldResponse.reject(new Error('old request failed'));
    await oldRequest;
    expect(store.isFetchingModels).toBe(true);

    newResponse.resolve(['gpt-image-2']);
    await newRequest;
    expect(store.availableModels).toEqual(['gpt-image-2']);
    expect(store.isFetchingModels).toBe(false);
  });

  it('invalidates pending work immediately when credentials are removed', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({ baseUrl: 'https://api.example.com', apiKey: 'sk-test' });
    const response = deferredModelResponse();
    globalThis.fetch = vi.fn().mockReturnValue(response.promise);
    const store = useModelStore();
    const initialModel = store.activeModelId;
    const request = store.refreshAvailableModels({ adjustSelection: true });

    configStore.updateConfig({ apiKey: '' });
    expect(store.isFetchingModels).toBe(false);
    response.resolve(['gpt-image-2']);
    await request;
    expect(store.availableModels).toEqual([initialModel]);
    expect(store.activeModelId).toBe(initialModel);
  });

  it('discards pending work even if credentials change back before it finishes', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({ baseUrl: 'https://api.example.com', apiKey: 'sk-test' });
    const response = deferredModelResponse();
    globalThis.fetch = vi.fn().mockReturnValue(response.promise);
    const store = useModelStore();
    const initialModel = store.activeModelId;
    const request = store.refreshAvailableModels({ adjustSelection: true });

    configStore.updateConfig({ apiKey: 'sk-other' });
    configStore.updateConfig({ apiKey: 'sk-test' });
    response.resolve(['gpt-image-2']);
    await request;
    expect(store.availableModels).toEqual([initialModel]);
    expect(store.activeModelId).toBe(initialModel);
  });
});


describe('模型配置加载入口', () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });
  it('恢复日期快照与配置变更都加载对应能力，不受已有兜底缓存影响', () => {
    localStorage.setItem('gpt_image_model', 'gpt-image-2.6-sunburst-2026-11-01');
    const store = useModelStore();
    expect(store.activeModel.formatOptions.map((option) => option.value)).toContain('svg');
    expect(store.activeModel.name).toBe('GPT-Image-2.6 Sunburst');
    useConfigStore().updateConfig({ model: 'gpt-image-2.5-flare' });
    expect(store.activeModelId).toBe('gpt-image-2.5-flare');
    expect(store.activeModel.qualityOptions.map((option) => option.value)).toContain('max');
    expect(store.activeModel.formatOptions.map((option) => option.value)).not.toContain('gif');
  });
});
