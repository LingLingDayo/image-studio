import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';

/** 进入视口前的预取距离，约一到两行卡片，保证滚动到位时图片已就绪。 */
export const LAZY_IMAGE_ROOT_MARGIN = '400px 0px';

/**
 * 目标进入视口附近的预取区域时触发一次回调。
 * reset() 用于同一元素切换到另一张图片时重新武装观察。
 */
export function useNearViewport(
  target: Ref<HTMLElement | null>,
  onEnter: () => void,
  rootMargin: string = LAZY_IMAGE_ROOT_MARGIN
) {
  let observer: IntersectionObserver | null = null;
  let observedEl: HTMLElement | null = null;
  let armed = true;

  function disconnect() {
    observer?.disconnect();
    observer = null;
    observedEl = null;
  }

  function trigger() {
    if (!armed) return;
    armed = false;
    disconnect();
    onEnter();
  }

  function observe() {
    const el = target.value;
    if (observer && observedEl === el) return;
    disconnect();
    if (!armed || !el) return;
    // 缺少观察 API 或元素尚未产生布局时无法可靠判断视口，直接加载作为降级
    const rect = el.getBoundingClientRect();
    if (typeof IntersectionObserver === 'undefined' || (!rect.width && !rect.height)) {
      trigger();
      return;
    }
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) trigger();
    }, { rootMargin });
    observedEl = el;
    observer.observe(el);
  }

  function reset() {
    armed = true;
    observe();
  }

  onMounted(observe);
  watch(target, observe);
  onBeforeUnmount(disconnect);

  return { reset };
}
