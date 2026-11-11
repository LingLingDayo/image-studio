<script setup lang="ts">
import { computed, nextTick, ref, watch, type Component } from 'vue';
import { X } from '@lucide/vue';
import { applyWheelStep, WHEEL_ADJUST_TIP } from '@/utils/wheelStep';

const props = withDefaults(
  defineProps<{
    width: number | null;
    height: number | null;
    label?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    icon?: Component;
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
      nextTick(() => {
        widthInputRef.value?.focus();
        widthInputRef.value?.select();
      });
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

function handleInputFocus(e: FocusEvent) {
  (e.target as HTMLInputElement)?.select();
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    (e.target as HTMLInputElement)?.blur();
  }
}

function handleMaterialize() {
  if (props.disabled) return;
  shouldFocusWidth.value = true;
  emit('materialize');
}

/** 编辑态点击「尺寸」标签时聚焦宽度输入框，与数量控件的交互保持一致。 */
function focusWidthInput() {
  if (props.disabled) return;
  widthInputRef.value?.focus();
  widthInputRef.value?.select();
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
    :class="{ 'is-disabled': disabled, 'is-auto': isAuto, 'has-icon': Boolean(icon) }"
  >
    <!-- 自动状态：整个胶囊按钮均可点击，点击任何位置均触发自定义宽高编辑 -->
    <button
      v-if="isAuto"
      type="button"
      class="size-controls size-auto-trigger"
      :disabled="disabled"
      data-tip="设置具体宽高"
      @click="handleMaterialize"
    >
      <component
        v-if="icon"
        :is="icon"
        class="size-icon"
        :size="13"
        aria-hidden="true"
      />
      <span v-if="label" class="size-label">{{ label }}</span>
      <span class="auto-value">自动</span>
    </button>

    <!-- 具体尺寸编辑状态：提供宽度、高度数字输入与设为自动清除按钮 -->
    <div v-else class="size-controls is-editing" :data-tip="WHEEL_ADJUST_TIP">
      <component
        v-if="icon"
        :is="icon"
        class="size-icon"
        :size="13"
        aria-hidden="true"
      />
      <span v-if="label" class="size-label" @click="focusWidthInput">{{ label }}</span>

      <input
        ref="widthInputRef"
        type="number"
        :min="min"
        :max="max"
        class="dim-input"
        :value="width ?? ''"
        :disabled="disabled"
        :data-tip="widthTip"
        name="size-width"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        @focus="handleInputFocus"
        @keydown="handleKeyDown"
        @change="handleWidthChange"
        @wheel.prevent="handleDimWheel('width', $event)"
      />
      <span class="times">×</span>
      <input
        type="number"
        :min="min"
        :max="max"
        class="dim-input"
        :value="height ?? ''"
        :disabled="disabled"
        :data-tip="heightTip"
        name="size-height"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        @focus="handleInputFocus"
        @keydown="handleKeyDown"
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
  background: $bg-surface;
  border: 1px solid $border-color;
  box-shadow: $shadow-xs;
  border-radius: 9999px;
  padding: 3px 8px 3px 10px;
  min-height: 28px;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  color: inherit;
  line-height: 1;

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

/* data-tip 会带来 help 光标，编辑态胶囊整体仍应保持可输入的文本光标 */
.size-controls.is-editing {
  cursor: text;
}

.size-auto-trigger {
  padding: 3px 10px;
  cursor: pointer;
  outline: none;
  text-align: left;

  &:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  &:focus-visible {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px $accent-soft;

    &:hover {
      border-color: $accent-primary;
      box-shadow: 0 0 0 3px $accent-soft;
    }
  }
}

.size-icon {
  display: none;
  flex-shrink: 0;
  color: $text-muted;
}

.size-label {
  font-size: 0.72rem;
  color: $text-muted;
  font-weight: 500;
  margin-right: 2px;
  cursor: pointer;

  &:hover {
    color: $text-main;
  }

  .is-disabled & {
    cursor: not-allowed;
  }
}

@media (max-width: 640px) {
  .ui-size-input.has-icon {
    .size-icon {
      display: block;
    }

    .size-label {
      display: none;
    }
  }
}

.auto-value {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  color: $text-main;
  line-height: 1.25;
}

.dim-input {
  width: 34px;
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
