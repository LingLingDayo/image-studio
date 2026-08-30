<script setup lang="ts">
import { computed } from 'vue';
import { Minus, Plus } from 'lucide-vue-next';
import { applyWheelStep, WHEEL_ADJUST_TIP } from '@/utils/wheelStep';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    disabled?: boolean;
    variant?: 'pill' | 'default';
  }>(),
  {
    min: 1,
    max: 4,
    step: 1,
    label: '',
    disabled: false,
    variant: 'pill'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: number): void;
  (e: 'change', val: number): void;
}>();

const canDecrease = computed(() => !props.disabled && props.modelValue > props.min);
const canIncrease = computed(() => !props.disabled && props.modelValue < props.max);

function handleDecrease() {
  if (!canDecrease.value) return;
  const newVal = Math.max(props.min, props.modelValue - props.step);
  emit('update:modelValue', newVal);
  emit('change', newVal);
}

function handleIncrease() {
  if (!canIncrease.value) return;
  const newVal = Math.min(props.max, props.modelValue + props.step);
  emit('update:modelValue', newVal);
  emit('change', newVal);
}

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  let val = parseInt(target.value, 10);
  if (isNaN(val)) {
    val = props.min;
  } else {
    val = Math.max(props.min, Math.min(props.max, val));
  }
  emit('update:modelValue', val);
  emit('change', val);
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
    :class="[`variant-${variant}`, { 'is-disabled': disabled }]"
  >
    <div class="stepper-controls" @wheel.prevent="handleWheel">
      <span v-if="label" class="stepper-label">{{ label }}</span>

      <button 
        type="button" 
        class="step-btn step-minus" 
        :disabled="!canDecrease"
        data-tip="减少"
        @click="handleDecrease"
      >
        <Minus :size="11" />
      </button>

      <input 
        type="text" 
        inputmode="numeric" 
        pattern="[0-9]*"
        :value="modelValue" 
        :disabled="disabled"
        class="step-input"
        :data-tip="WHEEL_ADJUST_TIP"
        @change="handleInputChange"
      />

      <button 
        type="button" 
        class="step-btn step-plus" 
        :disabled="!canIncrease"
        data-tip="增加"
        @click="handleIncrease"
      >
        <Plus :size="11" />
      </button>
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
  padding: 3px 6px 3px 10px;
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

.stepper-label {
  font-size: 0.72rem;
  color: $text-muted;
  font-weight: 500;
  margin-right: 2px;
}

.step-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.12s ease;
  padding: 0;

  &:hover:not(:disabled) {
    background: $accent-subtle;
    color: $accent-primary;
    transform: scale(1.1);
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.step-input {
  width: 18px;
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
}
</style>
