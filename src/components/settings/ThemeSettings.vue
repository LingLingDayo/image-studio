<script setup lang="ts">
import { Monitor, Moon, Sun } from '@lucide/vue';
import { useTheme } from '@/composables/useTheme';
import { THEME_MODES, THEME_MODE_LABELS, type ThemeMode } from '@/core/theme';

defineOptions({ inheritAttrs: false });
withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false });

const { mode, setMode } = useTheme();

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
      <span class="theme-hint">切换后立即生效，无需保存设置</span>
    </div>
    <div class="theme-options" role="radiogroup" aria-label="主题模式">
      <button
        v-for="option in THEME_MODES"
        :key="option"
        type="button"
        class="theme-option"
        :class="{ 'is-active': mode === option }"
        role="radio"
        :aria-checked="mode === option"
        :disabled="disabled"
        @click="setMode(option)"
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
  flex-wrap: wrap;
}

.theme-label {
  font-size: 0.82rem;
  font-weight: 500;
  color: $text-main;
}

.theme-hint {
  font-size: 0.74rem;
  color: $text-muted;
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
