<script setup lang="ts">
import { ref, computed } from 'vue';
import { Eye, EyeOff, X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    type?: string;
    placeholder?: string;
    label?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    clearable?: boolean;
    showPasswordToggle?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'pill' | 'subtle';
    autocomplete?: string;
    mono?: boolean;
  }>(),
  {
    type: 'text',
    placeholder: '',
    label: '',
    hint: '',
    required: false,
    disabled: false,
    clearable: false,
    showPasswordToggle: false,
    size: 'md',
    variant: 'default',
    autocomplete: 'off',
    mono: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'change', val: string): void;
  (e: 'clear'): void;
}>();

const isPasswordVisible = ref(false);

const computedType = computed(() => {
  if (props.type === 'password') {
    return isPasswordVisible.value ? 'text' : 'password';
  }
  return props.type;
});

function handleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  emit('update:modelValue', val);
}

function handleChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  emit('change', val);
}

function handleClear() {
  emit('update:modelValue', '');
  emit('clear');
}
</script>

<template>
  <div 
    class="ui-input-wrapper"
    :class="[
      `size-${size}`,
      `variant-${variant}`,
      { 'is-disabled': disabled, 'has-label': !!label }
    ]"
  >
    <label v-if="label" class="input-label">
      <slot name="label-prefix"></slot>
      <span>{{ label }}</span>
      <span v-if="required" class="required-star">*</span>
    </label>

    <div class="input-inner">
      <div v-if="$slots.prefix" class="input-prefix">
        <slot name="prefix"></slot>
      </div>

      <input
        :type="computedType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="input-field"
        :class="{ 'font-mono': mono }"
        @input="handleInput"
        @change="handleChange"
      />

      <div class="input-suffix">
        <!-- 清空按钮 -->
        <button
          v-if="clearable && modelValue && !disabled"
          type="button"
          class="suffix-action-btn"
          data-tip="清空"
          @click="handleClear"
        >
          <X :size="13" />
        </button>

        <!-- 密码显隐切换 -->
        <button
          v-if="type === 'password' || showPasswordToggle"
          type="button"
          class="suffix-action-btn"
          :data-tip="isPasswordVisible ? '隐藏密码' : '显示密码'"
          @click="isPasswordVisible = !isPasswordVisible"
        >
          <Eye v-if="!isPasswordVisible" :size="15" />
          <EyeOff v-else :size="15" />
        </button>

        <slot name="suffix"></slot>
      </div>
    </div>

    <div v-if="hint || $slots.hint" class="input-hint">
      <slot name="hint">{{ hint }}</slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  font-family: $font-main;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;

    .input-field {
      cursor: not-allowed;
    }
  }
}

.input-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: $text-secondary;
}

.required-star {
  color: $danger;
}

.input-inner {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: $radius-sm;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  .ui-input-wrapper:not(.is-disabled) &:hover {
    border-color: #93c5fd;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
  }

  &:focus-within {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    background: #ffffff;
  }
}

.input-field {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  padding: 8px 12px;
  font-size: 0.875rem;
  color: $text-main;
  outline: none;
  font-family: inherit;

  &::placeholder {
    color: $text-dim;
  }

  &.font-mono {
    font-family: $font-mono;
  }
}

.input-prefix {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 12px;
  color: $text-muted;
  flex-shrink: 0;
}

.input-suffix {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  flex-shrink: 0;
}

.suffix-action-btn {
  background: transparent;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &:hover {
    color: $text-main;
    background: #f1f5f9;
  }
}

.input-hint {
  font-size: 0.75rem;
  color: $text-muted;
  line-height: 1.4;

  :deep(code) {
    font-family: $font-mono;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: $text-secondary;
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
}

/* 变体 */
.variant-default {
  .input-inner {
    background: #ffffff;
  }
}

.variant-pill {
  .input-inner {
    border-radius: 9999px;
    background: #ffffff;
  }
}

.variant-subtle {
  .input-inner {
    border-color: transparent;
    background: #f8fafc;

    &:hover {
      background: #f1f5f9;
    }
  }
}

/* 尺寸 */
.size-sm {
  .input-inner {
    height: 32px;
  }
  .input-field {
    font-size: 0.8rem;
    padding: 4px 10px;
  }
}

.size-md {
  .input-inner {
    height: 38px;
  }
  .input-field {
    font-size: 0.875rem;
    padding: 8px 12px;
  }
}

.size-lg {
  .input-inner {
    height: 44px;
  }
  .input-field {
    font-size: 0.95rem;
    padding: 10px 14px;
  }
}
</style>
