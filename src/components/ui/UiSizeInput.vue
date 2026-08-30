<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';
import { applyWheelStep, WHEEL_ADJUST_TIP } from '@/utils/wheelStep';

const props = withDefaults(
  defineProps<{
    width: number | null;
    height: number | null;
    label?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
  }>(),
  {
    label: '尺寸',
    disabled: false,
    min: 1,
    max: 8192
  }
);

const emit = defineEmits<{
  (e: 'update:width', val: number | null): void;
  (e: 'update:height', val: number | null): void;
  (e: 'clear'): void;
  (e: 'materialize'): void;
}>();

const widthTip = `宽度\n${WHEEL_ADJUST_TIP}`;
const heightTip = `高度\n${WHEEL_ADJUST_TIP}`;

const widthInputRef = ref<HTMLInputElement | null>(null);
const shouldFocusWidth = ref(false);

const isAuto = computed(() => props.width == null && props.height == null);

watch(
  () => [props.width, props.height] as const,
  ([width]) => {
    if (shouldFocusWidth.value && width != null) {
      shouldFocusWidth.value = false;
      nextTick(() => widthInputRef.value?.focus());
    }
  }
);

function parseDim(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
}

function handleWidthChange(e: Event) {
  const parsed = parseDim((e.target as HTMLInputElement).value);
  if (parsed == null) {
    emit('clear');
    return;
  }
  emit('update:width', parsed);
}

function handleHeightChange(e: Event) {
  const parsed = parseDim((e.target as HTMLInputElement).value);
  if (parsed == null) {
    emit('clear');
    return;
  }
  emit('update:height', parsed);
}

function handleMaterialize() {
  if (props.disabled) return;
  shouldFocusWidth.value = true;
  emit('materialize');
}

function handleDimWheel(dim: 'width' | 'height', e: WheelEvent) {
  if (props.disabled) return;
  e.preventDefault();
  const current = dim === 'width' ? props.width : props.height;
  if (current == null) return;
  const next = applyWheelStep(current, e, props.min, props.max);
  if (next === current) return;
  if (dim === 'width') {
    emit('update:width', next);
  } else {
    emit('update:height', next);
  }
}
</script>

<template>
  <div
    class="ui-size-input"
    :class="{ 'is-disabled': disabled, 'is-auto': isAuto }"
  >
    <div class="size-controls">
      <span v-if="label" class="size-label">{{ label }}</span>

      <button
        v-if="isAuto"
        type="button"
        class="auto-value"
        :disabled="disabled"
        data-tip="设置具体宽高"
        @click="handleMaterialize"
      >
        自动
      </button>

      <template v-else>
        <input
          ref="widthInputRef"
          type="text"
          inputmode="numeric"
          class="dim-input"
          :value="width ?? ''"
          :disabled="disabled"
          :data-tip="widthTip"
          @change="handleWidthChange"
          @wheel.prevent="handleDimWheel('width', $event)"
        />
        <span class="times">×</span>
        <input
          type="text"
          inputmode="numeric"
          class="dim-input"
          :value="height ?? ''"
          :disabled="disabled"
          :data-tip="heightTip"
          @change="handleHeightChange"
          @wheel.prevent="handleDimWheel('height', $event)"
        />
        <button
          type="button"
          class="reset-btn"
          :disabled="disabled"
          data-tip="设为自动"
          @click="emit('clear')"
        >
          <X :size="11" />
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-size-input {
  display: inline-flex;
  align-items: center;
  user-select: none;
  font-family: $font-main;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.size-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  border-radius: 9999px;
  padding: 3px 8px 3px 10px;
  min-height: 28px;
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

.size-label {
  font-size: 0.72rem;
  color: $text-muted;
  font-weight: 500;
  margin-right: 2px;
}

.auto-value {
  background: transparent;
  border: none;
  padding: 0 4px;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  color: $text-main;
  cursor: pointer;
  line-height: 1;
}

.dim-input {
  width: 44px;
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

.times {
  font-size: 0.7rem;
  color: $text-dim;
  font-weight: 600;
  line-height: 1;
}

.reset-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: $text-dim;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  margin-left: 1px;
  transition: all 0.12s ease;

  &:hover:not(:disabled) {
    background: $accent-subtle;
    color: $accent-primary;
  }
}
</style>
