import { ref, onUnmounted, getCurrentInstance, type Ref } from 'vue';

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
  let activePointerId: number | null = null;

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

  function beginDrag(clientX: number, clientY: number) {
    isDragging.value = true;
    startDragX = clientX;
    startDragY = clientY;
    startTranslateX = translateX.value;
    startTranslateY = translateY.value;
  }

  function applyDrag(clientX: number, clientY: number) {
    if (!isDragging.value) return;
    translateX.value = startTranslateX + (clientX - startDragX);
    translateY.value = startTranslateY + (clientY - startDragY);
  }

  function stopDrag() {
    isDragging.value = false;
    activePointerId = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (e.cancelable) e.preventDefault();

    beginDrag(e.clientX, e.clientY);
    activePointerId = e.pointerId;

    const target = e.currentTarget;
    if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // 部分测试环境不支持 pointer capture
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e: PointerEvent) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    if (e.cancelable) e.preventDefault();
    applyDrag(e.clientX, e.clientY);
  }

  function onPointerUp(e: PointerEvent) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    stopDrag();
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    if (isDragging.value) return;

    beginDrag(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    applyDrag(e.clientX, e.clientY);
  }

  function onMouseUp() {
    stopDrag();
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      stopDrag();
    });
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
    handlePointerDown,
    handleMouseDown,
    handleDoubleClick
  };
}
