import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModelStore } from './modelStore';
import { useConfigStore } from './configStore';

describe('useModelStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('should default to gpt-image-2', () => {
    const store = useModelStore();
    expect(store.activeModelId).toBe('gpt-image-2');
    expect(store.activeModel.id).toBe('gpt-image-2');
    expect(store.availableModels).toEqual(['gpt-image-2']);
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

  it('should keep gpt-image-2 when the key supports it', async () => {
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
            { id: 'gpt-image-2.5-sunburst' }
          ]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.availableModels).toEqual([
      'gpt-image-2',
      'gpt-image-2.5-flare',
      'gpt-image-2.5-sunburst'
    ]);
    expect(store.activeModelId).toBe('gpt-image-2');
  });

  it('should fall back to the first model when gpt-image-2 is unavailable', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gpt-image-2.5-flare' }, { id: 'gpt-image-2.5-sunburst' }]
        })
    });

    const store = useModelStore();
    await store.refreshAvailableModels({ adjustSelection: true });

    expect(store.activeModelId).toBe('gpt-image-2.5-flare');
    expect(store.availableModels).toEqual(['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']);
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

    expect(store.activeModelId).toBe('gpt-image-2');
    expect(store.availableModels).toEqual(['gpt-image-2']);
  });
});
