import { describe, it, expect } from 'vitest';
import { providerRegistry } from './ProviderRegistry';
import type { IImageProviderAdapter } from '@/types/provider';

describe('ProviderRegistry (ProviderRegistry.ts)', () => {
  it('should retrieve default openai-compatible adapter', () => {
    const adapter = providerRegistry.get('openai-compatible');
    expect(adapter).toBeDefined();
    expect(adapter.providerId).toBe('openai-compatible');
  });

  it('should fallback to default adapter for unknown provider type', () => {
    const fallback = providerRegistry.get('unknown-provider');
    expect(fallback).toBeDefined();
    expect(fallback.providerId).toBe('openai-compatible');
  });

  it('should allow dynamically registering custom provider adapter', () => {
    const customAdapter: IImageProviderAdapter = {
      providerId: 'mock-custom-provider',
      name: 'Mock Custom Provider',
      execute: async () => ({
        created: 123456,
        items: [{ url: 'https://example.com/custom.png' }]
      })
    };

    providerRegistry.register(customAdapter);
    const retrieved = providerRegistry.get('mock-custom-provider');
    expect(retrieved).toBe(customAdapter);
  });
});
