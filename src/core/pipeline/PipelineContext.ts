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
  rawResult?: ProviderExecutionResult;
  generatedAssets: MediaAsset[];
}

export interface IPipelineStage {
  readonly name: string;
  process(context: PipelineContext): Promise<void>;
}
