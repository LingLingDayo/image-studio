export const WHEEL_ADJUST_TIP = '滚轮调整数值\nShift 步进 10 · Ctrl 步进 100';

export interface WheelStepEvent {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function getWheelDeltaStep(event: WheelStepEvent): number {
  // Shift + 滚轮在多数浏览器会把纵向滚动映射到 deltaX
  const delta = event.shiftKey && event.deltaY === 0 ? event.deltaX : event.deltaY;
  if (delta === 0) return 0;
  const direction = delta < 0 ? 1 : -1;
  if (event.ctrlKey || event.metaKey) return direction * 100;
  if (event.shiftKey) return direction * 10;
  return direction;
}

export function applyWheelStep(
  current: number,
  event: WheelStepEvent,
  min: number,
  max: number
): number {
  const step = getWheelDeltaStep(event);
  if (step === 0) return current;
  return Math.min(max, Math.max(min, current + step));
}
