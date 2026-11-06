import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BackupSettings from './BackupSettings.vue';
import { createBackup, prepareBackup, importBackup, releaseBackup } from '@/core/storage/BackupService';
import { downloadImage } from '@/utils/download';
import { useGalleryStore } from '@/stores/galleryStore';

vi.mock('@/core/storage/BackupService', () => ({
  createBackup: vi.fn(), prepareBackup: vi.fn(), importBackup: vi.fn(), releaseBackup: vi.fn()
}));
vi.mock('@/utils/download', () => ({ downloadImage: vi.fn() }));

describe('BackupSettings', () => {
  let app: App;
  let mounted = false;
  let container: HTMLDivElement;
  let loadGallery: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    const pinia = createPinia();
    setActivePinia(pinia);
    loadGallery = vi.spyOn(useGalleryStore(), 'loadGallery').mockResolvedValue();
    container = document.createElement('div');
    document.body.appendChild(container);
    app = createApp(BackupSettings);
    app.use(pinia);
    app.mount(container);
    mounted = true;
  });
  afterEach(() => { if (mounted) app.unmount(); container.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });

  function button(label: string): HTMLButtonElement {
    return [...container.querySelectorAll('button')].find((item) => item.textContent?.trim() === label)!;
  }

  function chooseFile(): void {
    const input = container.querySelector('input')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'backup.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('选择后只显示内联预览，明确确认才执行导入并刷新作品列表', async () => {
    const preview = { total: 2, added: 1, skipped: 1, unsupportedCount: 0 };
    vi.mocked(prepareBackup).mockResolvedValueOnce(preview);
    vi.mocked(importBackup).mockResolvedValueOnce({ added: 1, skipped: 1 });
    chooseFile();
    await vi.waitFor(() => expect(container.textContent).toContain('将新增 1 张'));
    expect(importBackup).not.toHaveBeenCalled();
    expect(container.textContent).toContain('不会被覆盖或清空');
    button('合并导入').click();
    await vi.waitFor(() => expect(container.textContent).toContain('导入完成'));
    expect(importBackup).toHaveBeenCalledWith(preview);
    expect(loadGallery).toHaveBeenCalledOnce();
  });

  it('取消预览释放已解析备份，不写入任何作品', async () => {
    const preview = { total: 1, added: 1, skipped: 0, unsupportedCount: 0 };
    vi.mocked(prepareBackup).mockResolvedValueOnce(preview);
    chooseFile();
    await vi.waitFor(() => expect(container.querySelector('.backup-preview')).not.toBeNull());
    button('取消').click();
    await nextTick();
    expect(releaseBackup).toHaveBeenCalledWith(preview);
    expect(container.querySelector('.backup-preview')).toBeNull();
    expect(importBackup).not.toHaveBeenCalled();
  });

  it('格式错误只反馈错误，不显示确认导入按钮', async () => {
    vi.mocked(prepareBackup).mockRejectedValueOnce(new Error('不是有效备份'));
    chooseFile();
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('不是有效备份'));
    expect(container.querySelector('.backup-preview')).toBeNull();
    expect(importBackup).not.toHaveBeenCalled();
  });

  it('空作品库不触发下载', async () => {
    vi.mocked(createBackup).mockResolvedValueOnce({ count: 0, blob: new Blob(['{}']), filename: 'empty.json' });
    button('导出备份').click();
    await vi.waitFor(() => expect(container.textContent).toContain('暂无作品'));
    expect(downloadImage).not.toHaveBeenCalled();
  });

  it('卸载后才返回的预览被释放，不会继续保留文件内容', async () => {
    let resolve!: (value: { total: number; added: number; skipped: number; unsupportedCount: number }) => void;
    vi.mocked(prepareBackup).mockReturnValueOnce(new Promise((res) => { resolve = res; }));
    chooseFile();
    app.unmount();
    mounted = false;
    const preview = { total: 1, added: 1, skipped: 0, unsupportedCount: 0 };
    resolve(preview);
    await nextTick();
    await vi.waitFor(() => expect(releaseBackup).toHaveBeenCalledWith(preview));
  });
});
