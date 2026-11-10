import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ArtworkCard from './card/ArtworkCard.vue';
import LightboxModal from './LightboxModal.vue';
import { downloadRotatedImage } from '@/utils/download';
import type { MediaAsset } from '@/types/asset';

vi.mock('@/utils/download', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/utils/download')>(),
  downloadRotatedImage: vi.fn()
}));

describe('媒体下载结果反馈', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp> | undefined;
  const asset: MediaAsset = { id: 1, url: 'blob:gif', blob: new Blob(['GIF89a'], { type: 'image/gif' }),
    prompt: 'animation', model: 'gpt-image-2.6-flare', size: '1024x1024', quality: 'max', format: 'gif',
    duration: '1s', timestamp: 1, type: 't2i' };
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.mocked(downloadRotatedImage).mockReset().mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => { app?.unmount(); container.remove(); });

  it.each(['card', 'lightbox'] as const)('%s 转换失败提示错误，不误报下载成功', async (surface) => {
    const onShowToast = vi.fn();
    vi.mocked(downloadRotatedImage).mockRejectedValue(new Error('图像导出失败，请选择原始格式'));
    app = createApp(() => surface === 'card' ? h(ArtworkCard, { item: asset, onShowToast }) : h(LightboxModal, { item: asset, onShowToast }));
    app.mount(container);
    await nextTick();
    const button = container.querySelector<HTMLButtonElement>(surface === 'card' ? '.card-action-btn[data-tip*="下载"]' : '.modal-actions .btn-primary')!;
    button.click();
    await nextTick();
    expect(onShowToast).toHaveBeenCalledWith('图像导出失败，请选择原始格式', 'error');
    expect(onShowToast).toHaveBeenCalledTimes(1);
  });

  it('GIF 预览旋转后的原格式下载明确说明不应用旋转', async () => {
    const onShowToast = vi.fn();
    app = createApp(() => h(LightboxModal, { item: asset, onShowToast }));
    app.mount(container);
    await nextTick();
    container.querySelector<HTMLButtonElement>('[data-tip*="向右旋转"]')!.click();
    await nextTick();
    container.querySelector<HTMLButtonElement>('.modal-actions .btn-primary')!.click();
    await nextTick();
    expect(downloadRotatedImage).toHaveBeenCalledWith(asset.url, expect.stringMatching(/\.gif$/), 90, 'gif', 'gif');
    expect(onShowToast).toHaveBeenCalledWith('已开始下载原件，GIF/SVG 不应用旋转', 'success');
  });
});
