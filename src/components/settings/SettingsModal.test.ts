import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SettingsModal from './SettingsModal.vue';
import SettingsPane from './SettingsPane.vue';
import { useConfigStore } from '@/stores/configStore';
import { useSettingsSession } from '@/composables/useSettingsSession';
import { imageSection } from '@/settings/image.section';
import { SETTING_KEYS } from '@/settings/keys';

vi.mock('@/types/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/types/config')>();
  return {
    ...actual,
    ENV_BASE_URL: '',
    ENV_API_KEY: '',
    ENV_OPTIMIZER_BASE_URL: '',
    ENV_OPTIMIZER_API_KEY: '',
    DEFAULT_CONFIG: { baseUrl: '', apiKey: '', model: 'gpt-image-2' },
    DEFAULT_OPTIMIZER_CONFIG: { baseUrl: '', apiKey: '', model: '', endpoint: '/v1/chat/completions' }
  };
});

describe('设置保存与退出', () => {
  let container: HTMLDivElement;
  let app: App | undefined;
  let launcher: HTMLButtonElement | undefined;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    app?.unmount();
    app = undefined;
    container.remove();
    launcher?.remove();
    launcher = undefined;
    document.body.style.overflow = '';
  });

  async function mount(initialTab = 'image') {
    const isOpen = ref(true);
    const saved = vi.fn();
    const closed = vi.fn(() => { isOpen.value = false; });
    app = createApp(() => h(SettingsModal, {
      isOpen: isOpen.value,
      initialTab,
      onSaved: saved,
      onClose: closed
    }));
    app.use(createPinia());
    app.mount(container);
    await nextTick();
    return { isOpen, saved, closed };
  }

  function button(text: string): HTMLButtonElement {
    const result = [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);
    expect(result).toBeDefined();
    return result!;
  }

  function fill(label: string, value: string) {
    const fieldLabel = [...container.querySelectorAll('.input-label')].find((item) => item.textContent?.includes(label));
    const input = fieldLabel?.parentElement?.querySelector('input');
    expect(input).toBeDefined();
    input!.value = value;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('未配置生图接口也能独立保存通用偏好', async () => {
    const events = await mount('general');
    const store = useConfigStore();
    (container.querySelector('[role="switch"]') as HTMLElement).click();
    await nextTick();
    button('保存设置').click();
    await nextTick();
    expect(events.saved).toHaveBeenCalledOnce();
    expect(events.closed).toHaveBeenCalledOnce();
    expect(store.clearPromptOnGenerate).toBe(true);
    expect(localStorage.getItem('gpt_image_api_key')).toBeNull();
    expect(localStorage.getItem('gpt_optimizer_endpoint')).toBeNull();
  });

  it('保存无效地址时显示原因，不关闭或写入配置', async () => {
    const events = await mount();
    fill('接口地址', 'api.example.com');
    fill('API Key', 'sk-test');
    await nextTick();
    button('保存设置').click();
    await nextTick();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('http:// 或 https://');
    expect(events.closed).not.toHaveBeenCalled();
    expect(events.saved).not.toHaveBeenCalled();
    expect(localStorage.getItem('gpt_image_base_url')).toBeNull();
  });

  it('关闭有修改的设置需确认，继续编辑保留草稿，放弃不写入', async () => {
    const events = await mount();
    fill('接口地址', 'https://api.example.com');
    await nextTick();
    button('关闭').click();
    await nextTick();
    expect(events.closed).not.toHaveBeenCalled();
    expect(container.textContent).toContain('放弃未保存的修改？');
    button('继续编辑').click();
    await nextTick();
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('https://api.example.com');
    button('关闭').click();
    await nextTick();
    button('放弃修改').click();
    await nextTick();
    expect(events.closed).toHaveBeenCalledOnce();
    expect(localStorage.getItem('gpt_image_base_url')).toBeNull();
  });

  it('Escape 先关闭下拉，第二次才关闭设置，并恢复焦点和页面滚动', async () => {
    launcher = document.createElement('button');
    document.body.appendChild(launcher);
    launcher.focus();
    document.body.style.overflow = 'auto';
    const events = await mount('general');
    const trigger = container.querySelector('.select-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await nextTick();
    expect(events.closed).not.toHaveBeenCalled();
    expect(container.querySelector('[role="combobox"]')?.getAttribute('aria-expanded')).toBe('false');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await nextTick();
    expect(events.closed).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(launcher);
    document.body.style.overflow = '';
  });

  it('Tab 和 Shift+Tab 不会跳出设置，导航保留可读标签与选中状态', async () => {
    await mount();
    expect(container.querySelector('.nav-item[aria-current="page"]')?.getAttribute('aria-label')).toBe('生图服务');
    const close = container.querySelector('.btn-close') as HTMLButtonElement;
    const last = button('关闭');
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
  });

  it('部署锁定的凭据给出说明，但不渲染密钥', async () => {
    const session = useSettingsSession();
    session.values[SETTING_KEYS.imageBaseUrl] = 'https://preset.example.com';
    session.values[SETTING_KEYS.imageApiKey] = 'private-preset-key';
    session.locks[SETTING_KEYS.imageBaseUrl] = true;
    session.locks[SETTING_KEYS.imageApiKey] = true;
    app = createApp(() => h(SettingsPane, { section: imageSection, session }));
    app.mount(container);
    await nextTick();
    expect(container.textContent).toContain('部署预设');
    expect(container.querySelector('[id="image.baseUrl"]')).toBeNull();
    expect(container.querySelector('[id="image.apiKey"]')).toBeNull();
    expect(container.textContent).not.toContain('private-preset-key');
  });
});
