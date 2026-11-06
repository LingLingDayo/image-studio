import type { IImageProviderAdapter, ProviderConfig, ProviderExecutionResult, ProviderItemResult, ProviderExecuteOptions } from '@/types/provider';
import type { TaskGenerationParams } from '@/types/task';
import { resolveTransparentOutputFormat } from '@/types/model';
import { applySizePromptHint, buildSizePromptHint, parseSizeString } from '@/utils/imageSize';
import {
  categorizeErrorDetail,
  extractJsonErrorMessage,
  extractResponseError,
  formatThrownError,
  parseResponseSafeJson,
  sanitizeErrorText
} from '@/utils/apiError';

function resolveOutputFormat(params: TaskGenerationParams): string | undefined {
  if (params.transparent) {
    return resolveTransparentOutputFormat(params.format);
  }
  return params.format;
}

function resolveRequestPrompt(params: TaskGenerationParams): string {
  const parsed = parseSizeString(params.size);
  const refRatio = params.referenceImages?.[0]?.ratio;
  const hint = buildSizePromptHint(
    {
      resolution: params.resolution ?? 'auto',
      aspectRatio: params.aspectRatio ?? 'auto',
      width: parsed?.width ?? null,
      height: parsed?.height ?? null
    },
    refRatio
  );
  return applySizePromptHint(params.prompt, hint);
}

function normalizeEndpoint(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/v1')) {
    return `${base}${path}`;
  }
  return `${base}/v1${path}`;
}

function parseResponseBody(data: any, actionName = '生图'): ProviderExecutionResult {
  if (!data) {
    throw new Error(`${actionName}失败: 提供商返回了空响应`);
  }

  const payloadError = extractJsonErrorMessage(data);
  const itemErrors: string[] = [];
  let items: ProviderItemResult[] = [];

  if (Array.isArray(data.data)) {
    items = data.data.map((item: any) => {
      if (typeof item === 'string') {
        return { url: item };
      }
      if (item?.error) {
        const nested = extractJsonErrorMessage(item.error);
        if (nested) itemErrors.push(nested);
      }
      let url = item?.url;
      if (!url && item?.b64_json) {
        url = item.b64_json.startsWith('data:image/')
          ? item.b64_json
          : `data:image/png;base64,${item.b64_json}`;
      }
      return {
        url,
        b64_json: item?.b64_json,
        revised_prompt: item?.revised_prompt
      };
    });
  } else if (data.url) {
    items = [{ url: data.url }];
  } else if (data.b64_json) {
    const url = data.b64_json.startsWith('data:image/')
      ? data.b64_json
      : `data:image/png;base64,${data.b64_json}`;
    items = [{ url, b64_json: data.b64_json }];
  }

  const validItems = items.filter((item) => Boolean(item.url));
  if (validItems.length === 0) {
    const detail = itemErrors[0] || payloadError;
    if (detail) {
      throw new Error(`${actionName}失败: ${categorizeErrorDetail(sanitizeErrorText(detail))}`);
    }
    throw new Error(`${actionName}失败: 提供商未返回有效的图片链接或 Base64 图像数据`);
  }

  return {
    created: data.created || Math.floor(Date.now() / 1000),
    items: validItems
  };
}

/**
 * OpenAI 与 Sub2API 兼容的标准图像提供商适配器
 */
export class OpenAICompatibleAdapter implements IImageProviderAdapter {
  readonly providerId = 'openai-compatible';
  readonly name = 'OpenAI / Sub2API Compatible Provider';

  async execute(
    config: ProviderConfig,
    params: TaskGenerationParams,
    signalOrOptions?: AbortSignal | ProviderExecuteOptions
  ): Promise<ProviderExecutionResult> {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('未配置 API Key，请在右上角设置中填写');
    }

    const options: ProviderExecuteOptions =
      signalOrOptions instanceof AbortSignal
        ? { signal: signalOrOptions }
        : signalOrOptions || {};

    const isEditMode = params.type === 'i2i' || (params.referenceImages && params.referenceImages.length > 0);

    if (isEditMode) {
      return this.executeEdit(config, params, options);
    }
    return this.executeGenerate(config, params, options);
  }

  private async executeGenerate(
    config: ProviderConfig,
    params: TaskGenerationParams,
    options?: ProviderExecuteOptions
  ): Promise<ProviderExecutionResult> {
    const endpoint = normalizeEndpoint(config.baseUrl, '/images/generations');

    const payload: Record<string, any> = {
      model: params.model || config.model || 'gpt-image-2',
      prompt: resolveRequestPrompt(params),
      n: 1,
      response_format: 'b64_json'
    };

    if (params.size && params.size !== 'auto') {
      payload.size = params.size;
    }
    if (params.quality && params.quality !== 'auto') {
      payload.quality = params.quality;
    }
    const outputFormat = resolveOutputFormat(params);
    if (outputFormat) {
      payload.output_format = outputFormat;
    }
    if (params.transparent) {
      payload.background = 'transparent';
    }
    if (params.moderation) {
      payload.moderation = params.moderation;
    }

    return this.sendRequest(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey.trim()}`
        },
        body: JSON.stringify(payload),
        signal: options?.signal
      },
      '生图',
      options
    );
  }

  private async executeEdit(
    config: ProviderConfig,
    params: TaskGenerationParams,
    options?: ProviderExecuteOptions
  ): Promise<ProviderExecutionResult> {
    const endpoint = normalizeEndpoint(config.baseUrl, '/images/edits');

    if (!params.referenceImages || params.referenceImages.length === 0) {
      throw new Error('图生图/编辑模式需要至少一张参考图片');
    }

    const formData = new FormData();
    formData.append('model', params.model || config.model || 'gpt-image-2');
    formData.append('prompt', resolveRequestPrompt(params));
    formData.append('n', '1');
    formData.append('response_format', 'b64_json');

    if (params.size && params.size !== 'auto') {
      formData.append('size', params.size);
    }
    if (params.quality && params.quality !== 'auto') {
      formData.append('quality', params.quality);
    }
    const outputFormat = resolveOutputFormat(params);
    if (outputFormat) {
      formData.append('output_format', outputFormat);
    }
    if (params.transparent) {
      formData.append('background', 'transparent');
    }
    if (params.moderation) {
      formData.append('moderation', params.moderation);
    }

    params.referenceImages.forEach((img) => {
      formData.append('image[]', img.file, img.file.name);
    });

    return this.sendRequest(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey.trim()}`
        },
        body: formData,
        signal: options?.signal
      },
      '图生图/编辑',
      options
    );
  }

  private async sendRequest(
    endpoint: string,
    init: RequestInit,
    actionName: string,
    options?: ProviderExecuteOptions
  ): Promise<ProviderExecutionResult> {
    const requestSentAt = performance.now();

    let response: Response;
    try {
      response = await fetch(endpoint, init);
    } catch (err) {
      if (init.signal?.aborted) {
        throw err;
      }
      throw new Error(formatThrownError(err, actionName), { cause: err });
    }

    if (!response.ok) {
      const errorDetail = await extractResponseError(response, actionName);
      throw new Error(`${actionName}失败: ${errorDetail}`);
    }

    // 服务器响应成功后，开始正常走时
    options?.onResponseStart?.();

    let data: any;
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.length > 0) {
            chunks.push(decoder.decode(value, { stream: true }));
          }
        }
        chunks.push(decoder.decode());
        const rawText = chunks.join('');
        data = await parseResponseSafeJson(rawText, actionName);
      } catch (streamErr) {
        if (init.signal?.aborted) {
          throw streamErr;
        }
        throw new Error(`${actionName}失败: 读取响应内容流中断`, { cause: streamErr });
      }
    } else {
      data = await parseResponseSafeJson(response, actionName);
    }

    const result = parseResponseBody(data, actionName);

    // 服务器返回图片完成，通知结束走时
    options?.onImageReceived?.();

    if (options?.onContentStart) {
      const durationSec = (performance.now() - requestSentAt) / 1000;
      options.onContentStart(durationSec);
    }

    return result;
  }
}
