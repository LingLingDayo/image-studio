import type { IPipelineStage, PipelineContext } from './PipelineContext';
import { providerRegistry } from '@/core/providers/ProviderRegistry';
import { assetRepository } from '@/core/storage/AssetRepository';
import { fileToDataUrl, materializeImageBlob, mimeToImageFormat } from '@/core/storage/imageBlob';
import { calculateImageDimensions } from '@/utils/image';
import type { MediaAsset } from '@/types/asset';
import type { TaskReferenceImage } from '@/types/task';

/**
 * 阶段 1: 校验输入参数与凭证合法性
 */
export class ValidationStage implements IPipelineStage {
  readonly name = 'ValidationStage';

  async process(ctx: PipelineContext): Promise<void> {
    if (!ctx.config.apiKey || ctx.config.apiKey.trim() === '') {
      throw new Error('未配置 API Key，请在顶部设置中填写');
    }

    if (!ctx.config.baseUrl || ctx.config.baseUrl.trim() === '') {
      throw new Error('未配置 API Base URL，请在顶部设置中填写接口地址');
    }

    if (!ctx.task.params.prompt || ctx.task.params.prompt.trim() === '') {
      throw new Error('请输入提示词');
    }

    if (ctx.task.params.type === 'i2i' && (!ctx.task.params.referenceImages || ctx.task.params.referenceImages.length === 0)) {
      throw new Error('图生图/编辑模式需要至少一张参考图片');
    }

    ctx.onProgress?.(10);
  }
}

/**
 * 阶段 2: 路由并执行模型适配器网络请求
 */
export class ProviderExecutionStage implements IPipelineStage {
  readonly name = 'ProviderExecutionStage';

  async process(ctx: PipelineContext): Promise<void> {
    const adapter = providerRegistry.get(ctx.modelProfile.providerType);
    ctx.onProgress?.(30);

    const result = await adapter.execute(ctx.config, ctx.task.params, {
      signal: ctx.signal,
      onResponseStart: ctx.onResponseStart,
      onImageReceived: ctx.onImageReceived,
      onContentStart: ctx.onContentStart
    });
    ctx.rawResult = result;
    // 服务器返回图片时（或者如果表明生成结束时），结束计时
    ctx.onImageReceived?.();
    ctx.onProgress?.(70);
  }
}

/**
 * 阶段 3: 提取与分析图像物理尺寸、宽高比
 */
export class DimensionAnalysisStage implements IPipelineStage {
  readonly name = 'DimensionAnalysisStage';

  async process(ctx: PipelineContext): Promise<void> {
    if (!ctx.rawResult || ctx.rawResult.items.length === 0) {
      throw new Error('提供商未返回有效生成图像数据');
    }

    const { params } = ctx.task;
    const assets: MediaAsset[] = [];
    const referenceImages = await persistReferenceImages(params.referenceImages);

    for (const item of ctx.rawResult.items) {
      if (!item.url && !item.b64_json) continue;

      const blob = await materializeImageBlob(item);
      const previewUrl = URL.createObjectURL(blob);
      const { width, height, ratioStr } = await calculateImageDimensions(previewUrl);
      URL.revokeObjectURL(previewUrl);
      const isAuto = params.size === 'auto';

      const trimmedPrompt = params.prompt.trim();
      const rawRevised = item.revised_prompt?.trim();
      const revisedPrompt = rawRevised && rawRevised !== trimmedPrompt ? rawRevised : undefined;

      assets.push({
        batchId: ctx.task.id,
        url: '',
        blob,
        prompt: trimmedPrompt,
        revisedPrompt,
        model: params.model,
        size: isAuto ? `${width}×${height}` : params.size,
        targetResolution: params.resolution,
        targetRatio: params.aspectRatio,
        targetSize: params.size,
        ratio: ratioStr,
        width,
        height,
        quality: params.quality,
        format: mimeToImageFormat(blob.type) ?? params.format,
        targetFormat: params.format,
        transparent: params.transparent,
        moderation: params.moderation,
        complexity: params.complexity,
        outputCompression: params.outputCompression,
        frameCount: params.frameCount,
        frameDurationMs: params.frameDurationMs,
        duration: ctx.task.durationFormatted || '0.0s',
        // 使用任务创建时间作为作品时间戳，保证并发任务无论谁先完成都维持发起时的排列位置
        timestamp: ctx.task.createdAt || Date.now(),
        isFavorite: false,
        type: params.type,
        referenceImages
      });
    }

    if (assets.length === 0) {
      throw new Error('提供商未返回有效生成图像数据');
    }

    ctx.generatedAssets = assets;
    ctx.onProgress?.(85);
  }
}

/**
 * 阶段 4: 持久化存储至资产仓库
 */
export class PersistenceStage implements IPipelineStage {
  readonly name = 'PersistenceStage';

  async process(ctx: PipelineContext): Promise<void> {
    const savedAssets: MediaAsset[] = [];

    for (const asset of ctx.generatedAssets) {
      const saved = await assetRepository.save(asset);
      savedAssets.push(saved);
      if (saved.id) {
        ctx.task.resultAssetIds.push(saved.id);
      }
    }

    ctx.generatedAssets = savedAssets;
    ctx.onProgress?.(100);
  }
}

/**
 * 图像流水线执行引擎 (Image Pipeline Engine)
 * // Extension Point: 可通过 useStage() 动态注入中间件 (如提示词增强、超分、暗水印等)
 */
export class ImagePipeline {
  private stages: IPipelineStage[] = [];

  constructor() {
    this.stages = [
      new ValidationStage(),
      new ProviderExecutionStage(),
      new DimensionAnalysisStage(),
      new PersistenceStage()
    ];
  }

  public useStage(stage: IPipelineStage, index?: number): this {
    if (typeof index === 'number') {
      this.stages.splice(index, 0, stage);
    } else {
      this.stages.push(stage);
    }
    return this;
  }

  public async run(context: PipelineContext): Promise<MediaAsset[]> {
    for (const stage of this.stages) {
      if (context.signal?.aborted) {
        throw new Error('任务已被用户取消');
      }
      await stage.process(context);
    }
    return context.generatedAssets;
  }
}

export const defaultImagePipeline = new ImagePipeline();

async function persistReferenceImages(refs?: TaskReferenceImage[]): Promise<string[]> {
  if (!refs || refs.length === 0) return [];
  return Promise.all(refs.map((ref) => fileToDataUrl(ref.file)));
}
