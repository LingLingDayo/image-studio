import { extractResponseError, parseResponseSafeJson } from '@/utils/apiError';
import { normalizeEndpointUrl } from '@/utils/apiUrl';

export interface RemoteModelRequestOptions {
  headers?: Record<string, string>;
}

/**
 * 按 OpenAI 兼容 /models 拉取当前 Key 可见的模型 id，保持接口返回顺序并去重。
 */
export async function fetchRemoteModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
  options?: RemoteModelRequestOptions
): Promise<string[]> {
  if (!baseUrl || !baseUrl.trim()) {
    throw new Error('未配置模型 API Base URL');
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('未配置 API Key');
  }

  const endpoint = normalizeEndpointUrl(baseUrl, '/models');

  const headers: Record<string, string> = options?.headers ?? {
    Authorization: `Bearer ${apiKey.trim()}`
  };

  const response = await fetch(endpoint, {
    method: 'GET',
    headers,
    signal
  });

  if (!response.ok) {
    const detail = await extractResponseError(response, '获取模型列表');
    throw new Error(`获取模型列表失败: ${detail}`);
  }

  const data = await parseResponseSafeJson(response, '获取模型列表');
  let rawList: unknown[] = [];

  if (Array.isArray(data.data)) {
    rawList = data.data;
  } else if (Array.isArray(data.models)) {
    rawList = data.models;
  } else if (Array.isArray(data)) {
    rawList = data;
  }

  const modelIds = rawList
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const record = item as { id?: unknown; name?: unknown };
        if (typeof record.id === 'string') return record.id;
        if (typeof record.name === 'string') return record.name;
      }
      return '';
    })
    .filter((id: string) => id && id.trim().length > 0);

  return Array.from(new Set(modelIds));
}
