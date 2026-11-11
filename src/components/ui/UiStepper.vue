<script setup lang="ts">
import { computed, ref, type Component } from 'vue';
import { applyWheelStep, WHEEL_ADJUST_TIP } from '@/utils/wheelStep';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    tip?: string;
    disabled?: boolean;
    variant?: 'pill' | 'default';
    icon?: Component;
  }>(),
  {
    min: 1,
    max: 4,
    step: 1,
    label: '',
    tip: '',
    disabled: false,
    variant: 'pill'
  }
);

/** 胶囊与数值输入框共用同一提示：hover 标签文字、图标或空白区域时也能看到
 *  滚轮调整说明；批量模式传入 tip 时改为展示批次信息。 */
const stepperTip = computed(() => props.tip || WHEEL_ADJUST_TIP);

/** 数字框按取值范围的最大位数定宽（ch 为等宽字体的单字符宽度）。
 *  只依据 min/max，不随当前值变化，避免数值位数改变时胶囊宽度抖动。 */
const inputWidth = computed(() => {
  const digits = Math.max(
    String(Math.abs(props.min)).length,
    String(Math.abs(props.max)).length
  );
  return `calc(${Math.min(4, Math.max(2, digits))}ch + 2px)`;
});

const stepInputRef = ref<HTMLInputElement | null>(null);

/** 点击「数量 / 批量」标签时聚焦并选中数值，方便直接输入或滚轮调整。 */
function focusStepInput() {
  if (props.disabled) return;
  stepInputRef.value?.focus();
  stepInputRef.value?.select();
}

const emit = defineEmits<{
  (e: 'update:modelValue', val: number): void;
  (e: 'change', val: number): void;
}>();

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  let val = parseInt(target.value, 10);
  if (isNaN(val)) {
    val = props.min;
  } else {
    val = Math.max(props.min, Math.min(props.max, Math.round(val / props.step) * props.step));
  }
  target.value = String(val);
  emit('update:modelValue', val);
  emit('change', val);
}

function handleInputFocus(e: FocusEvent) {
  const target = e.target as HTMLInputElement;
  target?.select();
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    (e.target as HTMLInputElement)?.blur();
  }
}

function handleWheel(e: WheelEvent) {
  if (props.disabled) return;
  e.preventDefault();
  const next = applyWheelStep(props.modelValue / props.step, e, props.min / props.step, props.max / props.step) * props.step;
  if (next === props.modelValue) return;
  emit('update:modelValue', next);
  emit('change', next);
}
</script>

<template>
  <div 
    class="ui-stepper" 
    :class="[`variant-${variant}`, { 'is-disabled': disabled, 'has-icon': Boolean(icon) }]"
  >
    <label class="stepper-controls" :data-tip="stepperTip" @wheel.prevent="handleWheel">
      <component
        v-if="icon"
        :is="icon"
        class="stepper-icon"
        :size="13"
        aria-hidden="true"
      />
      <span v-if="label" class="stepper-label" @click="focusStepInput">{{ label }}</span>

      <input 
        type="number" 
        :min="min"
        :max="max"
        :step="step"
        :value="modelValue" 
        :disabled="disabled"
        name="stepper-count"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        ref="stepInputRef"
        class="step-input"
        :style="{ width: inputWidth }"
        :data-tip="stepperTip"
        @focus="handleInputFocus"
        @keydown="handleKeyDown"
        @change="handleInputChange"
      />
    </label>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-stepper {
  display: inline-flex;
  align-items: center;
  user-select: none;
  font-family: $font-main;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.stepper-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: text;
  background: $bg-surface;
  border: 1px solid $border-color;
  box-shadow: $shadow-xs;
  border-radius: 9999px;
  padding: 3px 8px 3px 10px;
  min-height: 28px;
  box-sizing: border-box;
  line-height: normal;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: $accent-border;
    box-shadow: 0 2px 6px $accent-soft;
  }

  &:focus-within {
    background: $bg-surface;
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px $accent-soft;

    &:hover {
      border-color: $accent-primary;
      box-shadow: 0 0 0 3px $accent-soft;
    }
  }
}

.stepper-icon {
  display: none;
  flex-shrink: 0;
  color: $text-muted;
}

.stepper-label {
  font-size: 0.72rem;
  color: $text-muted;
  font-weight: 500;
  margin-right: 2px;
  cursor: pointer;

  .is-disabled & {
    cursor: not-allowed;
  }
}

@media (max-width: 640px) {
  .ui-stepper.has-icon {
    .stepper-icon {
      display: block;
    }

    .stepper-label {
      display: none;
    }
  }
}

.step-input {
  width: calc(3ch + 2px);
  height: 18px;
  box-sizing: border-box;
  background: transparent;
  border: none;
  font-family: $font-mono;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: $text-main;
  text-align: center;
  outline: none;
  padding: 0;
  margin: 0;
  -moz-appearance: textfield;
  appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}
</style>
