import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import UiCombobox from './UiCombobox.vue';

describe('UiCombobox', () => {
  let container: HTMLDivElement;
  let app: App | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    app?.unmount();
    app = undefined;
    container.remove();
    vi.restoreAllMocks();
  });

  async function mount(options: Array<string | { label: string; value: string; disabled?: boolean }> = ['model-a', 'model-b'], initial = '') {
    const value = ref(initial);
    const disabled = ref(false);
    const changed = vi.fn();
    app = createApp(() => h(UiCombobox, {
      modelValue: value.value,
      options,
      label: '优化模型',
      id: 'optimizer-model',
      disabled: disabled.value,
      'onUpdate:modelValue': (next: string) => { value.value = next; },
      onChange: changed
    }));
    app.mount(container);
    await nextTick();
    return { value, disabled, changed };
  }

  function input(): HTMLInputElement {
    return container.querySelector('input')!;
  }

  async function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
  }

  async function key(value: string) {
    const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    await nextTick();
    return event;
  }

  async function toggle() {
    (container.querySelector('.combobox-toggle') as HTMLButtonElement).click();
    await nextTick();
  }

  function optionLabels(): string[] {
    return [...container.querySelectorAll('[role="option"]')].map((element) => element.textContent?.trim() || '');
  }

  it('始终支持自定义输入，输入时筛选已有选项但不会自动选择', async () => {
    const { value, changed } = await mount(['model-a', 'model-b']);
    await type('custom-model');
    expect(value.value).toBe('custom-model');
    expect(changed).toHaveBeenCalledWith('custom-model');
    expect(container.querySelector('.combobox-empty')?.textContent).toContain('可直接输入');
    await key('Enter');
    expect(value.value).toBe('custom-model');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    await type('MODEL-A');
    expect(optionLabels()).toEqual(['model-a']);
    expect(value.value).toBe('MODEL-A');
  });

  it('下拉箭头展开全部选项，不被当前值或上次输入过滤', async () => {
    await mount(['model-a', 'model-b'], 'model-a');
    await toggle();
    expect(optionLabels()).toEqual(['model-a', 'model-b']);
    await type('model-b');
    expect(optionLabels()).toEqual(['model-b']);
    await toggle();
    await toggle();
    expect(optionLabels()).toEqual(['model-a', 'model-b']);
  });

  it('选中已有选项更新值、发出change并关闭下拉', async () => {
    const { value, changed } = await mount();
    await toggle();
    (container.querySelectorAll('[role="option"]')[1] as HTMLElement).click();
    await nextTick();
    expect(value.value).toBe('model-b');
    expect(input().value).toBe('model-b');
    expect(changed).toHaveBeenCalledWith('model-b');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('键盘上下导航跳过禁用项，Enter选择高亮项并关联ARIA状态', async () => {
    const { value } = await mount([
      { label: '不可选择', value: 'disabled', disabled: true },
      'model-a', 'model-b'
    ]);
    await key('ArrowDown');
    expect(input().getAttribute('aria-expanded')).toBe('true');
    const activeId = input().getAttribute('aria-activedescendant');
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)?.textContent?.trim()).toBe('model-a');
    await key('ArrowDown');
    await key('Enter');
    expect(value.value).toBe('model-b');
    await key('ArrowUp');
    await key('ArrowUp');
    await key('Enter');
    expect(value.value).toBe('model-a');
  });

  it('Escape只关闭已展开的列表，不传播到外层弹窗', async () => {
    await mount();
    const parentHandler = vi.fn();
    container.addEventListener('keydown', parentHandler);
    await toggle();
    const event = await key('Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(parentHandler).not.toHaveBeenCalled();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    await key('Escape');
    expect(parentHandler).toHaveBeenCalledOnce();
  });

  it('点击外部与Tab关闭列表，Tab不会被阻止', async () => {
    await mount();
    await toggle();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    await toggle();
    const event = await key('Tab');
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('父级更新值会同步输入，禁用后关闭列表并禁用控件', async () => {
    const { value, disabled } = await mount();
    value.value = 'external-model';
    await nextTick();
    expect(input().value).toBe('external-model');
    await toggle();
    disabled.value = true;
    await nextTick();
    expect(input().disabled).toBe(true);
    expect((container.querySelector('.combobox-toggle') as HTMLButtonElement).disabled).toBe(true);
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('label')?.htmlFor).toBe(input().id);
    expect(input().getAttribute('role')).toBe('combobox');
  });

  it('刷新操作插槽位于下拉按钮左侧且不会触发值变化', async () => {
    const updated = vi.fn();
    const changed = vi.fn();
    const refresh = vi.fn();
    app = createApp(() => h(UiCombobox, {
      modelValue: 'custom', options: ['model-a'],
      'onUpdate:modelValue': updated, onChange: changed
    }, {
      actions: () => h('button', { class: 'refresh-models', type: 'button', onClick: refresh }, '刷新')
    }));
    app.mount(container);
    await nextTick();
    const actions = container.querySelector('.combobox-actions')!;
    expect([...actions.children].map((element) => element.className)).toEqual(['refresh-models', 'combobox-toggle']);
    (container.querySelector('.refresh-models') as HTMLButtonElement).click();
    expect(refresh).toHaveBeenCalledOnce();
    expect(updated).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(container.querySelector('button button')).toBeNull();
  });

  it('下方空间不足时在上方展开列表', async () => {
    await mount();
    const control = container.querySelector('.combobox-control') as HTMLElement;
    vi.spyOn(control, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 700, top: 700, left: 0, right: 300, bottom: 738, width: 300, height: 38, toJSON: () => ({})
    });
    await toggle();
    expect(container.querySelector('.combobox-dropdown')?.classList.contains('placement-top')).toBe(true);
  });
});
