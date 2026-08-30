import { ref, type Ref } from 'vue';

export interface ViewportCanvasOptions {
  minScale?: number;
  maxScale?: number;
}

export function useViewportCanvas(panelRef: Ref<HTMLElement | null>, options: ViewportCanvasOptions = {}) {
  const minScale = options.minScale ?? 0.2;
  const maxScale = options.maxScale ?? 20;

  const scale = ref(1);
  const translateX = ref(0);
  const translateY = ref(0);
  const rotation = ref(0);
  const isDragging = ref(false);

  let startDragX = 0;
  let startDragY = 0;
  let startTranslateX = 0;
  let startTranslateY = 0;

  /**
   * 以指定屏幕相对坐标 (pivotX, pivotY) 为锚点进行等比缩放
   */
  function zoomTo(newScale: number, pivotX: number, pivotY: number) {
    const currentScale = scale.value;
    const clampedScale = Math.min(Math.max(newScale, minScale), maxScale);
    if (clampedScale === currentScale) return;

    if (!panelRef.value) {
      scale.value = clampedScale;
      return;
    }

    const rect = panelRef.value.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const mouseCenterX = pivotX - centerX;
    const mouseCenterY = pivotY - centerY;

    const ratio = clampedScale / currentScale;
    translateX.value = mouseCenterX - (mouseCenterX - translateX.value) * ratio;
    translateY.value = mouseCenterY - (mouseCenterY - translateY.value) * ratio;
    scale.value = clampedScale;
  }

  function handleWheel(e: WheelEvent) {
    if (!panelRef.value) return;
    const rect = panelRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = Math.max(-80, Math.min(80, e.deltaY));
    const factor = Math.exp(-delta * 0.003);
    const targetScale = scale.value * factor;

    zoomTo(targetScale, mouseX, mouseY);
  }

  function zoomIn() {
    if (!panelRef.value) return;
    const rect = panelRef.value.getBoundingClientRect();
    zoomTo(scale.value * 1.25, rect.width / 2, rect.height / 2);
  }

  function zoomOut() {
    if (!panelRef.value) return;
    const rect = panelRef.value.getBoundingClientRect();
    zoomTo(scale.value / 1.25, rect.width / 2, rect.height / 2);
  }

  function resetScale() {
    const clampedScale = Math.min(Math.max(1, minScale), maxScale);
    scale.value = clampedScale;
  }

  function resetView() {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }

  function rotateCw() {
    rotation.value = (rotation.value + 90) % 360;
  }

  function handleDoubleClick(e: MouseEvent) {
    if (!panelRef.value) return;
    const rect = panelRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (Math.abs(scale.value - 1) < 0.05 && Math.abs(translateX.value) < 2 && Math.abs(translateY.value) < 2) {
      zoomTo(2, mouseX, mouseY);
    } else {
      resetView();
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return;

    isDragging.value = true;
    startDragX = e.clientX;
    startDragY = e.clientY;
    startTranslateX = translateX.value;
    startTranslateY = translateY.value;

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!isDragging.value) return;
    translateX.value = startTranslateX + (e.clientX - startDragX);
    translateY.value = startTranslateY + (e.clientY - startDragY);
  }

  function onMouseUp() {
    isDragging.value = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function resetTransform() {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    rotation.value = 0;
  }

  return {
    scale,
    translateX,
    translateY,
    rotation,
    isDragging,
    zoomTo,
    zoomIn,
    zoomOut,
    resetScale,
    resetView,
    resetTransform,
    rotateCw,
    handleWheel,
    handleMouseDown,
    handleDoubleClick
  };
}
