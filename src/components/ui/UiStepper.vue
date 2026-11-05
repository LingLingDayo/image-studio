<script setup lang="ts">
import { computed, type Component } from 'vue';
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

const controlTip = computed(() => props.tip || undefined);
const valueTip = computed(() => props.tip || WHEEL_ADJUST_TIP);

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
    val = Math.max(props.min, Math.min(props.max, val));
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
  const next = applyWheelStep(props.modelValue, e, props.min, props.max);
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
    <div class="stepper-controls" :data-tip="controlTip" @wheel.prevent="handleWheel">
      <component
        v-if="icon"
        :is="icon"
        class="stepper-icon"
        :size="13"
        aria-hidden="true"
      />
      <span v-if="label" class="stepper-label">{{ label }}</span>

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
        class="step-input"
        :data-tip="valueTip"
        @focus="handleInputFocus"
        @keydown="handleKeyDown"
        @change="handleInputChange"
      />
    </div>
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
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  border-radius: 9999px;
  padding: 3px 8px 3px 10px;
  height: 26px;
  box-sizing: border-box;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
    transform: translateY(-0.5px);
  }

  &:focus-within {
    background: #ffffff;
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
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
  width: 20px;
  height: 18px;
  background: transparent;
  border: none;
  font-family: $font-mono;
  font-size: 0.75rem;
  font-weight: 600;
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
