import type { SettingPredicate, SettingsContext } from './types';

/**
 * 从扁平或嵌套字典取值。
 * 优先整键命中（如 `optimizer.apiKey`），再尝试最长前缀 + 剩余路径（如 `optimizer.fetchStatus.type`）。
 */
export function getPath(source: Record<string, unknown>, path: string): unknown {
  if (path in source) {
    return source[path];
  }

  const parts = path.split('.');
  for (let i = parts.length - 1; i >= 1; i--) {
    const key = parts.slice(0, i).join('.');
    if (!(key in source)) continue;

    let current: unknown = source[key];
    for (let j = i; j < parts.length; j++) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[parts[j]];
    }
    return current;
  }

  return undefined;
}

export function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function matchValue(
  actual: unknown,
  pred: { eq?: unknown; neq?: unknown; truthy?: boolean; falsy?: boolean }
): boolean {
  if (pred.eq !== undefined) return actual === pred.eq;
  if (pred.neq !== undefined) return actual !== pred.neq;
  if (pred.truthy === true) return isTruthy(actual);
  if (pred.truthy === false) return !isTruthy(actual);
  if (pred.falsy === true) return !isTruthy(actual);
  if (pred.falsy === false) return isTruthy(actual);
  return isTruthy(actual);
}

export function evaluatePredicate(
  pred: SettingPredicate | undefined,
  ctx: SettingsContext
): boolean {
  if (!pred) return true;

  if ('and' in pred) {
    return pred.and.every((item) => evaluatePredicate(item, ctx));
  }
  if ('or' in pred) {
    return pred.or.some((item) => evaluatePredicate(item, ctx));
  }
  if ('not' in pred) {
    return !evaluatePredicate(pred.not, ctx);
  }
  if ('lock' in pred) {
    const locked = ctx.locks[pred.lock] === true;
    if (pred.eq === undefined) return locked;
    return locked === pred.eq;
  }
  if ('field' in pred) {
    return matchValue(getPath(ctx.values, pred.field), pred);
  }
  if ('runtime' in pred) {
    return matchValue(getPath(ctx.runtime, pred.runtime), pred);
  }

  return true;
}
