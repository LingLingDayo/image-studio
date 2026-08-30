import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useViewportCanvas } from './useViewportCanvas';

describe('useViewportCanvas (useViewportCanvas.ts)', () => {
  it('should initialize with default 100% scale and 0 rotation', () => {
    const dummyRef = ref<HTMLElement | null>(null);
    const canvas = useViewportCanvas(dummyRef);

    expect(canvas.scale.value).toBe(1);
    expect(canvas.translateX.value).toBe(0);
    expect(canvas.translateY.value).toBe(0);
    expect(canvas.rotation.value).toBe(0);
  });

  it('should rotate 90 degrees clockwise and cycle', () => {
    const dummyRef = ref<HTMLElement | null>(null);
    const canvas = useViewportCanvas(dummyRef);

    canvas.rotateCw();
    expect(canvas.rotation.value).toBe(90);

    canvas.rotateCw();
    expect(canvas.rotation.value).toBe(180);

    canvas.rotateCw();
    expect(canvas.rotation.value).toBe(270);

    canvas.rotateCw();
    expect(canvas.rotation.value).toBe(0);
  });

  it('should clamp zoom scale between min and max bounds', () => {
    const dummyRef = ref<HTMLElement | null>(null);
    const canvas = useViewportCanvas(dummyRef, { minScale: 0.5, maxScale: 5 });

    canvas.zoomTo(0.1, 0, 0);
    expect(canvas.scale.value).toBe(0.5);

    canvas.zoomTo(10, 0, 0);
    expect(canvas.scale.value).toBe(5);
  });

  it('should reset view transform correctly', () => {
    const dummyRef = ref<HTMLElement | null>(null);
    const canvas = useViewportCanvas(dummyRef);

    canvas.rotateCw();
    canvas.translateX.value = 50;
    canvas.translateY.value = 100;
    canvas.scale.value = 2;

    canvas.resetTransform();
    expect(canvas.scale.value).toBe(1);
    expect(canvas.translateX.value).toBe(0);
    expect(canvas.translateY.value).toBe(0);
    expect(canvas.rotation.value).toBe(0);
  });

  it('should reset scale based on image center while preserving translation', () => {
    const dummyRef = ref<HTMLElement | null>(null);
    const canvas = useViewportCanvas(dummyRef);

    canvas.translateX.value = 120;
    canvas.translateY.value = -80;
    canvas.scale.value = 3.5;

    // resetScale 仅重置缩放比例，保持当前的平移位置不变（以图片中心缩放）
    canvas.resetScale();
    expect(canvas.scale.value).toBe(1);
    expect(canvas.translateX.value).toBe(120);
    expect(canvas.translateY.value).toBe(-80);

    // resetView 重置缩放并归零平移（100% 居中）
    canvas.resetView();
    expect(canvas.scale.value).toBe(1);
    expect(canvas.translateX.value).toBe(0);
    expect(canvas.translateY.value).toBe(0);
  });
});
