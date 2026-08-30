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
});
