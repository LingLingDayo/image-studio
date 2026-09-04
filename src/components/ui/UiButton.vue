<script setup lang="ts">
import { Loader2 } from '@lucide/vue';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost' | 'icon';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    block?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    block: false
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

function handleClick(e: MouseEvent) {
  emit('click', e);
}
</script>

<template>
  <button
    :type="type"
    class="ui-button"
    :class="[
      `variant-${variant}`,
      `size-${size}`,
      { 'is-loading': loading, 'is-disabled': disabled || loading, 'is-block': block }
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <Loader2 v-if="loading" class="spin-icon" />
    <slot v-else name="icon"></slot>
    <span v-if="$slots.default" class="button-text">
      <slot></slot>
    </span>
  </button>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: $radius-sm;
  font-family: $font-main;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  border: 1px solid transparent;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  user-select: none;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.is-block {
    display: flex;
    width: 100%;
  }
}

.spin-icon {
  animation: spin 1s infinite linear;
  width: 14px;
  height: 14px;
}

/* 变体 */
.variant-primary {
  background: $accent-primary;
  color: #ffffff;

  &:hover:not(:disabled) {
    background: $accent-hover;
    box-shadow: $shadow-sm;
  }
}

.variant-secondary {
  background: $bg-surface;
  border-color: $border-color;
  color: $text-secondary;

  &:hover:not(:disabled) {
    background: $bg-surface-subtle;
    border-color: #cbd5e1;
    color: $text-main;
  }
}

.variant-danger {
  background: $danger;
  color: #ffffff;

  &:hover:not(:disabled) {
    background: #dc2626;
  }
}

.variant-danger-outline {
  background: transparent;
  border-color: #fca5a5;
  color: $danger;

  &:hover:not(:disabled) {
    background: $danger-subtle;
    border-color: $danger;
  }
}

.variant-ghost {
  background: transparent;
  color: $text-muted;

  &:hover:not(:disabled) {
    background: $bg-surface-subtle;
    color: $text-main;
  }
}

.variant-icon {
  background: $bg-surface;
  border-color: $border-color;
  color: $text-muted;
  padding: 0;

  &:hover:not(:disabled) {
    background: $bg-surface-subtle;
    border-color: #cbd5e1;
    color: $text-main;
  }
}

/* 尺寸规格 */
.size-sm {
  height: 30px;
  padding: 0 10px;
  font-size: 0.8rem;
  border-radius: $radius-sm;

  &.variant-icon {
    width: 30px;
    height: 30px;
  }
}

.size-md {
  height: 36px;
  padding: 0 14px;
  font-size: 0.875rem;
  border-radius: $radius-md;

  &.variant-icon {
    width: 36px;
    height: 36px;
  }
}

.size-lg {
  height: 42px;
  padding: 0 18px;
  font-size: 0.95rem;
  border-radius: $radius-md;

  &.variant-icon {
    width: 42px;
    height: 42px;
  }
}
</style>
