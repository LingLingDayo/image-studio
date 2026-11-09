export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'gpt_image_theme_mode';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
};

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}

export function readStoredThemeMode(): ThemeMode | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(stored) ? stored : null;
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light';
  return mode;
}

/** 把模式解析为实际主题并写到根元素，供首屏与设置切换共用。 */
export function applyThemeAttribute(mode: ThemeMode): 'light' | 'dark' {
  const resolved = resolveThemeMode(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

/** 仅在「跟随系统」下需要监听系统偏好变化，返回取消监听函数。 */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  if (typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
