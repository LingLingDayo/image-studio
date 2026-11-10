import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ReferencePreviewModal from './ReferencePreviewModal.vue';
import type { ReferencePreviewItem, TaskReferenceImage } from '@/types/task';

const refs: TaskReferenceImage[] = [1, 2, 3].map((index) => ({
  id: String(index), file: new File(['image'], `ref-${index}.png`, { type: 'image/png' }), previewUrl: `blob:reference-${index}`
}));

describe('ReferencePreviewModal', () => {
  let container: HTMLDivElement;
  let app: App | undefined;
  let launcher: HTMLButtonElement;
  let fullscreenElement: Element | null;
  let requestFullscreen: ReturnType<typeof vi.fn>;
  let exitFullscreen: ReturnType<typeof vi.fn>;
  let originalDocument: Map<string, PropertyDescriptor | undefined>;
  let originalRequest: PropertyDescriptor | undefined;

  function unmountCurrentApp() {
    app?.unmount();
    app = undefined;
  }

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    container = document.createElement('div');
    launcher = document.createElement('button');
    document.body.append(launcher, container);
    fullscreenElement = null;
    originalDocument = new Map(['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen'].map((key) => [key, Object.getOwnPropertyDescriptor(document, key)]));
    originalRequest = Object.getOwnPropertyDescriptor(document.documentElement, 'requestFullscreen');
    requestFullscreen = vi.fn(async () => { fullscreenElement = document.documentElement; document.dispatchEvent(new Event('fullscreenchange')); });
    exitFullscreen = vi.fn(async () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); });
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: requestFullscreen });
  });

  afterEach(() => {
    unmountCurrentApp();
    container.remove();
    launcher.remove();
    document.body.style.overflow = '';
    for (const [key, descriptor] of originalDocument) {
      if (descriptor) Object.defineProperty(document, key, descriptor);
      else Reflect.deleteProperty(document, key);
    }
    if (originalRequest) Object.defineProperty(document.documentElement, 'requestFullscreen', originalRequest);
    else Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  });

  async function mount() {
    const item = ref<ReferencePreviewItem | null>(refs[0]);
    const close = vi.fn(() => { item.value = null; });
    app = createApp(() => h(ReferencePreviewModal, {
      item: item.value, images: refs, 'onUpdate:item': (value: ReferencePreviewItem) => { item.value = value; }, onClose: close
    }));
    app.use(createPinia());
    app.mount(container);
    await nextTick();
    return { item, close };
  }

  function key(value: string) {
    const event = new KeyboardEvent('keydown', { key: value, cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  async function fullscreen() {
    (container.querySelector('[data-tip="全屏显示"]') as HTMLButtonElement).click();
    await nextTick();
    await nextTick();
  }

  it('参考图预览独立呈现，关闭仅触发一次并恢复焦点与滚动', async () => {
    document.body.style.overflow = 'auto';
    launcher.focus();
    const state = await mount();
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('参考图预览');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(container.querySelector('.modal-close-btn'));
    const event = key('Escape');
    await nextTick();
    expect(event.defaultPrevented).toBe(true);
    expect(state.close).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(launcher);
  });

  it('键盘与导航按钮共享当前选择，循环切换并重置视图', async () => {
    const state = await mount();
    (container.querySelector('[data-tip="放大 (滚轮向上)"]') as HTMLButtonElement).click();
    key('ArrowRight');
    await nextTick();
    await nextTick();
    expect(state.item.value?.id).toBe('2');
    expect((container.querySelector('.image-stage') as HTMLElement).style.transform).toContain('scale(1)');
    key('ArrowLeft');
    await nextTick();
    key('ArrowLeft');
    await nextTick();
    expect(state.item.value?.id).toBe('3');
    (container.querySelector('.btn-lightbox-nav.next') as HTMLButtonElement).click();
    await nextTick();
    expect(state.item.value?.id).toBe('1');
  });

  it('输入目标与已处理的键盘事件不会错误切换参考图', async () => {
    const state = await mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      const handled = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
      handled.preventDefault();
      window.dispatchEvent(handled);
      await nextTick();
      expect(state.item.value?.id).toBe('1');
    } finally {
      input.remove();
    }
  });

  it('Tab与Shift+Tab只在参考图预览内循环焦点', async () => {
    await mount();
    const buttons = container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(first);
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(last);
  });
  it('参考图是顶层预览时Escape不会同时关闭更早注册的底层查看器', async () => {
    const lowerViewer = vi.fn();
    window.addEventListener('keydown', lowerViewer);
    try {
      const state = await mount();
      key('Escape');
      await nextTick();
      expect(state.close).toHaveBeenCalledOnce();
      expect(lowerViewer).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', lowerViewer);
    }
  });
  it('页面内全屏时首个Escape只退出全屏，第二次才关闭预览', async () => {
    const state = await mount();
    await fullscreen();
    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(container.querySelector('.ref-preview-backdrop')?.classList.contains('is-fullscreen')).toBe(true);
    key('Escape');
    await nextTick();
    expect(state.close).not.toHaveBeenCalled();
    expect(container.querySelector('.ref-preview-backdrop')?.classList.contains('is-fullscreen')).toBe(false);
    key('Escape');
    await nextTick();
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('原生全屏拒绝时降级页面内全屏，关闭不退出其他原生全屏', async () => {
    localStorage.setItem('gpt_image_preview_fullscreen_mode', 'native');
    requestFullscreen.mockRejectedValueOnce(new Error('denied'));
    const state = await mount();
    await fullscreen();
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(container.querySelector('.is-fullscreen')).not.toBeNull();
    key('Escape');
    await nextTick();
    expect(state.close).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it('原生全屏按钮退出只调用一次API，卸载会清理自身全屏', async () => {
    localStorage.setItem('gpt_image_preview_fullscreen_mode', 'native');
    await mount();
    await fullscreen();
    (container.querySelector('.fullscreen-close-btn') as HTMLButtonElement).click();
    await nextTick();
    expect(exitFullscreen).toHaveBeenCalledOnce();
    await fullscreen();
    unmountCurrentApp();
    expect(exitFullscreen).toHaveBeenCalledTimes(2);
  });

  it('浏览器退出原生全屏会同步组件状态，但不会关闭参考图', async () => {
    localStorage.setItem('gpt_image_preview_fullscreen_mode', 'native');
    const state = await mount();
    await fullscreen();
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    await nextTick();
    expect(container.querySelector('.ref-preview-backdrop')?.classList.contains('is-fullscreen')).toBe(false);
    expect(state.close).not.toHaveBeenCalled();
  });

  it('非全屏时右上角 X 点击后关闭参考图预览', async () => {
    const state = await mount();
    const closeBtn = container.querySelector('.modal-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    await nextTick();
    expect(state.close).toHaveBeenCalledOnce();
  });

  it('全屏时 X 与 Escape 一样只退出全屏而不关闭预览', async () => {
    const state = await mount();
    await fullscreen();
    const closeBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    await nextTick();
    expect(container.querySelector('.ref-preview-backdrop')?.classList.contains('is-fullscreen')).toBe(false);
    expect(state.close).not.toHaveBeenCalled();
  });

  it('不退出非预览组件拥有的原生全屏，迟到全屏请求在卸载后会退出', async () => {
    localStorage.setItem('gpt_image_preview_fullscreen_mode', 'native');
    fullscreenElement = document.createElement('video');
    await mount();
    await fullscreen();
    unmountCurrentApp();
    expect(exitFullscreen).not.toHaveBeenCalled();
    fullscreenElement = null;
    let resolveRequest!: () => void;
    requestFullscreen.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveRequest = resolve; }));
    await mount();
    await fullscreen();
    unmountCurrentApp();
    fullscreenElement = document.documentElement;
    resolveRequest();
    await nextTick();
    await nextTick();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });
});
