<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';
import { useClickOutside } from '@/composables/useClickOutside';

export interface SelectOption {
  label: string;
  value: string | number | boolean;
  description?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | boolean;
    options: Array<SelectOption | string>;
    label?: string;
    placeholder?: string;
    placement?: 'top' | 'bottom' | 'auto';
    variant?: 'pill' | 'default' | 'subtle';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    label: '',
    placeholder: '请选择',
    placement: 'auto',
    variant: 'pill',
    size: 'sm',
    disabled: false,
    block: false
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void;
  (e: 'change', value: any): void;
}>();

const isOpen = ref(false);
const selectRef = ref<HTMLElement | null>(null);
const menuPlacement = ref<'top' | 'bottom'>('bottom');
const highlightedIndex = ref(-1);

// 标准化 options
const normalizedOptions = computed<SelectOption[]>(() => {
  return props.options.map((opt) => {
    if (typeof opt === 'string') {
      return { label: opt, value: opt };
    }
    return opt;
  });
});

// 当前选中项
const currentOption = computed(() => {
  return normalizedOptions.value.find((opt) => opt.value === props.modelValue);
});

const currentDisplayLabel = computed(() => {
  return currentOption.value ? currentOption.value.label : props.placeholder;
});

const triggerTitle = computed(() => {
  if (props.label && currentDisplayLabel.value) {
    return `${props.label}: ${currentDisplayLabel.value}`;
  }
  return currentDisplayLabel.value || props.placeholder;
});

// 点击外部关闭
useClickOutside(selectRef, () => {
  closeDropdown();
});

function calculatePlacement() {
  if (props.placement === 'top') {
    menuPlacement.value = 'top';
    return;
  }
  if (props.placement === 'bottom') {
    menuPlacement.value = 'bottom';
    return;
  }

  // auto 计算：检查下方剩余空间
  if (selectRef.value) {
    const rect = selectRef.value.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // 如果下方空间小于 220px 且上方空间更大，则朝上展开
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      menuPlacement.value = 'top';
    } else {
      menuPlacement.value = 'bottom';
    }
  }
}

function toggleDropdown() {
  if (props.disabled) return;
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  calculatePlacement();
  isOpen.value = true;
  highlightedIndex.value = normalizedOptions.value.findIndex(
    (opt) => opt.value === props.modelValue
  );
}

function closeDropdown() {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

function selectOption(option: SelectOption) {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  closeDropdown();
}

function handleKeyDown(e: KeyboardEvent) {
  if (props.disabled) return;

  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
    }
    return;
  }

  if (e.key === 'Escape') {
    e.preventDefault();
    closeDropdown();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (highlightedIndex.value < normalizedOptions.value.length - 1) {
      highlightedIndex.value++;
    } else {
      highlightedIndex.value = 0;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (highlightedIndex.value > 0) {
      highlightedIndex.value--;
    } else {
      highlightedIndex.value = normalizedOptions.value.length - 1;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (highlightedIndex.value >= 0 && highlightedIndex.value < normalizedOptions.value.length) {
      selectOption(normalizedOptions.value[highlightedIndex.value]);
    }
  }
}
</script>

<template>
  <div 
    ref="selectRef" 
    class="ui-select" 
    :class="[
      `variant-${variant}`, 
      `size-${size}`, 
      { 'is-open': isOpen, 'is-disabled': disabled, 'is-block': block }
    ]"
    tabindex="0"
    role="combobox"
    :aria-expanded="isOpen"
    @keydown="handleKeyDown"
  >
    <button 
      type="button" 
      class="select-trigger" 
      :disabled="disabled"
      :data-tip="triggerTitle"
      :aria-label="triggerTitle"
      @click="toggleDropdown"
    >
      <span v-if="label" class="select-label">{{ label }}</span>
      <span class="select-value" :class="{ 'is-placeholder': !currentOption }">
        {{ currentDisplayLabel }}
      </span>
      <ChevronDown class="select-arrow" :class="{ 'is-rotated': isOpen }" />
    </button>

    <transition name="dropdown">
      <div 
        v-if="isOpen" 
        class="select-dropdown" 
        :class="[`placement-${menuPlacement}`]"
        role="listbox"
      >
        <div class="dropdown-list">
          <div 
            v-for="(opt, idx) in normalizedOptions" 
            :key="String(opt.value)"
            class="dropdown-item"
            :class="{ 
              'is-active': opt.value === modelValue, 
              'is-highlighted': idx === highlightedIndex,
              'is-disabled': opt.disabled 
            }"
            role="option"
            :aria-selected="opt.value === modelValue"
            @mouseenter="highlightedIndex = idx"
            @click="selectOption(opt)"
          >
            <div class="item-content">
              <span class="item-label">{{ opt.label }}</span>
              <span v-if="opt.description" class="item-desc">{{ opt.description }}</span>
            </div>
            <Check v-if="opt.value === modelValue" class="item-check" />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-select {
  position: relative;
  display: inline-flex;
  outline: none;
  user-select: none;
  font-family: $font-main;

  &.is-block {
    display: flex;
    width: 100%;
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;

    .select-trigger {
      cursor: not-allowed;
    }
  }
}

.select-trigger {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: $shadow-xs;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  outline: none;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

/* 变体: pill (用于 Prompt 底部控制台，纯净白底 + 晶亮微边框) */
.variant-pill {
  .select-trigger {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 9999px;
    padding: 4px 11px;
    font-size: 0.75rem;
    color: $text-secondary;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

    &:hover:not(:disabled) {
      background: #ffffff;
      border-color: #93c5fd;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
      transform: translateY(-0.5px);

      .select-arrow {
        color: $accent-primary;
      }
    }
  }

  &.is-open .select-trigger {
    background: #ffffff;
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  &:focus-visible .select-trigger {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .select-label {
    font-size: 0.72rem;
    color: $text-muted;
    font-weight: 500;
  }

  .select-value {
    font-weight: 600;
    color: $text-main;
  }
}

/* 变体: default (用于 Header 或常规表单) */
.variant-default {
  .select-trigger {
    background: #ffffff;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: $radius-sm;
    padding: 6px 12px;
    font-size: 0.85rem;
    color: $text-secondary;
    font-weight: 500;

    &:hover:not(:disabled) {
      border-color: #93c5fd;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
      color: $text-main;
      transform: translateY(-0.5px);
    }
  }

  &.is-open .select-trigger {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  &:focus-visible .select-trigger {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .select-label {
    font-size: 0.8rem;
    color: $text-muted;
    font-weight: 500;
  }

  .select-value {
    font-weight: 500;
    color: $text-main;
  }
}

/* 变体: subtle */
.variant-subtle {
  .select-trigger {
    background: transparent;
    border: 1px solid transparent;
    box-shadow: none;
    border-radius: $radius-sm;
    padding: 4px 8px;
    font-size: 0.8rem;
    color: $text-secondary;

    &:hover:not(:disabled) {
      background: rgba(241, 245, 249, 0.8);
      color: $text-main;
    }
  }
}

/* 尺寸规格 */
.size-sm {
  .select-arrow {
    width: 12px;
    height: 12px;
  }
}

.size-md {
  .select-trigger {
    padding: 8px 14px;
    font-size: 0.875rem;
  }
  .select-arrow {
    width: 14px;
    height: 14px;
  }
}

.size-lg {
  .select-trigger {
    padding: 10px 16px;
    font-size: 0.95rem;
  }
  .select-arrow {
    width: 16px;
    height: 16px;
  }
}

.select-arrow {
  color: $text-dim;
  margin-left: auto;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
  flex-shrink: 0;

  &.is-rotated {
    transform: rotate(180deg);
    color: $accent-primary;
  }
}

.select-value.is-placeholder {
  color: $text-dim;
}

/* 下拉菜单面板 (纯白透光浮岛) */
.select-dropdown {
  position: absolute;
  left: 0;
  min-width: 140px;
  width: max-content;
  max-width: 280px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  padding: 5px;
  z-index: 1000;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  &.placement-bottom {
    top: calc(100% + 6px);
    transform-origin: top left;
  }

  &.placement-top {
    bottom: calc(100% + 6px);
    transform-origin: bottom left;
  }
}

.dropdown-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;

  /* 细滚动条 */
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 2px;
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: $radius-sm;
  cursor: pointer;
  font-size: 0.8rem;
  color: $text-secondary;
  transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover,
  &.is-highlighted {
    background: #f8fafc;
    color: $text-main;
  }

  &.is-active {
    background: rgba(37, 99, 235, 0.08);
    color: $accent-primary;
    font-weight: 600;
  }

  &.is-disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-label {
  white-space: nowrap;
}

.item-desc {
  font-size: 0.7rem;
  color: $text-dim;
}

.item-check {
  width: 14px;
  height: 14px;
  color: $accent-primary;
  flex-shrink: 0;
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* 响应式断点：当屏幕宽度不够时，select-trigger 变为只显示箭头的正方形按钮 */
@media (max-width: 640px) {
  .ui-select:not(.is-block) {
    flex-shrink: 0;

    .select-trigger {
      padding: 0 !important;
      justify-content: center !important;
      align-items: center !important;
      aspect-ratio: 1 / 1;

      .select-label,
      .select-value {
        display: none !important;
      }

      .select-arrow {
        margin-left: 0 !important;
        margin: 0 !important;
      }
    }

    &.size-sm {
      .select-trigger {
        width: 32px;
        height: 32px;
        min-width: 32px;
      }
      &.variant-pill .select-trigger {
        width: 28px;
        height: 28px;
        min-width: 28px;
        border-radius: 9999px;
      }
    }

    &.size-md .select-trigger {
      width: 36px;
      height: 36px;
      min-width: 36px;
    }

    &.size-lg .select-trigger {
      width: 42px;
      height: 42px;
      min-width: 42px;
    }
  }
}
</style>
