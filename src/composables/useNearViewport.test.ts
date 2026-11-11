import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, ref, nextTick } from 'vue';
import { useNearViewport, LAZY_IMAGE_ROOT_MARGIN } from './useNearViewport';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: ObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  takeRecords() { return []; }
}

function mountComposable(onEnter: () => void) {
  const target = ref<HTMLElement | null>(null);
  let controls!: ReturnType<typeof useNearViewport>;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    setup() {
      controls = useNearViewport(target, onEnter);
      return () => h('div', { ref: target });
    }
  });
  app.mount(container);
  return { app, container, target, get controls() { return controls; } };
}

describe('useNearViewport 视口预取观察', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 120, height: 120, top: 0, left: 0, right: 120, bottom: 120, x: 0, y: 0,
      toJSON: () => ({})
    } as DOMRect);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('仅当元素进入预取区域时才触发，且只触发一次', async () => {
    const onEnter = vi.fn();
    const { app, container, target } = mountComposable(onEnter);
    await nextTick();

    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeDefined();
    expect(observer.options?.rootMargin).toBe(LAZY_IMAGE_ROOT_MARGIN);
    expect(observer.observed).toContain(target.value);

    observer.callback([{ isIntersecting: false }]);
    expect(onEnter).not.toHaveBeenCalled();

    observer.callback([{ isIntersecting: true }]);
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);

    onEnter.mockClear();
    observer.callback([{ isIntersecting: true }]);
    expect(onEnter).not.toHaveBeenCalled();

    app.unmount();
    container.remove();
  });

  it('切换到另一张图片后 reset 可重新武装观察', async () => {
    const onEnter = vi.fn();
    const { app, container, controls } = mountComposable(onEnter);
    await nextTick();

    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true }]);
    expect(onEnter).toHaveBeenCalledTimes(1);

    controls.reset();
    const second = FakeIntersectionObserver.instances[1];
    expect(second).toBeDefined();
    second.callback([{ isIntersecting: true }]);
    expect(onEnter).toHaveBeenCalledTimes(2);

    app.unmount();
    container.remove();
  });

  it('缺少观察能力时立即加载，避免图片永久停留在占位', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onEnter = vi.fn();
    const { app, container } = mountComposable(onEnter);
    await nextTick();

    expect(onEnter).toHaveBeenCalledTimes(1);

    app.unmount();
    container.remove();
  });
});
