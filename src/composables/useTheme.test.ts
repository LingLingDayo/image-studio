import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '@/core/theme';

// 主题状态是模块级单例，每个用例重新加载以获得干净初值。
async function freshUseTheme() {
  vi.resetModules();
  const { useTheme } = await import('./useTheme');
  return useTheme();
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
  });

  it('默认使用浅色并在首次调用时应用', async () => {
    const theme = await freshUseTheme();
    expect(theme.mode.value).toBe('light');
    expect(theme.resolved.value).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('恢复已保存的深色模式并立即应用', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const theme = await freshUseTheme();
    expect(theme.mode.value).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('切换时即时生效并持久化，不依赖设置弹窗保存', async () => {
    const theme = await freshUseTheme();
    theme.setMode('dark');
    expect(theme.mode.value).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');

    theme.setMode('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('忽略非法模式', async () => {
    const theme = await freshUseTheme();
    theme.setMode('sepia' as never);
    expect(theme.mode.value).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });
});
