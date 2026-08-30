import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConfigStore } from './configStore';

describe('useConfigStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.resetModules();
  });

  it('should initialize with default values when localStorage is empty', () => {
    const store = useConfigStore();
    expect(store.apiKey).toBe('');
    expect(store.model).toBe('gpt-image-2');
  });

  it('should load initial values from localStorage', () => {
    localStorage.setItem('gpt_image_base_url', 'https://api.openai.com/v1');
    localStorage.setItem('gpt_image_api_key', 'sk-test123456');
    localStorage.setItem('gpt_image_model', 'gpt-image-2');

    const store = useConfigStore();
    expect(store.baseUrl).toBe('https://api.openai.com/v1');
    expect(store.apiKey).toBe('sk-test123456');
    expect(store.model).toBe('gpt-image-2');
    expect(store.effectiveBaseUrl).toBe('https://api.openai.com/v1');
    expect(store.isConfigured).toBe(true);
  });

  it('should update config and persist to localStorage', () => {
    const store = useConfigStore();
    store.updateConfig({
      baseUrl: 'https://proxy.example.com/v1',
      apiKey: 'sk-newkey',
      model: 'gpt-image-2'
    });

    expect(store.baseUrl).toBe('https://proxy.example.com/v1');
    expect(store.apiKey).toBe('sk-newkey');
    expect(localStorage.getItem('gpt_image_base_url')).toBe('https://proxy.example.com/v1');
    expect(localStorage.getItem('gpt_image_api_key')).toBe('sk-newkey');
    expect(store.isConfigured).toBe(true);
    expect(store.providerConfig).toEqual({
      baseUrl: 'https://proxy.example.com/v1',
      apiKey: 'sk-newkey',
      model: 'gpt-image-2'
    });
  });

  it('should compute isConfigured correctly based on keys and url', () => {
    const store = useConfigStore();
    expect(store.isConfigured).toBe(false);

    store.updateConfig({ apiKey: 'sk-123' });
    expect(store.isConfigured).toBe(store.hasEnvBaseUrl);

    if (!store.hasEnvBaseUrl) {
      store.updateConfig({ baseUrl: 'https://api.example.com' });
      expect(store.isConfigured).toBe(true);
    }
  });
});

describe('useConfigStore with ENV_BASE_URL', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.resetModules();
  });

  it('should prefer ENV_BASE_URL and consider configured with only apiKey', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: 'https://env-gateway.example.com/v1',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: 'https://env-gateway.example.com/v1',
        apiKey: '',
        model: 'gpt-image-2'
      }
    }));

    const { useConfigStore: useConfigStoreWithEnv } = await import('./configStore');
    const store = useConfigStoreWithEnv();

    expect(store.hasEnvBaseUrl).toBe(true);
    expect(store.effectiveBaseUrl).toBe('https://env-gateway.example.com/v1');
    expect(store.isConfigured).toBe(false);

    // 设置 apiKey 之后，无需配置 baseUrl 即可判定为已配置完成
    store.updateConfig({ apiKey: 'sk-my-token' });
    expect(store.isConfigured).toBe(true);
    expect(store.providerConfig.baseUrl).toBe('https://env-gateway.example.com/v1');
    expect(store.providerConfig.apiKey).toBe('sk-my-token');
  });
});
