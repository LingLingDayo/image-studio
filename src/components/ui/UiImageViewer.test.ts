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

  it('非受控模式下指针拖拽可平移画布，松开后结束拖拽', async () => {
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
    const stage = container.querySelector('.image-stage') as HTMLElement;
    expect(stage.style.transform).toContain('translate(0px, 0px)');

    panel.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1, pointerType: 'mouse', button: 0,
      clientX: 100, clientY: 100, bubbles: true, cancelable: true
    }));
    window.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1, pointerType: 'mouse', button: 0,
      clientX: 160, clientY: 140, bubbles: true, cancelable: true
    }));
    await nextTick();

    expect(stage.style.transform).toContain('translate(60px, 40px)');
    expect(panel.classList.contains('is-dragging')).toBe(true);

    window.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true
    }));
    await nextTick();
    expect(panel.classList.contains('is-dragging')).toBe(false);

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

  it('开启顶部操作栏时展示收藏、下载与删除按钮并正确派发事件与拦截拖拽冒泡', async () => {
    const isFav = ref(false);
    let favCount = 0;
    let downloadCount = 0;
    let deleteCount = 0;

    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/1.png',
          showFavorite: true,
          isFavorite: isFav.value,
          showDownload: true,
          showDelete: true,
          onToggleFavorite: () => {
            favCount++;
            isFav.value = !isFav.value;
          },
          onDownload: () => {
            downloadCount++;
          },
          onDelete: () => {
            deleteCount++;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const actionBar = container.querySelector('.viewer-top-actions') as HTMLDivElement;
    expect(actionBar).not.toBeNull();

    const favBtn = actionBar.querySelector('.btn-favorite') as HTMLButtonElement;
    const downloadBtn = actionBar.querySelector('.btn-download') as HTMLButtonElement;
    const deleteBtn = actionBar.querySelector('.btn-delete') as HTMLButtonElement;

    expect(favBtn.getAttribute('aria-pressed')).toBe('false');
    expect(favBtn.getAttribute('data-tip')).toBe('收藏此图');

    // 验证指针事件不会冒泡触发画布拖拽
    let bubbled = 0;
    panel.addEventListener('pointerdown', () => { bubbled++; });
    panel.addEventListener('mousedown', () => { bubbled++; });
    favBtn.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
    favBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(bubbled).toBe(0);

    favBtn.click();
    await nextTick();
    expect(favCount).toBe(1);
    expect(favBtn.classList.contains('is-favorite')).toBe(true);
    expect(favBtn.getAttribute('aria-pressed')).toBe('true');
    expect(favBtn.getAttribute('data-tip')).toBe('取消收藏');

    downloadBtn.click();
    deleteBtn.click();
    await nextTick();
    expect(downloadCount).toBe(1);
    expect(deleteCount).toBe(1);

    app.unmount();
  });

  it('图片失败态下禁用下载按钮时仍保留删除按钮可点击', async () => {
    let downloadCount = 0;
    let deleteCount = 0;

    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: '',
          status: 'failed',
          errorMessage: '生成失败',
          showFavorite: false,
          showDownload: true,
          downloadDisabled: true,
          showDelete: true,
          onDownload: () => { downloadCount++; },
          onDelete: () => { deleteCount++; }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const actionBar = container.querySelector('.viewer-top-actions') as HTMLDivElement;
    expect(actionBar).not.toBeNull();
    expect(actionBar.querySelector('.btn-favorite')).toBeNull();

    const downloadBtn = actionBar.querySelector('.btn-download') as HTMLButtonElement;
    const deleteBtn = actionBar.querySelector('.btn-delete') as HTMLButtonElement;
    expect(downloadBtn.disabled).toBe(true);
    downloadBtn.click();
    deleteBtn.click();
    await nextTick();

    expect(downloadCount).toBe(0);
    expect(deleteCount).toBe(1);

    app.unmount();
  });

  it('在图片查看器中右键显示菜单面板，支持复制与删除操作及多种关闭方式', async () => {
    const originalClipboard = navigator.clipboard;
    const originalClipboardItem = globalThis.ClipboardItem;
    const write = vi.fn().mockResolvedValue(undefined);
    class MockClipboardItem {
      readonly items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write } });
    Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, writable: true, value: MockClipboardItem });

    let copyCount = 0;
    let deleteCount = 0;
    const toasts: Array<{ msg: string; type: string }> = [];
    const blob = new Blob(['png-bytes'], { type: 'image/png' });

    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'blob:viewer-png',
          blob,
          showDelete: true,
          onCopy: () => { copyCount++; },
          onDelete: () => { deleteCount++; },
          onShowToast: (msg: string, type: string) => { toasts.push({ msg, type }); }
        });
      }
    });

    try {
      app.mount(container);
      await nextTick();

      const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
      panel.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => {}
      });

      expect(container.querySelector('.viewer-context-menu')).toBeNull();

      // 靠近右下角右键时自动夹紧在视口范围以内
      const ctxEvent = new MouseEvent('contextmenu', {
        clientX: 390,
        clientY: 290,
        bubbles: true,
        cancelable: true
      });
      panel.dispatchEvent(ctxEvent);
      await nextTick();
      await nextTick();

      expect(ctxEvent.defaultPrevented).toBe(true);
      const menu = container.querySelector('.viewer-context-menu') as HTMLDivElement;
      expect(menu).not.toBeNull();
      expect(parseFloat(menu.style.left)).toBeLessThanOrEqual(244);
      expect(parseFloat(menu.style.top)).toBeLessThanOrEqual(200);

      const items = menu.querySelectorAll<HTMLButtonElement>('.viewer-context-item');
      expect(items).toHaveLength(2);
      expect(items[0].textContent?.trim()).toBe('复制');
      expect(items[1].textContent?.trim()).toBe('删除');

      // 点击复制
      items[0].click();
      await nextTick();
      await vi.waitFor(() => expect(copyCount).toBe(1));
      expect(write).toHaveBeenCalledTimes(1);
      expect(toasts).toContainEqual({ msg: '图片已复制到剪贴板', type: 'success' });
      expect(container.querySelector('.viewer-context-menu')).toBeNull();

      // 再次右键打开菜单，点击删除
      panel.dispatchEvent(new MouseEvent('contextmenu', { clientX: 60, clientY: 80, bubbles: true, cancelable: true }));
      await nextTick();
      const deleteMenuBtn = container.querySelectorAll<HTMLButtonElement>('.viewer-context-item')[1];
      deleteMenuBtn.click();
      await nextTick();
      expect(deleteCount).toBe(1);
      expect(container.querySelector('.viewer-context-menu')).toBeNull();

      // 再次右键打开菜单，按 Escape 只关闭右键菜单而不退出全屏
      const fullscreenBtn = container.querySelector('.image-floating-toolbar [data-tip="全屏显示"]') as HTMLButtonElement;
      fullscreenBtn.click();
      await nextTick();
      expect(panel.classList.contains('is-fullscreen')).toBe(true);

      panel.dispatchEvent(new MouseEvent('contextmenu', { clientX: 60, clientY: 80, bubbles: true, cancelable: true }));
      await nextTick();
      expect(container.querySelector('.viewer-context-menu')).not.toBeNull();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await nextTick();
      expect(container.querySelector('.viewer-context-menu')).toBeNull();
      expect(panel.classList.contains('is-fullscreen')).toBe(true);

      // 滚轮滚动或点击画布外部区域也关闭右键菜单
      panel.dispatchEvent(new MouseEvent('contextmenu', { clientX: 60, clientY: 80, bubbles: true, cancelable: true }));
      await nextTick();
      panel.dispatchEvent(new WheelEvent('wheel', { deltaY: -50, bubbles: true, cancelable: true }));
      await nextTick();
      expect(container.querySelector('.viewer-context-menu')).toBeNull();
    } finally {
      app.unmount();
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
      if (originalClipboardItem !== undefined) {
        Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, writable: true, value: originalClipboardItem });
      } else {
        Reflect.deleteProperty(globalThis, 'ClipboardItem');
      }
    }
  });

  it('失败状态的图片右键菜单禁用复制并保留删除可用', async () => {
    let deleteCount = 0;
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: '',
          status: 'failed',
          errorMessage: '生图失败',
          showDelete: true,
          onDelete: () => { deleteCount++; }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    panel.dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 40, bubbles: true, cancelable: true }));
    await nextTick();

    const items = container.querySelectorAll<HTMLButtonElement>('.viewer-context-item');
    expect(items).toHaveLength(2);
    expect(items[0].disabled).toBe(true);
    expect(items[1].disabled).toBe(false);

    items[1].click();
    await nextTick();
    expect(deleteCount).toBe(1);

    app.unmount();
  });

  it('顶部操作栏在删除按钮前展示分隔线，鼠标悬停工具栏期间暂停自动隐藏', async () => {
    vi.useFakeTimers();
    const app = createApp({
      render() {
        return h(UiImageViewer, {
          src: 'https://example.com/1.png',
          showFavorite: true,
          showDownload: true,
          showDelete: true
        });
      }
    });

    app.mount(container);
    await nextTick();

    const actionBar = container.querySelector('.viewer-top-actions') as HTMLDivElement;
    expect(actionBar.querySelector('.action-divider')).not.toBeNull();

    const panel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;
    panel.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 悬停到工具栏上，超过 4s 仍保持显示
    toolbar.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    vi.advanceTimersByTime(5000);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(true);

    // 离开工具栏后重新倒计时 4s 自动隐藏
    toolbar.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    vi.advanceTimersByTime(4000);
    await nextTick();
    expect(toolbar.classList.contains('is-visible')).toBe(false);

    app.unmount();
    vi.useRealTimers();
  });
});
