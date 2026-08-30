import type { IImageProviderAdapter, ProviderConfig, ProviderExecutionResult, ProviderItemResult } from '@/types/provider';
import type { TaskGenerationParams } from '@/types/task';
import { resolveTransparentOutputFormat } from '@/types/model';
import { applySizePromptHint, buildSizePromptHint, parseSizeString } from '@/utils/imageSize';

function resolveOutputFormat(params: TaskGenerationParams): string | undefined {
  if (params.transparent) {
    return resolveTransparentOutputFormat(params.format);
  }
  return params.format;
}

function resolveRequestPrompt(params: TaskGenerationParams): string {
  const parsed = parseSizeString(params.size);
  const hint = buildSizePromptHint({
    resolution: params.resolution ?? 'auto',
    aspectRatio: params.aspectRatio ?? 'auto',
    width: parsed?.width ?? null,
    height: parsed?.height ?? null
  });
  return applySizePromptHint(params.prompt, hint);
}

function normalizeEndpoint(baseUrl: string, path: string): string {
  let base = baseUrl.trim().replace(/\/+$/, '');
  if (base.endsWith('/v1')) {
    return `${base}${path}`;
  }
  return `${base}/v1${path}`;
}

function parseResponseBody(data: any): ProviderExecutionResult {
  if (!data) {
    throw new Error('提供商返回了空响应');
  }

  let items: ProviderItemResult[] = [];

  if (Array.isArray(data.data)) {
    items = data.data.map((item: any) => {
      if (typeof item === 'string') {
        return { url: item };
      }
      let url = item.url;
      if (!url && item.b64_json) {
        url = item.b64_json.startsWith('data:image/')
          ? item.b64_json
          : `data:image/png;base64,${item.b64_json}`;
      }
      return {
        url,
        b64_json: item.b64_json,
        revised_prompt: item.revised_prompt
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

  if (items.length === 0 || !items[0].url) {
    throw new Error('提供商未返回有效的图片链接或 Base64 图像数据');
  }

  return {
    created: data.created || Math.floor(Date.now() / 1000),
    items
  };
}

async function extractErrorDetail(response: Response): Promise<string> {
  let errorDetail = `HTTP ${response.status} ${response.statusText}`;
  try {
    const errorJson = await response.json();
    if (errorJson.error?.message) {
      errorDetail = errorJson.error.message;
    } else if (errorJson.message) {
      errorDetail = errorJson.message;
    } else if (errorJson.detail) {
      errorDetail = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
    }
  } catch {
    const text = await response.text();
    if (text) errorDetail = text;
  }
  return errorDetail;
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
    signal?: AbortSignal
  ): Promise<ProviderExecutionResult> {
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('未配置 API Key，请在右上角设置中填写');
    }

    const isEditMode = params.type === 'i2i' || (params.referenceImages && params.referenceImages.length > 0);

    if (isEditMode) {
      return this.executeEdit(config, params, signal);
    }
    return this.executeGenerate(config, params, signal);
  }

  private async executeGenerate(
    config: ProviderConfig,
    params: TaskGenerationParams,
    signal?: AbortSignal
  ): Promise<ProviderExecutionResult> {
    const endpoint = normalizeEndpoint(config.baseUrl, '/images/generations');

    const payload: Record<string, any> = {
      model: params.model || config.model || 'gpt-image-2',
      prompt: resolveRequestPrompt(params),
      n: params.count || 1,
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

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errorDetail = await extractErrorDetail(response);
      throw new Error(`生图失败: ${errorDetail}`);
    }

    const data = await response.json();
    return parseResponseBody(data);
  }

  private async executeEdit(
    config: ProviderConfig,
    params: TaskGenerationParams,
    signal?: AbortSignal
  ): Promise<ProviderExecutionResult> {
    const endpoint = normalizeEndpoint(config.baseUrl, '/images/edits');

    if (!params.referenceImages || params.referenceImages.length === 0) {
      throw new Error('图生图/编辑模式需要至少一张参考图片');
    }

    const formData = new FormData();
    formData.append('model', params.model || config.model || 'gpt-image-2');
    formData.append('prompt', resolveRequestPrompt(params));
    formData.append('n', String(params.count || 1));
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

    params.referenceImages.forEach((img) => {
      formData.append('image[]', img.file, img.file.name);
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey.trim()}`
      },
      body: formData,
      signal
    });

    if (!response.ok) {
      const errorDetail = await extractErrorDetail(response);
      throw new Error(`图生图/编辑失败: ${errorDetail}`);
    }

    const data = await response.json();
    return parseResponseBody(data);
  }
}
