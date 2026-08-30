import type { TaskGenerationParams } from './task';

export interface ProviderItemResult {
  url: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ProviderExecutionResult {
  created: number;
  items: ProviderItemResult[];
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 图像提供商适配器标准契约
 * // Extension Point: 所有底层生图协议 (OpenAI标准、Fal.ai、Replicate 等) 均实现此接口
 */
export interface IImageProviderAdapter {
  readonly providerId: string;
  readonly name: string;
  
  execute(
    config: ProviderConfig,
    params: TaskGenerationParams,
    signal?: AbortSignal
  ): Promise<ProviderExecutionResult>;
}
