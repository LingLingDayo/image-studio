import type { OptimizerConfig } from '@/types/config';
import { ENV_OPTIMIZER_PROMPT_TEMPLATE } from '@/types/config';

export function normalizeEndpointUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;

  if (base.endsWith('/v1') && cleanPath.startsWith('/v1/')) {
    return `${base}${cleanPath.slice(3)}`;
  }
  if (!base.endsWith('/v1') && !cleanPath.startsWith('/v1/')) {
    return `${base}/v1${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}

export class PromptOptimizerService {
  /**
   * 获取当前 API Key 所支持的模型列表
   */
  static async fetchModels(
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    if (!baseUrl || !baseUrl.trim()) {
      throw new Error('未配置模型 API Base URL');
    }
    if (!apiKey || !apiKey.trim()) {
      throw new Error('未配置 API Key');
    }

    const endpoint = normalizeEndpointUrl(baseUrl, '/models');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      signal
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error?.message) {
          detail = errorJson.error.message;
        } else if (errorJson.message) {
          detail = errorJson.message;
        }
      } catch {
        const text = await response.text();
        if (text) detail = text;
      }
      throw new Error(`获取模型列表失败: ${detail}`);
    }

    const data = await response.json();
    let rawList: any[] = [];

    if (Array.isArray(data.data)) {
      rawList = data.data;
    } else if (Array.isArray(data.models)) {
      rawList = data.models;
    } else if (Array.isArray(data)) {
      rawList = data;
    }

    const modelIds = rawList
      .map((item: any) => {
        if (typeof item === 'string') return item;
        return item?.id || item?.name || '';
      })
      .filter((id: string) => id && id.trim().length > 0);

    // 去重并对模型做智能排序（常用大模型优先排前）
    const uniqueIds = Array.from(new Set(modelIds));
    return uniqueIds.sort((a, b) => {
      const priorityKeywords = ['gpt-4o', 'gpt-4', 'claude-3', 'deepseek', 'gemini', 'qwen'];
      const aScore = priorityKeywords.findIndex((k) => a.toLowerCase().includes(k));
      const bScore = priorityKeywords.findIndex((k) => b.toLowerCase().includes(k));

      if (aScore !== -1 && bScore !== -1) return aScore - bScore;
      if (aScore !== -1) return -1;
      if (bScore !== -1) return 1;
      return a.localeCompare(b);
    });
  }

  /**
   * 使用配置的语言大模型根据模板优化提示词
   */
  static async optimizePrompt(
    config: OptimizerConfig,
    userPrompt: string,
    customTemplate?: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (!config.baseUrl || !config.baseUrl.trim()) {
      throw new Error('请先在右上角「设置 -> 提示词优化」中配置 API 地址');
    }
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('请先在右上角「设置 -> 提示词优化」中配置 API Key');
    }
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('请输入提示词后再进行优化');
    }

    const endpointPath = config.endpoint || '/v1/chat/completions';
    const targetUrl = normalizeEndpointUrl(config.baseUrl, endpointPath);

    const rawTemplate = (customTemplate || ENV_OPTIMIZER_PROMPT_TEMPLATE).trim();
    const promptContent = rawTemplate.includes('{prompt}')
      ? rawTemplate.replace(/\{prompt\}/g, userPrompt.trim())
      : `${rawTemplate}\n\nUser input: ${userPrompt.trim()}`;

    const payload: Record<string, any> = {
      model: config.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: promptContent
        }
      ],
      temperature: 0.7
    };

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.error?.message) {
          errorDetail = errorJson.error.message;
        } else if (errorJson.message) {
          errorDetail = errorJson.message;
        }
      } catch {
        const text = await response.text();
        if (text) errorDetail = text;
      }
      throw new Error(`提示词优化请求失败: ${errorDetail}`);
    }

    const json = await response.json();
    let content = '';

    if (json.choices && json.choices[0]?.message?.content) {
      content = json.choices[0].message.content;
    } else if (json.choices && json.choices[0]?.text) {
      content = json.choices[0].text;
    } else if (typeof json.output === 'string') {
      content = json.output;
    }

    if (!content || !content.trim()) {
      throw new Error('模型未返回有效的优化提示词');
    }

    // 清洗模型输出的多余引号或代码块标记
    let cleaned = content.trim();
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    return cleaned;
  }
}
