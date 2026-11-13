import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('预览区域内鼠标移动激活工具栏，静止 4 秒后工具栏自动消失收起', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;
    expect(toolbar).not.toBeNull();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    // 鼠标移入并移动，工具栏显示
    panel.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 鼠标静止 3.9 秒，工具栏仍应显示
    vi.advanceTimersByTime(3900);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 鼠标静止满 4 秒后，工具栏消失收起
    vi.advanceTimersByTime(100);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    // 鼠标再次移动，工具栏重新唤起并重新倒计时
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 再次静止 4 秒后收起
    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    app.unmount();
    vi.useRealTimers();
  });

  it('鼠标离开预览区域时立即收起工具栏', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;

    // 鼠标移动显示
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 鼠标移出预览区域，立即收起
    panel.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    app.unmount();
    vi.useRealTimers();
  });

  it('全屏模式下鼠标静止 4 秒同样会自动消失收起', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/test.png',
          isFullscreen: true
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    expect(panel.classList.contains('is-fullscreen')).toBe(true);
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;

    // 全屏下鼠标移动显示工具栏
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 全屏下鼠标静止 4 秒自动收起
    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    // 全屏下鼠标再次移动重新显示
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    app.unmount();
    vi.useRealTimers();
  });

  it('全屏退出按钮的指针事件不冒泡到画布，点击可正常退出全屏', async () => {
    const isFullscreen = ref(true);
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

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const closeBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    // 真实浏览器里容器 setPointerCapture 会把 click 派发到容器，因此按钮必须截断指针事件
    let bubbled = 0;
    panel.addEventListener('pointerdown', () => { bubbled++; });
    panel.addEventListener('mousedown', () => { bubbled++; });
    closeBtn.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    closeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await nextTick();
    expect(bubbled).toBe(0);

    closeBtn.click();
    await nextTick();
    expect(isFullscreen.value).toBe(false);

    app.unmount();
  });

  it('按 Escape 退出全屏后不会在全屏按钮上残留焦点描边', async () => {
    const app = createApp({
      render() {
        return h(UiImageViewer, { src: 'https://example.com/test.png' });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const fullscreenBtn = container.querySelector('.image-floating-toolbar [data-tip="全屏显示"]') as HTMLButtonElement;
    fullscreenBtn.click();
    await nextTick();
    expect(panel.classList.contains('is-fullscreen')).toBe(true);

    fullscreenBtn.focus();
    expect(document.activeElement).toBe(fullscreenBtn);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();

    expect(panel.classList.contains('is-fullscreen')).toBe(false);
    expect(document.activeElement).not.toBe(fullscreenBtn);

    app.unmount();
  });

  it('非受控多图模式下可直接通过按钮与方向键循环切图', async () => {
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          images: [
            'https://example.com/1.png',
            'https://example.com/2.png',
            'https://example.com/3.png'
          ]
        });
      }
    });

    app.mount(container);
    await nextTick();

    const img = container.querySelector('.image-stage img') as HTMLImageElement;
    const counter = container.querySelector('.lightbox-counter') as HTMLElement;
    expect(counter.textContent).toBe('1 / 3');
    expect(img.src).toBe('https://example.com/1.png');

    // 点击右侧切换按钮切到第 2 张
    const nextSideBtn = container.querySelector('.viewer-side-nav.is-next') as HTMLButtonElement;
    expect(nextSideBtn).not.toBeNull();
    nextSideBtn.click();
    await nextTick();
    expect(counter.textContent).toBe('2 / 3');
    expect(img.src).toBe('https://example.com/2.png');

    // 按方向键向右切到第 3 张，再按一次循环回第 1 张
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await nextTick();
    expect(counter.textContent).toBe('3 / 3');
    expect(img.src).toBe('https://example.com/3.png');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    await nextTick();
    expect(counter.textContent).toBe('2 / 3');
    expect(img.src).toBe('https://example.com/2.png');

    app.unmount();
  });

  it('独立查看器模式左右切图按钮与底部工具栏同步在静止 4 秒后自动隐藏', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          images: [
            { id: 1, url: 'https://example.com/1.png' },
            { id: 2, url: 'https://example.com/2.png' }
          ]
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;
    const prevSideBtn = container.querySelector('.viewer-side-nav.is-prev') as HTMLButtonElement;
    const nextSideBtn = container.querySelector('.viewer-side-nav.is-next') as HTMLButtonElement;

    expect(prevSideBtn).not.toBeNull();
    expect(nextSideBtn).not.toBeNull();
    expect(prevSideBtn.classList.contains('is-visible')).toBe(false);
    expect(nextSideBtn.classList.contains('is-visible')).toBe(false);

    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);
    expect(prevSideBtn.classList.contains('is-visible')).toBe(true);
    expect(nextSideBtn.classList.contains('is-visible')).toBe(true);

    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);
    expect(prevSideBtn.classList.contains('is-visible')).toBe(false);
    expect(nextSideBtn.classList.contains('is-visible')).toBe(false);

    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(prevSideBtn.classList.contains('is-visible')).toBe(true);

    panel.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    await nextTick();
    expect(prevSideBtn.classList.contains('is-visible')).toBe(false);
    expect(nextSideBtn.classList.contains('is-visible')).toBe(false);

    app.unmount();
    vi.useRealTimers();
  });

  it('嵌入式模式不显示左右切图按钮，进入全屏后显示并随工具栏自动隐藏', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          standalone: false,
          images: [
            { id: 1, url: 'https://example.com/1.png' },
            { id: 2, url: 'https://example.com/2.png' }
          ]
        });
      }
    });

    app.mount(container);
    await nextTick();

    // 嵌入式非全屏：保留左上角多图胶囊，但不显示左右切图按钮
    expect(container.querySelector('.lightbox-carousel-controls')).not.toBeNull();
    expect(container.querySelector('.viewer-side-nav')).toBeNull();

    // 进入全屏：显示左右切图按钮，且静止 4 秒自动隐藏
    const fullscreenBtn = container.querySelector('.image-floating-toolbar [data-tip="全屏显示"]') as HTMLButtonElement;
    fullscreenBtn.click();
    await nextTick();

    const prevSideBtn = container.querySelector('.viewer-side-nav.is-prev') as HTMLButtonElement;
    const nextSideBtn = container.querySelector('.viewer-side-nav.is-next') as HTMLButtonElement;
    expect(prevSideBtn).not.toBeNull();
    expect(nextSideBtn).not.toBeNull();
    expect(prevSideBtn.classList.contains('is-visible')).toBe(true);

    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(prevSideBtn.classList.contains('is-visible')).toBe(false);
    expect(nextSideBtn.classList.contains('is-visible')).toBe(false);

    app.unmount();
    vi.useRealTimers();
  });
});
