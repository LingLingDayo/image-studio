import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyThemeAttribute,
  isThemeMode,
  readStoredThemeMode,
  resolveThemeMode,
  THEME_MODES,
  THEME_STORAGE_KEY,
  watchSystemTheme
} from './theme';

const originalMatchMedia = window.matchMedia;

function stubMatchMedia(matches: boolean, addEventListener = vi.fn(), removeEventListener = vi.fn()) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({ matches, addEventListener, removeEventListener }))
  });
}

describe('theme runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    });
  });

  it('只接受受支持的主题模式', () => {
    expect(THEME_MODES).toEqual(['light', 'dark', 'system']);
    expect(isThemeMode('dark')).toBe(true);
    expect(isThemeMode('sepia')).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });

  it('只读取合法的本地存储值，忽略脏数据', () => {
    expect(readStoredThemeMode()).toBeNull();
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredThemeMode()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'unknown');
    expect(readStoredThemeMode()).toBeNull();
  });

  it('把明确模式写到根元素并同步 color-scheme', () => {
    expect(applyThemeAttribute('dark')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    expect(applyThemeAttribute('light')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('跟随系统时解析为实际主题', () => {
    stubMatchMedia(true);
    expect(resolveThemeMode('system')).toBe('dark');
    expect(applyThemeAttribute('system')).toBe('dark');

    stubMatchMedia(false);
    expect(resolveThemeMode('system')).toBe('light');
  });

  it('系统偏好监听可注册也可取消', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    stubMatchMedia(false, addEventListener, removeEventListener);

    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);
    expect(addEventListener).toHaveBeenCalledWith('change', onChange);
    stop();
    expect(removeEventListener).toHaveBeenCalledWith('change', onChange);
  });
});
