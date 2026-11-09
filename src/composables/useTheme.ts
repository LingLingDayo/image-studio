import { computed, ref } from 'vue';
import {
  applyThemeAttribute,
  isThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  THEME_STORAGE_KEY,
  watchSystemTheme,
  type ThemeMode
} from '@/core/theme';

// 主题属于界面偏好而非服务配置，独立持久化以免与设置弹窗的草稿提交机制耦合。
const mode = ref<ThemeMode>(readStoredThemeMode() ?? 'light');
let stopSystemWatch: (() => void) | null = null;
let started = false;

function sync(): void {
  applyThemeAttribute(mode.value);
  if (mode.value === 'system') {
    stopSystemWatch ??= watchSystemTheme(() => applyThemeAttribute('system'));
  } else {
    stopSystemWatch?.();
    stopSystemWatch = null;
  }
}

export function useTheme() {
  if (!started) {
    started = true;
    sync();
  }

  function setMode(next: ThemeMode): void {
    if (!isThemeMode(next) || next === mode.value) return;
    mode.value = next;
    localStorage.setItem(THEME_STORAGE_KEY, next);
    sync();
  }

  return {
    mode: computed(() => mode.value),
    resolved: computed(() => resolveThemeMode(mode.value)),
    setMode
  };
}
