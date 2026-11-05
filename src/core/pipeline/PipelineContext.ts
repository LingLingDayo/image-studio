import type { ModelProfile } from '@/types/model';
import type { GenerationTask } from '@/types/task';
import type { ProviderConfig, ProviderExecutionResult } from '@/types/provider';
import type { MediaAsset } from '@/types/asset';

export interface PipelineContext {
  task: GenerationTask;
  config: ProviderConfig;
  modelProfile: ModelProfile;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  /** 当服务端建立连接并开始返回 HTTP 响应时触发 */
  onResponseStart?: () => void;
  /** 当服务端返回图片时触发 */
  onImageReceived?: () => void;
  /** @deprecated 保持兼容旧字段 */
  onContentStart?: (durationSeconds: number) => void;
  rawResult?: ProviderExecutionResult;
  generatedAssets: MediaAsset[];
}

export interface IPipelineStage {
  readonly name: string;
  process(context: PipelineContext): Promise<void>;
}
