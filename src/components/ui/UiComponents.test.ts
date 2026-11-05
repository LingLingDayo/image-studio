import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { Cpu, Scaling } from '@lucide/vue';
import UiSelect from './UiSelect.vue';
import UiStepper from './UiStepper.vue';
import UiInput from './UiInput.vue';
import UiSwitch from './UiSwitch.vue';
import UiButton from './UiButton.vue';
import UiPagination from './UiPagination.vue';
import UiSizeInput from './UiSizeInput.vue';
import Tooltip from './Tooltip.vue';
import UiDialog from './UiDialog.vue';

describe('UI Components (src/components/ui)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should export all UI components properly', () => {
    expect(UiSelect).toBeDefined();
    expect(UiStepper).toBeDefined();
    expect(UiInput).toBeDefined();
    expect(UiSwitch).toBeDefined();
    expect(UiButton).toBeDefined();
    expect(UiPagination).toBeDefined();
    expect(UiSizeInput).toBeDefined();
    expect(Tooltip).toBeDefined();
    expect(UiDialog).toBeDefined();
  });

  it('should render UiSelect with full label and value in standard mode', async () => {
    const selected = ref('1024x1024');
    const app = createApp({
      render() {
        return h(UiSelect, {
          modelValue: selected.value,
          label: '分辨率',
          variant: 'default',
          options: [
            { label: '1024x1024', value: '1024x1024' },
            { label: '512x512', value: '512x512' }
          ],
          'onUpdate:modelValue': (val: string) => {
            selected.value = val;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const trigger = container.querySelector('.select-trigger');
    expect(trigger).not.toBeNull();
    expect(container.querySelector('.select-label')?.textContent).toContain('分辨率');
    expect(container.querySelector('.select-value')?.textContent).toContain('1024x1024');
    expect(container.querySelector('.select-arrow')).not.toBeNull();
    expect(trigger?.getAttribute('data-tip')).toBe('分辨率: 1024x1024');

    app.unmount();
  });

  it('should hide arrow by default in pill variant and honor showArrow prop', async () => {
    const app = createApp({
      render() {
        return h('div', [
          h(UiSelect, {
            modelValue: '1',
            variant: 'pill',
            options: [{ label: 'Pill Default', value: '1' }]
          }),
          h(UiSelect, {
            modelValue: '2',
            variant: 'pill',
            showArrow: true,
            options: [{ label: 'Pill Force Arrow', value: '2' }]
          }),
          h(UiSelect, {
            modelValue: '3',
            variant: 'default',
            showArrow: false,
            options: [{ label: 'Default Hide Arrow', value: '3' }]
          })
        ]);
      }
    });

    app.mount(container);
    await nextTick();

    const selects = container.querySelectorAll('.ui-select');
    expect(selects[0].querySelector('.select-arrow')).toBeNull();
    expect(selects[1].querySelector('.select-arrow')).not.toBeNull();
    expect(selects[2].querySelector('.select-arrow')).toBeNull();

    app.unmount();
  });

  it('should emit open when UiSelect dropdown is opened', async () => {
    let opened = 0;
    const app = createApp({
      render() {
        return h(UiSelect, {
          modelValue: 'gpt-image-2',
          label: '模型',
          options: [
            { label: 'GPT-Image-2', value: 'gpt-image-2' },
            { label: 'GPT-Image-2.5 Flare', value: 'gpt-image-2.5-flare' }
          ],
          onOpen: () => {
            opened += 1;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const trigger = container.querySelector('.select-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    expect(opened).toBe(1);
    expect(container.querySelector('.select-dropdown')).not.toBeNull();

    app.unmount();
  });

  it('should render compact icon on UiSelect when icon is provided', async () => {
    const app = createApp({
      render() {
        return h(UiSelect, {
          modelValue: 'gpt-image-2',
          label: '模型',
          icon: Cpu,
          options: [{ label: 'GPT-Image-2', value: 'gpt-image-2' }]
        });
      }
    });

    app.mount(container);
    await nextTick();

    expect(container.querySelector('.ui-select')?.classList.contains('has-icon')).toBe(true);
    expect(container.querySelector('.select-icon')).not.toBeNull();

    app.unmount();
  });

  it('should truncate long labels when maxWidth is set and expose full name via tooltip', async () => {
    const app = createApp({
      render() {
        return h(UiSelect, {
          modelValue: 'gpt-image-2.5-flare',
          label: '模型',
          maxWidth: 150,
          options: [{ label: 'GPT-Image-2.5 Flare Extra Long', value: 'gpt-image-2.5-flare' }]
        });
      }
    });

    app.mount(container);
    await nextTick();

    const root = container.querySelector('.ui-select') as HTMLElement;
    const trigger = container.querySelector('.select-trigger') as HTMLButtonElement;
    expect(root.classList.contains('is-truncated')).toBe(true);
    expect(root.style.maxWidth).toBe('150px');
    expect(container.querySelector('.select-value')?.textContent).toContain('GPT-Image-2.5 Flare Extra Long');
    expect(trigger.getAttribute('data-tip')).toBe('模型: GPT-Image-2.5 Flare Extra Long');

    app.unmount();
  });

  it('should render and toggle UiSwitch correctly', async () => {
    const checked = ref(false);
    const app = createApp({
      render() {
        return h(UiSwitch, {
          modelValue: checked.value,
          label: '测试开关',
          'onUpdate:modelValue': (val: boolean) => {
            checked.value = val;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const switchEl = container.querySelector('.ui-switch-wrapper') as HTMLElement;
    expect(switchEl).not.toBeNull();
    expect(switchEl.getAttribute('role')).toBe('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('false');
    expect(container.textContent).toContain('测试开关');

    switchEl.click();
    await nextTick();
    expect(checked.value).toBe(true);

    app.unmount();
  });

  it('should render UiStepper label and optional tip', async () => {
    const app = createApp({
      render() {
        return h(UiStepper, {
          modelValue: 2,
          label: '批量',
          tip: '当前 2 个批次，每批生成 2 张，共 4 张',
          min: 1,
          max: 4
        });
      }
    });

    app.mount(container);
    await nextTick();

    expect(container.querySelector('.stepper-label')?.textContent).toBe('批量');
    expect(container.querySelector('.stepper-controls')?.getAttribute('data-tip')).toBe(
      '当前 2 个批次，每批生成 2 张，共 4 张'
    );
    expect(container.querySelector('.step-input')?.getAttribute('data-tip')).toBe(
      '当前 2 个批次，每批生成 2 张，共 4 张'
    );

    app.unmount();
  });

  it('should render UiSizeInput in auto mode as a unified clickable trigger button', async () => {
    let materialized = 0;
    const app = createApp({
      render() {
        return h(UiSizeInput, {
          width: null,
          height: null,
          label: '尺寸',
          icon: Scaling,
          onMaterialize: () => {
            materialized++;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const triggerBtn = container.querySelector('.size-auto-trigger') as HTMLButtonElement;
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn.tagName).toBe('BUTTON');
    expect(triggerBtn.getAttribute('data-tip')).toBe('设置具体宽高');

    const labelSpan = container.querySelector('.size-label') as HTMLSpanElement;
    expect(labelSpan).not.toBeNull();
    expect(labelSpan.textContent).toBe('尺寸');

    const autoSpan = container.querySelector('.auto-value') as HTMLSpanElement;
    expect(autoSpan).not.toBeNull();
    expect(autoSpan.textContent).toBe('自动');

    // 点击左侧标签文本，应能触发 materialize
    labelSpan.click();
    expect(materialized).toBe(1);

    // 点击右侧自动文本，应能触发 materialize
    autoSpan.click();
    expect(materialized).toBe(2);

    // 点击按钮容器任意空白位置，应能触发 materialize
    triggerBtn.click();
    expect(materialized).toBe(3);

    app.unmount();
  });

  it('should not emit materialize on UiSizeInput when disabled in auto mode', async () => {
    let materialized = 0;
    const app = createApp({
      render() {
        return h(UiSizeInput, {
          width: null,
          height: null,
          disabled: true,
          label: '尺寸',
          onMaterialize: () => {
            materialized++;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const triggerBtn = container.querySelector('.size-auto-trigger') as HTMLButtonElement;
    expect(triggerBtn.disabled).toBe(true);

    triggerBtn.click();
    expect(materialized).toBe(0);

    app.unmount();
  });

  it('should render concrete size inputs and clear to auto mode', async () => {
    const width = ref<number | null>(1024);
    const height = ref<number | null>(768);
    let cleared = false;

    const app = createApp({
      render() {
        return h(UiSizeInput, {
          width: width.value,
          height: height.value,
          label: '尺寸',
          onClear: () => {
            cleared = true;
            width.value = null;
            height.value = null;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    expect(container.querySelector('.size-auto-trigger')).toBeNull();
    const editingBox = container.querySelector('.size-controls.is-editing');
    expect(editingBox).not.toBeNull();

    const dimInputs = container.querySelectorAll('.dim-input') as NodeListOf<HTMLInputElement>;
    expect(dimInputs.length).toBe(2);
    expect(dimInputs[0].value).toBe('1024');
    expect(dimInputs[1].value).toBe('768');

    const resetBtn = container.querySelector('.reset-btn') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    resetBtn.click();

    expect(cleared).toBe(true);
    await nextTick();

    // 清除后应回到自动按钮模式
    expect(container.querySelector('.size-auto-trigger')).not.toBeNull();

    app.unmount();
  });
});


