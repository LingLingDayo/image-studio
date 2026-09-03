import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SettingsNav from './SettingsNav.vue';
import SettingsPane from './SettingsPane.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsField from './SettingsField.vue';

vi.mock('@/core/services/PromptOptimizerService', () => ({
  PromptOptimizerService: {
    fetchModels: vi.fn()
  }
}));

vi.mock('@/types/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/types/config')>();
  return {
    ...actual,
    ENV_BASE_URL: '',
    ENV_API_KEY: '',
    DEFAULT_CONFIG: {
      baseUrl: '',
      apiKey: '',
      model: 'gpt-image-2'
    },
    ENV_OPTIMIZER_BASE_URL: '',
    ENV_OPTIMIZER_API_KEY: '',
    ENV_OPTIMIZER_MODEL: '',
    ENV_OPTIMIZER_ENDPOINT: '/v1/chat/completions',
    DEFAULT_OPTIMIZER_CONFIG: {
      baseUrl: '',
      apiKey: '',
      model: '',
      endpoint: '/v1/chat/completions'
    }
  };
});

describe('Settings components', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should export settings shell pieces', async () => {
    const { default: SettingsModal } = await import('./SettingsModal.vue');
    expect(SettingsModal).toBeDefined();
    expect(SettingsNav).toBeDefined();
    expect(SettingsPane).toBeDefined();
    expect(SettingsGroup).toBeDefined();
    expect(SettingsField).toBeDefined();
  });

  async function mountModal(initialTab: string) {
    const { default: SettingsModal } = await import('./SettingsModal.vue');
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render() {
        return h(SettingsModal as any, { isOpen: true, initialTab });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();
    return app;
  }

  function groupTitles(): string[] {
    return [...container.querySelectorAll('.group-title')].map((el) => el.textContent || '');
  }

  it('renders grouped left nav and image credential fields', async () => {
    const app = await mountModal('image');

    expect(container.querySelector('.nav-category')?.textContent).toContain('服务');
    const navLabels = [...container.querySelectorAll('.nav-label')].map((el) => el.textContent);
    expect(navLabels).toContain('生图服务');
    expect(navLabels).toContain('提示词优化');
    expect(groupTitles().some((title) => title.includes('接口凭据'))).toBe(true);
    expect(container.textContent).toContain('生图 API Base URL');
    expect(container.textContent).toContain('生图 API Key');

    app.unmount();
  });

  it('reveals optimizer model group after api key is filled', async () => {
    const app = await mountModal('optimizer');

    expect(groupTitles().some((title) => title.includes('模型与调用端点'))).toBe(false);

    const labels = [...container.querySelectorAll('.input-label')];
    const keyLabel = labels.find((el) => el.textContent?.includes('优化 API Key'));
    const input = keyLabel?.parentElement?.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.value = 'sk-test-key';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(groupTitles().some((title) => title.includes('模型与调用端点'))).toBe(true);
    expect(container.textContent).toContain('获取可用模型');
    expect(container.textContent).toContain('模型名称');
    expect(container.textContent).toContain('调用端点');

    app.unmount();
  });

  it('disables save until required image credentials exist', async () => {
    const app = await mountModal('image');

    const saveBtn = [...container.querySelectorAll('button')].find((btn) =>
      btn.textContent?.includes('保存设置')
    ) as HTMLButtonElement | undefined;
    expect(saveBtn?.disabled).toBe(true);

    const fill = (labelText: string, value: string) => {
      const labels = [...container.querySelectorAll('.input-label')];
      const label = labels.find((el) => el.textContent?.includes(labelText));
      const input = label?.parentElement?.querySelector('input') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      input!.value = value;
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    };

    fill('生图 API Base URL', 'https://api.example.com');
    fill('生图 API Key', 'sk-1');
    await nextTick();

    expect(saveBtn?.disabled).toBe(false);
    app.unmount();
  });
});
