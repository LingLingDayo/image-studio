import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SettingsNav from './SettingsNav.vue';
import SettingsPane from './SettingsPane.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsField from './SettingsField.vue';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';

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
    vi.mocked(PromptOptimizerService.fetchModels).mockReset();
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
        return h(SettingsModal, { isOpen: true, initialTab });
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
    expect(container.querySelector('.pane-heading h4')?.textContent).toBe('生图服务');
    expect(container.textContent).toContain('接口地址');
    expect(container.textContent).toContain('API Key');

    app.unmount();
  });

  it('shows optional optimizer model setup before credentials are filled', async () => {
    const app = await mountModal('optimizer');

    expect(container.querySelector('.ui-combobox input')).not.toBeNull();
    expect(groupTitles()).not.toContain('优化模型');
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);

    const labels = [...container.querySelectorAll('.input-label')];
    const keyLabel = labels.find((el) => el.textContent?.includes('API Key'));
    const input = keyLabel?.parentElement?.querySelector('input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input!.value = 'sk-test-key';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(container.querySelector('.ui-combobox input')).not.toBeNull();
    expect(groupTitles()).not.toContain('优化模型');
    expect(container.querySelector('.combobox-refresh')?.getAttribute('aria-label')).toBe('获取模型列表');
    expect(container.textContent).not.toContain('获取可用模型');
    expect(container.textContent).toContain('优化模型');
    expect(container.textContent).toContain('调用端点');

    app.unmount();
  });

  it('内嵌刷新获取列表，不覆盖正在输入的模型，也不显示成功提示条', async () => {
    let resolveModels!: (models: string[]) => void;
    vi.mocked(PromptOptimizerService.fetchModels).mockReturnValueOnce(new Promise((resolve) => { resolveModels = resolve; }));
    const app = await mountModal('optimizer');
    try {
      const refresh = container.querySelector('.combobox-refresh') as HTMLButtonElement;
      const input = container.querySelector('.ui-combobox input') as HTMLInputElement;
      expect(refresh.disabled).toBe(true);
      expect(input.disabled).toBe(false);
      const fill = (label: string, value: string) => {
        const node = [...container.querySelectorAll('.input-label')].find((item) => item.textContent?.includes(label));
        const field = node?.parentElement?.querySelector('input') as HTMLInputElement;
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      };
      fill('接口地址', 'https://api.example.com');
      fill('API Key', 'test-key');
      await nextTick();
      refresh.click();
      await nextTick();
      expect(refresh.disabled).toBe(true);
      expect(refresh.getAttribute('aria-busy')).toBe('true');
      input.value = 'custom-model';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      resolveModels(['remote-model']);
      await vi.waitFor(() => expect(refresh.disabled).toBe(false));
      expect(input.value).toBe('custom-model');
      expect(container.textContent).not.toContain('已获取');
      expect(container.querySelector('.setting-status')).toBeNull();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      await nextTick();
      expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    } finally {
      app.unmount();
    }
  });

  it('未获取列表也能保存自定义模型名称', async () => {
    localStorage.setItem('gpt_optimizer_base_url', 'https://api.example.com');
    localStorage.setItem('gpt_optimizer_api_key', 'test-key');
    const app = await mountModal('optimizer');
    try {
      const input = container.querySelector('.ui-combobox input') as HTMLInputElement;
      input.value = 'custom-provider-model';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      const save = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === '保存设置')!;
      save.click();
      await nextTick();
      expect(localStorage.getItem('gpt_optimizer_model')).toBe('custom-provider-model');
      expect(PromptOptimizerService.fetchModels).not.toHaveBeenCalled();
    } finally {
      app.unmount();
    }
  });
  it('刷新失败只显示错误说明，仍然允许手动输入模型', async () => {
    localStorage.setItem('gpt_optimizer_base_url', 'https://api.example.com');
    localStorage.setItem('gpt_optimizer_api_key', 'test-key');
    vi.mocked(PromptOptimizerService.fetchModels).mockRejectedValueOnce(new Error('模型获取失败，请重试'));
    const app = await mountModal('optimizer');
    try {
      (container.querySelector('.combobox-refresh') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toContain('模型获取失败'));
      const input = container.querySelector('.ui-combobox input') as HTMLInputElement;
      expect(input.disabled).toBe(false);
      input.value = 'manual-model';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      expect(input.value).toBe('manual-model');
    } finally {
      app.unmount();
    }
  });
  it('enables save for changes and explains incomplete image credentials', async () => {
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

    fill('接口地址', 'https://api.example.com');
    await nextTick();
    expect(saveBtn?.disabled).toBe(false);
    saveBtn?.click();
    await nextTick();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('请填写生图接口地址与 API Key');
    fill('API Key', 'sk-1');
    await nextTick();

    expect(saveBtn?.disabled).toBe(false);
    app.unmount();
  });

  it('renders general category and general settings with switch and download controls', async () => {
    const app = await mountModal('general');

    const navCategories = [...container.querySelectorAll('.nav-category')].map((el) => el.textContent?.trim());
    expect(navCategories).toContain('通用');

    const navLabels = [...container.querySelectorAll('.nav-label')].map((el) => el.textContent?.trim());
    expect(navLabels).toContain('通用设置');

    expect(container.textContent).toContain('开始生成后清空输入框');
    expect(container.textContent).toContain('下载文件名');
    expect(container.textContent).toContain('下载格式');

    const switchEl = container.querySelector('.ui-switch-wrapper');
    expect(switchEl).not.toBeNull();
    expect(switchEl?.getAttribute('role')).toBe('switch');
    expect(switchEl?.getAttribute('aria-label')).toBe('开始生成后清空输入框');

    app.unmount();
  });
});
