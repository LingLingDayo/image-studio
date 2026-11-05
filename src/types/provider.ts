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

export interface ProviderExecuteOptions {
  signal?: AbortSignal;
  /** 当服务端建立连接并开始返回 HTTP 响应时触发 */
  onResponseStart?: () => void;
  /** 当服务端返回图片（数据完全接收并解析完成）时触发 */
  onImageReceived?: () => void;
  /** @deprecated 保持兼容旧字段 */
  onContentStart?: (durationSeconds: number) => void;
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
    signalOrOptions?: AbortSignal | ProviderExecuteOptions
  ): Promise<ProviderExecutionResult>;
}
