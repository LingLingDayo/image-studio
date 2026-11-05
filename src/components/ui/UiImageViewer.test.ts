import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import UiImageViewer from './UiImageViewer.vue';

describe('UiImageViewer (src/components/ui/UiImageViewer.vue)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('作为可复用组件支持直接传入 src 渲染单张图片，且工具栏与视口完整', async () => {
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png',
          alt: '测试图片'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    expect(panel).not.toBeNull();

    const img = container.querySelector('.image-stage img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://example.com/test.png');
    expect(img.alt).toBe('测试图片');

    const toolbar = container.querySelector('.image-floating-toolbar');
    expect(toolbar).not.toBeNull();

    app.unmount();
  });

  it('支持传入 images 数组并展示多图切换控制栏', async () => {
    const currentIndex = ref(0);
    const images = [
      { id: 1, url: 'https://example.com/img1.png', alt: '图1' },
      { id: 2, url: 'https://example.com/img2.png', alt: '图2' }
    ];

    const app = createApp({
      render() {
        return h(UiImageViewer, {
          images,
          currentIndex: currentIndex.value,
          'onUpdate:currentIndex': (idx: number) => {
            currentIndex.value = idx;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const counter = container.querySelector('.lightbox-counter');
    expect(counter?.textContent).toContain('1 / 2');

    const nextBtn = container.querySelector('.btn-lightbox-nav.next') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();
    nextBtn.click();
    await nextTick();

    expect(currentIndex.value).toBe(1);

    app.unmount();
  });

  it('全屏模式下右上角显示退出全屏 X 按钮，点击后取消全屏', async () => {
    const isFullscreen = ref(false);

    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png',
          isFullscreen: isFullscreen.value,
          'onUpdate:isFullscreen': (val: boolean) => {
            isFullscreen.value = val;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    expect(container.querySelector('.fullscreen-close-btn')).toBeNull();

    // 点击工具栏全屏按钮进入全屏
    const fullscreenToggleBtn = container.querySelector('.image-floating-toolbar [data-tip*="全屏"]') as HTMLButtonElement;
    expect(fullscreenToggleBtn).not.toBeNull();
    fullscreenToggleBtn.click();
    await nextTick();

    expect(isFullscreen.value).toBe(true);

    // 重新渲染后检查右上角 X 按钮
    app.unmount();

    const app2 = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png',
          isFullscreen: true,
          'onUpdate:isFullscreen': (val: boolean) => {
            isFullscreen.value = val;
          }
        });
      }
    });
    app2.mount(container);
    await nextTick();

    const closeBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('data-tip')).toContain('退出全屏');

    // 点击右上角 X 按钮，触发取消全屏
    closeBtn.click();
    await nextTick();

    expect(isFullscreen.value).toBe(false);

    app2.unmount();
  });

  it('支持自管理内部缩放与旋转操作', async () => {
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const rotateCwBtn = container.querySelector('.image-floating-toolbar [data-tip*="向右旋转"]') as HTMLButtonElement;
    expect(rotateCwBtn).not.toBeNull();

    const img = container.querySelector('.image-stage img') as HTMLImageElement;
    expect(img.style.transform).toContain('rotate(0deg)');

    rotateCwBtn.click();
    await nextTick();
    expect(img.style.transform).toContain('rotate(90deg)');

    app.unmount();
  });

  it('非受控模式下统一使用页面内全屏，且支持右上角退出按钮和 Escape 键退出全屏', async () => {
    let exitFullscreenEmitted = false;
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png',
          onExitFullscreen: () => {
            exitFullscreenEmitted = true;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    expect(panel.classList.contains('is-fullscreen')).toBe(false);
    expect(container.querySelector('.fullscreen-close-btn')).toBeNull();

    // 点击工具栏全屏按钮进入全屏
    const fullscreenToggleBtn = container.querySelector('.image-floating-toolbar [data-tip*="全屏"]') as HTMLButtonElement;
    fullscreenToggleBtn.click();
    await nextTick();

    expect(panel.classList.contains('is-fullscreen')).toBe(true);
    const closeBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn.getAttribute('data-tip')).toContain('退出全屏');

    // 按 Escape 键退出全屏
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escEvent);
    await nextTick();

    expect(panel.classList.contains('is-fullscreen')).toBe(false);
    expect(container.querySelector('.fullscreen-close-btn')).toBeNull();
    expect(exitFullscreenEmitted).toBe(true);

    // 再次点击全屏，通过右上角 X 按钮退出
    fullscreenToggleBtn.click();
    await nextTick();
    expect(panel.classList.contains('is-fullscreen')).toBe(true);

    const closeBtn2 = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    closeBtn2.click();
    await nextTick();

    expect(panel.classList.contains('is-fullscreen')).toBe(false);

    app.unmount();
  });
});
