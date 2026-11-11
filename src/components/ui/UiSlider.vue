<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useClickOutside } from '@/composables/useClickOutside';

const props = withDefaults(defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  tip?: string;
  disabled?: boolean;
  placement?: 'top' | 'bottom';
}>(), {
  min: 0, max: 100, step: 1, label: '', tip: '', disabled: false, placement: 'top'
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void;
  (event: 'change', value: number): void;
}>();
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);

function normalizeValue(value: number): number {
  const bounded = Number.isFinite(value) ? Math.max(props.min, Math.min(props.max, value)) : props.min;
  return Math.max(props.min, Math.min(props.max, props.min + Math.round((bounded - props.min) / props.step) * props.step));
}

const value = computed(() => normalizeValue(props.modelValue));
const progress = computed(() => props.max === props.min ? 0 : (value.value - props.min) / (props.max - props.min) * 100);

async function toggle() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    await nextTick();
    inputRef.value?.focus({ preventScroll: true });
  }
}

function closeWithFocus() {
  if (!isOpen.value) return;
  isOpen.value = false;
  triggerRef.value?.focus({ preventScroll: true });
}

function handleInput(event: Event) {
  if (props.disabled) return;
  emit('update:modelValue', normalizeValue((event.target as HTMLInputElement).valueAsNumber));
}

function handleChange(event: Event) {
  if (props.disabled) return;
  emit('change', normalizeValue((event.target as HTMLInputElement).valueAsNumber));
}

useClickOutside(rootRef, () => { isOpen.value = false; });
watch(() => props.disabled, (disabled) => { if (disabled) isOpen.value = false; });
</script>

<template>
  <div ref="rootRef" class="ui-slider" :class="{ 'is-open': isOpen }" @keydown.esc.stop="closeWithFocus">
    <button
      ref="triggerRef"
      type="button"
      class="slider-trigger"
      :disabled="disabled"
      :aria-label="`${label || '数值'} ${value}`"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-description="tip || undefined"
      :data-tip="tip || undefined"
      @click="toggle"
    >
      <span v-if="label" class="slider-label" :data-tip="tip || undefined">{{ label }}</span>
      <span class="slider-value">{{ value }}</span>
    </button>
    <div v-if="isOpen" class="slider-popover" :class="`placement-${placement}`" role="dialog" :aria-label="`${label || '数值'}调整`">
      <input
        ref="inputRef"
        class="slider-range"
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="value"
        :disabled="disabled"
        :aria-label="label || '数值'"
        :aria-description="tip || undefined"
        :style="{ '--slider-progress': `${progress}%` }"
        @input="handleInput"
        @change="handleChange"
      />
      <output class="slider-value">{{ value }}</output>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-slider {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  font-family: $font-main;
}

.slider-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 11px;
  border: 1px solid $border-color;
  border-radius: 9999px;
  background: $bg-surface;
  box-shadow: $shadow-xs;
  color: $text-secondary;
  font: inherit;
  font-size: 0.75rem;
  line-height: 1.25;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: $accent-border;
    box-shadow: 0 2px 6px $accent-soft;
  }
  &:focus-visible, .is-open & {
    outline: none;
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px $accent-soft;

    &:hover {
      border-color: $accent-primary;
      box-shadow: 0 0 0 3px $accent-soft;
    }
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.slider-label { white-space: nowrap; }
.slider-value { min-width: 3ch; color: $text-main; font-family: $font-mono; font-size: 0.75rem; text-align: right; font-variant-numeric: tabular-nums; }

.slider-popover {
  position: absolute;
  left: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 180px;
  padding: 12px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-surface;
  box-shadow: $shadow-float;

  &.placement-top { bottom: calc(100% + 6px); }
  &.placement-bottom { top: calc(100% + 6px); }
}

.slider-range {
  appearance: none;
  flex: 1;
  min-width: 0;
  height: 20px;
  margin: 0;
  background: linear-gradient(to right, $accent-primary var(--slider-progress), $border-strong var(--slider-progress)) center / 100% 4px no-repeat;
  cursor: pointer;

  &:focus-visible { outline: 2px solid $accent-border; outline-offset: 4px; border-radius: 4px; }
  &::-webkit-slider-runnable-track { height: 4px; }
  &::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; margin-top: -4px; border: 2px solid $bg-surface; border-radius: 50%; background: $accent-primary; box-shadow: $shadow-xs; }
  &::-moz-range-track { height: 4px; background: transparent; }
  &::-moz-range-thumb { width: 12px; height: 12px; box-sizing: border-box; border: 2px solid $bg-surface; border-radius: 50%; background: $accent-primary; box-shadow: $shadow-xs; }
}
</style>
