import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, type App } from 'vue';
import UiInput from './UiInput.vue';

describe('UiInput 无障碍关联', () => {
  let container: HTMLDivElement;
  let app: App;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => {
    app.unmount();
    container.remove();
  });

  it('将设置字段标签和说明关联到真实输入框', () => {
    app = createApp(() => h(UiInput, {
      id: 'image.apiKey', modelValue: '', label: 'API Key', hint: '个人令牌', required: true
    }));
    app.mount(container);
    const input = container.querySelector('input')!;
    expect(input.id).toBe('image.apiKey');
    expect(container.querySelector('label')?.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toBe('image.apiKey-hint');
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('密码显隐按钮提供操作名称，并跟随输入框禁用', () => {
    app = createApp(() => h(UiInput, { modelValue: 'secret', type: 'password', disabled: true }));
    app.mount(container);
    const toggle = container.querySelector('button')!;
    expect(toggle.getAttribute('aria-label')).toBe('显示密码');
    expect(toggle.disabled).toBe(true);
  });
});
