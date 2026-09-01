import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
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
});


