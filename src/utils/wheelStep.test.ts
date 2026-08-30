import { describe, it, expect } from 'vitest';
import { applyWheelStep, getWheelDeltaStep, WHEEL_ADJUST_TIP } from './wheelStep';

function wheel(partial: Partial<Parameters<typeof getWheelDeltaStep>[0]> = {}) {
  return {
    deltaX: 0,
    deltaY: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...partial
  };
}

describe('wheelStep (wheelStep.ts)', () => {
  it('should expose a multi-line wheel hint for tooltips', () => {
    expect(WHEEL_ADJUST_TIP).toContain('滚轮调整');
    expect(WHEEL_ADJUST_TIP).toContain('Shift');
    expect(WHEEL_ADJUST_TIP).toContain('Ctrl');
  });

  it('should step by 1 by default, 10 with Shift, 100 with Ctrl', () => {
    expect(getWheelDeltaStep(wheel({ deltaY: -120 }))).toBe(1);
    expect(getWheelDeltaStep(wheel({ deltaY: 120 }))).toBe(-1);
    expect(getWheelDeltaStep(wheel({ deltaY: -120, shiftKey: true }))).toBe(10);
    expect(getWheelDeltaStep(wheel({ deltaY: 120, shiftKey: true }))).toBe(-10);
    expect(getWheelDeltaStep(wheel({ deltaY: -120, ctrlKey: true }))).toBe(100);
    expect(getWheelDeltaStep(wheel({ deltaY: 120, metaKey: true }))).toBe(-100);
  });

  it('should prefer Ctrl over Shift when both modifiers are held', () => {
    expect(getWheelDeltaStep(wheel({ deltaY: -120, ctrlKey: true, shiftKey: true }))).toBe(100);
  });

  it('should read deltaX when Shift remaps vertical wheel to horizontal', () => {
    expect(getWheelDeltaStep(wheel({ deltaX: -120, deltaY: 0, shiftKey: true }))).toBe(10);
    expect(getWheelDeltaStep(wheel({ deltaX: 80, deltaY: 0, shiftKey: true }))).toBe(-10);
  });

  it('should return 0 when there is no wheel delta', () => {
    expect(getWheelDeltaStep(wheel())).toBe(0);
    expect(applyWheelStep(32, wheel(), 1, 100)).toBe(32);
  });

  it('should clamp the adjusted value to min and max', () => {
    expect(applyWheelStep(1, wheel({ deltaY: 120 }), 1, 4)).toBe(1);
    expect(applyWheelStep(4, wheel({ deltaY: -120, shiftKey: true }), 1, 4)).toBe(4);
    expect(applyWheelStep(50, wheel({ deltaY: -120, ctrlKey: true }), 1, 80)).toBe(80);
    expect(applyWheelStep(1024, wheel({ deltaY: 120, ctrlKey: true }), 1, 8192)).toBe(924);
  });
});
