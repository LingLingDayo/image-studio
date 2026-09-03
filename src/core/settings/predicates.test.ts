import { describe, it, expect } from 'vitest';
import { evaluatePredicate, getPath, isTruthy } from './predicates';
import type { SettingsContext } from './types';

const ctx: SettingsContext = {
  values: {
    'optimizer.apiKey': 'sk-test',
    'optimizer.model': '',
    'image.baseUrl': 'https://api.example.com'
  },
  runtime: {
    'optimizer.models': ['gpt-5.6-terra', 'gpt-4o'],
    'optimizer.fetchStatus': { type: 'success', message: 'ok' },
    'optimizer.isFetching': false
  },
  locks: {
    'image.baseUrl': true,
    'image.apiKey': false
  }
};

describe('settings predicates', () => {
  it('resolves dotted keys before nested remainder paths', () => {
    expect(getPath(ctx.values, 'optimizer.apiKey')).toBe('sk-test');
    expect(getPath(ctx.runtime, 'optimizer.fetchStatus.type')).toBe('success');
    expect(getPath(ctx.runtime, 'optimizer.models')).toEqual(['gpt-5.6-terra', 'gpt-4o']);
  });

  it('treats blank strings and empty arrays as falsy', () => {
    expect(isTruthy('')).toBe(false);
    expect(isTruthy('  ')).toBe(false);
    expect(isTruthy([])).toBe(false);
    expect(isTruthy(['a'])).toBe(true);
    expect(isTruthy('sk')).toBe(true);
  });

  it('evaluates field / runtime / lock predicates', () => {
    expect(evaluatePredicate({ field: 'optimizer.apiKey', truthy: true }, ctx)).toBe(true);
    expect(evaluatePredicate({ field: 'optimizer.model', falsy: true }, ctx)).toBe(true);
    expect(evaluatePredicate({ runtime: 'optimizer.fetchStatus.type', eq: 'success' }, ctx)).toBe(true);
    expect(evaluatePredicate({ runtime: 'optimizer.models', truthy: true }, ctx)).toBe(true);
    expect(evaluatePredicate({ lock: 'image.baseUrl', eq: true }, ctx)).toBe(true);
    expect(evaluatePredicate({ lock: 'image.apiKey', eq: false }, ctx)).toBe(true);
  });

  it('composes and / or / not', () => {
    expect(
      evaluatePredicate(
        {
          and: [
            { field: 'optimizer.apiKey', truthy: true },
            { not: { lock: 'image.apiKey', eq: true } }
          ]
        },
        ctx
      )
    ).toBe(true);

    expect(
      evaluatePredicate(
        {
          or: [{ field: 'optimizer.model', truthy: true }, { lock: 'image.baseUrl', eq: true }]
        },
        ctx
      )
    ).toBe(true);

    expect(evaluatePredicate({ not: { lock: 'image.baseUrl', eq: true } }, ctx)).toBe(false);
  });

  it('treats missing predicate as visible', () => {
    expect(evaluatePredicate(undefined, ctx)).toBe(true);
  });
});
