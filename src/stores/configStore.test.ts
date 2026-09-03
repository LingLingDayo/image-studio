import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

describe('useConfigStore without ENV_BASE_URL', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.resetModules();
  });

  it('should initialize with default values when localStorage is empty', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      ENV_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();
    expect(store.apiKey).toBe('');
    expect(store.model).toBe('gpt-image-2');
    expect(store.hasEnvBaseUrl).toBe(false);
    expect(store.apiKeyHint).toBe('令牌只保存在本机浏览器，不会上传到工作台服务器');
    expect(store.clearPromptOnGenerate).toBe(false);
    expect(store.downloadFilenamePattern).toBe('{prefix}_{date}_{time}_{id}');
    expect(store.downloadImageFormat).toBe('auto');
  });

  it('should support custom apiKeyHint from environment', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      ENV_API_KEY_HINT: '请前往 控制台 -> 令牌管理 复制您的 API Key',
      DEFAULT_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();
    expect(store.apiKeyHint).toBe('请前往 控制台 -> 令牌管理 复制您的 API Key');
  });

  it('should load initial values from localStorage', async () => {
    localStorage.setItem('gpt_image_base_url', 'https://api.openai.com/v1');
    localStorage.setItem('gpt_image_api_key', 'sk-test123456');
    localStorage.setItem('gpt_image_model', 'gpt-image-2');

    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();
    expect(store.baseUrl).toBe('https://api.openai.com/v1');
    expect(store.apiKey).toBe('sk-test123456');
    expect(store.model).toBe('gpt-image-2');
    expect(store.effectiveBaseUrl).toBe('https://api.openai.com/v1');
    expect(store.isConfigured).toBe(true);
  });

  it('should update config and persist to localStorage', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
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

  it('should compute isConfigured correctly based on keys and url', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();
    expect(store.isConfigured).toBe(false);

    store.updateConfig({ apiKey: 'sk-123' });
    expect(store.isConfigured).toBe(false);

    store.updateConfig({ baseUrl: 'https://api.example.com' });
    expect(store.isConfigured).toBe(true);
  });

  it('should manage optimizer config state and persistence correctly', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();

    expect(store.isOptimizerConfigured).toBe(false);

    store.updateOptimizerConfig({
      baseUrl: 'https://optimizer.example.com',
      apiKey: 'sk-opt-123',
      model: 'claude-3-5-sonnet',
      endpoint: '/v1/chat/completions'
    });

    expect(store.isOptimizerConfigured).toBe(true);
    expect(store.optimizerConfig).toEqual({
      baseUrl: 'https://optimizer.example.com',
      apiKey: 'sk-opt-123',
      model: 'claude-3-5-sonnet',
      endpoint: '/v1/chat/completions'
    });
    expect(localStorage.getItem('gpt_optimizer_base_url')).toBe('https://optimizer.example.com');
    expect(localStorage.getItem('gpt_optimizer_api_key')).toBe('sk-opt-123');
    expect(localStorage.getItem('gpt_optimizer_model')).toBe('claude-3-5-sonnet');
  });

  it('should manage general config state and persistence correctly', async () => {
    vi.doMock('@/types/config', () => ({
      ENV_BASE_URL: '',
      ENV_API_KEY: '',
      DEFAULT_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-image-2'
      },
      ENV_OPTIMIZER_BASE_URL: '',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
      }
    }));

    const { useConfigStore } = await import('./configStore');
    const store = useConfigStore();

    expect(store.clearPromptOnGenerate).toBe(false);
    expect(store.downloadFilenamePattern).toBe('{prefix}_{date}_{time}_{id}');
    expect(store.downloadImageFormat).toBe('auto');

    store.updateGeneralConfig({
      clearPromptOnGenerate: true,
      downloadFilenamePattern: '{prefix}_{prompt}_{time}',
      downloadImageFormat: 'png'
    });

    expect(store.clearPromptOnGenerate).toBe(true);
    expect(store.downloadFilenamePattern).toBe('{prefix}_{prompt}_{time}');
    expect(store.downloadImageFormat).toBe('png');
    expect(localStorage.getItem('gpt_image_clear_prompt_on_generate')).toBe('true');
    expect(localStorage.getItem('gpt_image_download_filename_pattern')).toBe('{prefix}_{prompt}_{time}');
    expect(localStorage.getItem('gpt_image_download_format')).toBe('png');
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
      },
      ENV_OPTIMIZER_BASE_URL: 'https://env-optimizer.example.com',
      ENV_OPTIMIZER_API_KEY: '',
      ENV_OPTIMIZER_MODEL: 'gpt-4o-mini',
      ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
      ENV_OPTIMIZER_API_KEY_HINT: '令牌只保存在本机浏览器，不会上传到工作台服务器',
      DEFAULT_OPTIMIZER_CONFIG: {
        baseUrl: 'https://env-optimizer.example.com',
        apiKey: '',
        model: 'gpt-4o-mini',
        endpoint: '/v1/chat/completions'
      },
      DEFAULT_GENERAL_CONFIG: {
        clearPromptOnGenerate: false,
        downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
        downloadImageFormat: 'auto'
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

    // 优化模型也支持 env 优先
    expect(store.hasEnvOptimizerBaseUrl).toBe(true);
    expect(store.effectiveOptimizerBaseUrl).toBe('https://env-optimizer.example.com');
  });
});
