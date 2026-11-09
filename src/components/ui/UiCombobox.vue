<script lang="ts">
let nextComboboxId = 0;

function createComboboxId(): string {
  nextComboboxId += 1;
  return `ui-combobox-${nextComboboxId}`;
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Check, ChevronDown } from '@lucide/vue';
import { useClickOutside } from '@/composables/useClickOutside';

export interface ComboboxOption {
  label: string;
  value: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  options: Array<string | ComboboxOption>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}>(), {
  label: '',
  placeholder: '输入或选择',
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', value: string): void;
}>();

const fallbackId = createComboboxId();
const inputId = computed(() => props.id || `${fallbackId}-input`);
const listId = computed(() => `${inputId.value}-listbox`);
const rootRef = ref<HTMLElement | null>(null);
const controlRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const draftValue = ref(props.modelValue);
const isOpen = ref(false);
const isFiltering = ref(false);
const highlightedIndex = ref(-1);
const menuPlacement = ref<'top' | 'bottom'>('bottom');
const menuMaxHeight = ref(220);

const normalizedOptions = computed<ComboboxOption[]>(() => props.options.map((option) =>
  typeof option === 'string' ? { label: option, value: option } : option
));
const visibleOptions = computed(() => {
  const query = draftValue.value.trim().toLowerCase();
  if (!isFiltering.value || !query) return normalizedOptions.value;
  return normalizedOptions.value.filter((option) =>
    option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
  );
});
const activeDescendant = computed(() => isOpen.value && highlightedIndex.value >= 0 &&
  highlightedIndex.value < visibleOptions.value.length ? optionId(highlightedIndex.value) : undefined
);

function optionId(index: number): string {
  return `${listId.value}-option-${index}`;
}

function calculatePlacement(): void {
  const control = controlRef.value;
  if (!control) return;
  const rect = control.getBoundingClientRect();
  let top = 0;
  let bottom = window.innerHeight;
  let parent = control.parentElement;

  // 下拉留在同一 DOM 中，需要同时避开弹窗滚动容器的裁剪边界。
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowY}`)) {
      const bounds = parent.getBoundingClientRect();
      top = Math.max(top, bounds.top);
      bottom = Math.min(bottom, bounds.bottom);
    }
    parent = parent.parentElement;
  }

  const below = Math.max(0, bottom - rect.bottom - 8);
  const above = Math.max(0, rect.top - top - 8);
  const desired = Math.min(220, Math.max(1, visibleOptions.value.length) * 36 + 8);
  menuPlacement.value = below < desired && above > below ? 'top' : 'bottom';
  menuMaxHeight.value = Math.max(40, Math.min(220, menuPlacement.value === 'top' ? above : below));
}

function openDropdown(filter = false): void {
  if (props.disabled) return;
  isFiltering.value = filter;
  isOpen.value = true;
  highlightedIndex.value = filter ? -1 : visibleOptions.value.findIndex((option) =>
    option.value === draftValue.value && !option.disabled
  );
  calculatePlacement();
}

function closeDropdown(): void {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

function toggleDropdown(): void {
  if (props.disabled) return;
  if (isOpen.value) closeDropdown();
  else openDropdown();
  inputRef.value?.focus();
}

function updateValue(value: string): void {
  draftValue.value = value;
  emit('update:modelValue', value);
  emit('change', value);
}

function handleInput(event: Event): void {
  if (props.disabled) return;
  updateValue((event.target as HTMLInputElement).value);
  openDropdown(true);
}

function selectOption(option: ComboboxOption): void {
  if (props.disabled || option.disabled) return;
  updateValue(option.value);
  closeDropdown();
  inputRef.value?.focus();
}

function moveHighlight(direction: 1 | -1): void {
  const options = visibleOptions.value;
  if (!options.some((option) => !option.disabled)) {
    highlightedIndex.value = -1;
    return;
  }
  let index = highlightedIndex.value;
  if (index === -1 && direction === -1) index = 0;
  for (let step = 0; step < options.length; step++) {
    index = (index + direction + options.length) % options.length;
    if (!options[index].disabled) {
      highlightedIndex.value = index;
      void nextTick(() => document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' }));
      return;
    }
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (props.disabled || event.isComposing) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (!isOpen.value) {
      openDropdown();
      if (highlightedIndex.value === -1) moveHighlight(direction);
    } else {
      moveHighlight(direction);
    }
  } else if (event.key === 'Enter' && isOpen.value) {
    event.preventDefault();
    const option = visibleOptions.value[highlightedIndex.value];
    if (option) selectOption(option);
    else closeDropdown();
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
    event.stopPropagation();
    closeDropdown();
  } else if (event.key === 'Tab') {
    closeDropdown();
  }
}

watch(() => props.modelValue, (value) => { draftValue.value = value; });
watch(() => props.disabled, (disabled) => { if (disabled) closeDropdown(); });
watch(visibleOptions, (options) => {
  if (!options[highlightedIndex.value] || options[highlightedIndex.value]?.disabled) highlightedIndex.value = -1;
  if (isOpen.value) calculatePlacement();
});
useClickOutside(rootRef, closeDropdown);
</script>

<template>
  <div ref="rootRef" class="ui-combobox" :class="{ 'is-disabled': disabled }">
    <label v-if="label" :for="inputId" class="combobox-label">{{ label }}</label>
    <div ref="controlRef" class="combobox-control">
      <input
        :id="inputId"
        ref="inputRef"
        class="combobox-input"
        type="text"
        role="combobox"
        autocomplete="off"
        :spellcheck="false"
        :value="draftValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="label || placeholder"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="listId"
        :aria-activedescendant="activeDescendant"
        @input="handleInput"
        @keydown="handleKeyDown"
      />
      <div class="combobox-actions">
        <slot name="actions"></slot>
        <button
          class="combobox-toggle"
          type="button"
          :disabled="disabled"
          :aria-label="isOpen ? '收起选项' : '展开选项'"
          :aria-expanded="isOpen"
          :aria-controls="listId"
          @click="toggleDropdown"
        >
          <ChevronDown :size="15" :class="{ 'is-rotated': isOpen }" aria-hidden="true" />
        </button>
      </div>
      <div
        v-if="isOpen"
        :id="listId"
        class="combobox-dropdown"
        :class="`placement-${menuPlacement}`"
        :style="{ maxHeight: `${menuMaxHeight}px` }"
        role="listbox"
        :aria-label="label || '可选项'"
      >
        <div v-if="visibleOptions.length === 0" class="combobox-empty">暂无匹配选项，可直接输入</div>
        <div
          v-for="(option, index) in visibleOptions"
          :id="optionId(index)"
          :key="option.value"
          class="combobox-option"
          :class="{ 'is-selected': option.value === draftValue, 'is-highlighted': index === highlightedIndex, 'is-disabled': option.disabled }"
          role="option"
          :aria-selected="option.value === draftValue"
          :aria-disabled="option.disabled || undefined"
          @mousedown.prevent
          @mouseenter="highlightedIndex = option.disabled ? -1 : index"
          @click="selectOption(option)"
        >
          <span>{{ option.label }}</span>
          <Check v-if="option.value === draftValue" :size="14" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-combobox {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  min-width: 0;
  font-family: $font-main;

  &.is-disabled {
    opacity: 0.5;
  }
}

.combobox-label {
  color: $text-secondary;
  font-size: 0.85rem;
  font-weight: 600;
}

.combobox-control {
  position: relative;
  display: flex;
  align-items: center;
  height: 38px;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  box-shadow: $shadow-xs;

  &:focus-within {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px $accent-soft;
  }
}

.combobox-input {
  flex: 1;
  min-width: 0;
  width: 0;
  height: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  outline: none;
  color: $text-main;
  font-family: inherit;
  font-size: 0.875rem;

  &::placeholder {
    color: $text-placeholder;
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.combobox-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 8px;
  flex-shrink: 0;
}

.combobox-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-muted;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: $bg-surface-hover;
    color: $text-main;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 2px;
  }

  .is-rotated {
    transform: rotate(180deg);
  }
}

.combobox-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 20;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-surface;
  box-shadow: $shadow-lg;

  &.placement-bottom {
    top: calc(100% + 6px);
  }

  &.placement-top {
    bottom: calc(100% + 6px);
  }
}

.combobox-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 32px;
  padding: 6px 8px;
  border-radius: $radius-sm;
  color: $text-main;
  font-size: 0.85rem;
  overflow-wrap: anywhere;
  cursor: pointer;

  &.is-selected {
    color: $accent-primary;
  }

  &.is-highlighted,
  &:hover:not(.is-disabled) {
    background: $accent-subtle;
  }

  &.is-disabled {
    color: $text-dim;
    cursor: not-allowed;
  }
}

.combobox-empty {
  padding: 10px 8px;
  color: $text-muted;
  font-size: 0.8rem;
}
</style>
