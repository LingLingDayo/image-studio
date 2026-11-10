import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import UiSlider from './UiSlider.vue';
import { UiSlider as ExportedUiSlider } from './index';

describe('UiSlider 紧凑滑动条', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp> | undefined;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => { app?.unmount(); container.remove(); });

  it('默认只显示紧凑按钮，点击后显示步长 1 滑动条并聚焦', async () => {
    expect(ExportedUiSlider).toBe(UiSlider);
    const onUpdate = vi.fn();
    app = createApp(() => h(UiSlider, { modelValue: 100, label: '压缩', tip: '100 不代表压缩掉 100%', 'onUpdate:modelValue': onUpdate }));
    app.mount(container);
    const button = container.querySelector('button')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector<HTMLElement>('.slider-label')!.dataset.tip).toContain('不代表压缩掉 100%');
    button.click();
    await nextTick();
    const input = container.querySelector('input')!;
    expect(input.type).toBe('range');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
    expect(input.step).toBe('1');
    expect(input.getAttribute('aria-label')).toBe('压缩');
    expect(document.activeElement).toBe(input);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('拖动实时更新整数值，包括 0 与 100，不丢失零值', async () => {
    const value = ref(100);
    const onChange = vi.fn();
    app = createApp(() => h(UiSlider, { modelValue: value.value, label: '压缩', onChange,
      'onUpdate:modelValue': (next: number) => { value.value = next; } }));
    app.mount(container);
    container.querySelector('button')!.click();
    await nextTick();
    const input = container.querySelector('input')!;
    for (const next of [67, 0, 100]) {
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      expect(value.value).toBe(next);
      expect(container.querySelector('output')!.textContent).toBe(String(next));
      expect(input.style.getPropertyValue('--slider-progress')).toBe(`${next}%`);
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('外部复用参数时数值和滑动条同步更新，不产生额外提交', async () => {
    const value = ref(25);
    const onUpdate = vi.fn();
    app = createApp(() => h(UiSlider, { modelValue: value.value, 'onUpdate:modelValue': onUpdate }));
    app.mount(container);
    container.querySelector('button')!.click();
    await nextTick();
    value.value = 73;
    await nextTick();
    expect(container.querySelector('input')!.value).toBe('73');
    expect(container.querySelector('.slider-value')!.textContent).toBe('73');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('点击外部关闭，Escape 关闭并将焦点交还按钮', async () => {
    app = createApp(() => h(UiSlider, { modelValue: 50, label: '压缩' }));
    app.mount(container);
    const button = container.querySelector('button')!;
    button.click();
    await nextTick();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    button.click();
    await nextTick();
    container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(container.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('按传入范围设置滑动条，禁用时关闭且不可再次打开', async () => {
    const disabled = ref(false);
    const onUpdate = vi.fn();
    app = createApp(() => h(UiSlider, { modelValue: 15, min: 10, max: 20, step: 1, disabled: disabled.value, 'onUpdate:modelValue': onUpdate }));
    app.mount(container);
    const button = container.querySelector('button')!;
    button.click();
    await nextTick();
    const input = container.querySelector('input')!;
    expect(input.min).toBe('10');
    expect(input.max).toBe('20');
    expect(input.style.getPropertyValue('--slider-progress')).toBe('50%');
    disabled.value = true;
    await nextTick();
    expect(button.disabled).toBe(true);
    expect(container.querySelector('input')).toBeNull();
    button.click();
    await nextTick();
    expect(container.querySelector('input')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
