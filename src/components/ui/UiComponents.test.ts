import { describe, it, expect } from 'vitest';
import UiSelect from './UiSelect.vue';
import UiStepper from './UiStepper.vue';
import UiInput from './UiInput.vue';
import UiSwitch from './UiSwitch.vue';
import UiButton from './UiButton.vue';
import UiPagination from './UiPagination.vue';
import UiSizeInput from './UiSizeInput.vue';
import Tooltip from './Tooltip.vue';

describe('UI Components (src/components/ui)', () => {
  it('should export all UI components properly', () => {
    expect(UiSelect).toBeDefined();
    expect(UiStepper).toBeDefined();
    expect(UiInput).toBeDefined();
    expect(UiSwitch).toBeDefined();
    expect(UiButton).toBeDefined();
    expect(UiPagination).toBeDefined();
    expect(UiSizeInput).toBeDefined();
    expect(Tooltip).toBeDefined();
  });
});

