<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    label?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
  }>(),
  {
    label: '',
    disabled: false,
    size: 'sm'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'change', val: boolean): void;
}>();

function toggle() {
  if (props.disabled) return;
  const newVal = !props.modelValue;
  emit('update:modelValue', newVal);
  emit('change', newVal);
}

function handleKeyDown(e: KeyboardEvent) {
  if (props.disabled) return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    toggle();
  }
}
</script>

<template>
  <div 
    class="ui-switch-wrapper" 
    :class="[`size-${size}`, { 'is-disabled': disabled, 'is-checked': modelValue }]"
    tabindex="0"
    role="switch"
    :aria-checked="modelValue"
    @click="toggle"
    @keydown="handleKeyDown"
  >
    <span v-if="label" class="switch-label">{{ label }}</span>
    <div class="switch-track">
      <div class="switch-thumb"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-switch-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-family: $font-main;
  outline: none;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible .switch-track {
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
  }
}

.switch-label {
  font-size: 0.75rem;
  color: $text-secondary;
  font-weight: 500;
}

.switch-track {
  position: relative;
  width: 32px;
  height: 18px;
  background: #cbd5e1;
  border-radius: 9999px;
  transition: background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.is-checked {
  .switch-track {
    background: $accent-primary;
  }

  .switch-thumb {
    transform: translateX(14px);
  }
}

/* 尺寸变体 */
.size-sm {
  .switch-track {
    width: 28px;
    height: 16px;
  }
  .switch-thumb {
    width: 12px;
    height: 12px;
  }
  &.is-checked .switch-thumb {
    transform: translateX(12px);
  }
}

.size-md {
  .switch-track {
    width: 38px;
    height: 22px;
  }
  .switch-thumb {
    width: 18px;
    height: 18px;
  }
  &.is-checked .switch-thumb {
    transform: translateX(16px);
  }
}
</style>
