import type { IImageProviderAdapter } from '@/types/provider';
import { OpenAICompatibleAdapter } from './OpenAICompatibleAdapter';

/**
 * 图像提供商注册表 (Provider Registry)
 * 集中管理所有提供商适配器实例，实现依赖倒置与插拔式接入
 */
class ProviderRegistry {
  private adapters = new Map<string, IImageProviderAdapter>();

  constructor() {
    // 默认注册 OpenAI 兼容适配器
    this.register(new OpenAICompatibleAdapter());
  }

  /**
   * 注册一个新的提供商适配器
   * // Extension Point: 后续如需接入 Fal.ai / Replicate / ComfyUI，直接调用此方法注入适配器即可
   */
  public register(adapter: IImageProviderAdapter): void {
    this.adapters.set(adapter.providerId, adapter);
  }

  /**
   * 根据 providerId 获取对应适配器
   */
  public get(providerId: string): IImageProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      // 默认回退到 openai-compatible
      const fallback = this.adapters.get('openai-compatible');
      if (fallback) return fallback;
      throw new Error(`未找到 ID 为 [${providerId}] 的提供商适配器`);
    }
    return adapter;
  }
}

export const providerRegistry = new ProviderRegistry();
