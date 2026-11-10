<script setup lang="ts">
import { computed } from 'vue';
import { Monitor, Moon, Sun } from '@lucide/vue';
import type { SettingValue } from '@/core/settings';
import { isThemeMode, THEME_MODES, THEME_MODE_LABELS, type ThemeMode } from '@/core/theme';

defineOptions({ inheritAttrs: false });
const props = withDefaults(
  defineProps<{ value?: SettingValue | null; disabled?: boolean }>(),
  { value: null, disabled: false }
);

const emit = defineEmits<{
  (e: 'change', value: ThemeMode): void;
}>();

// 主题模式是普通设置项：只改草稿值，真正应用由 general.section 在保存时完成。
const currentMode = computed<ThemeMode>(() => (isThemeMode(props.value) ? props.value : 'light'));

function selectMode(mode: ThemeMode): void {
  if (props.disabled || mode === currentMode.value) return;
  emit('change', mode);
}

const icons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor
};
</script>

<template>
  <div class="theme-settings">
    <div class="theme-head">
      <span class="theme-label">主题模式</span>
    </div>
    <div class="theme-options" role="radiogroup" aria-label="主题模式">
      <button
        v-for="option in THEME_MODES"
        :key="option"
        type="button"
        class="theme-option"
        :class="{ 'is-active': currentMode === option }"
        role="radio"
        :aria-checked="currentMode === option"
        :disabled="disabled"
        @click="selectMode(option)"
      >
        <component :is="icons[option]" :size="15" />
        <span>{{ THEME_MODE_LABELS[option] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.theme-settings {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.theme-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: $text-main;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  padding: 8px 10px;
  line-height: normal;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-surface;
  color: $text-secondary;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    background: $bg-surface-hover;
    border-color: $border-strong;
    color: $text-main;
  }

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 2px;
  }

  &.is-active {
    background: $accent-subtle;
    border-color: $accent-border;
    color: $accent-primary;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 520px) {
  .theme-option {
    gap: 5px;
    font-size: 0.74rem;
  }
}
</style>
