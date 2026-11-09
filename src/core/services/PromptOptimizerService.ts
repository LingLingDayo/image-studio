import type { OptimizerConfig } from '@/types/config';
import { ENV_OPTIMIZER_PROMPT_TEMPLATE } from '@/types/config';
import { extractJsonErrorMessage, extractResponseError, parseResponseSafeJson, sanitizeErrorText } from '@/utils/apiError';
import { isHttpUrl, normalizeEndpointUrl } from '@/utils/apiUrl';
import { fetchRemoteModels } from '@/utils/fetchRemoteModels';
import {
  createOptimizerRequest,
  extractOptimizerText,
  isResponseRecord,
  optimizerAuthHeaders,
  resolveOptimizerProtocol
} from './optimizer/protocol';

export { normalizeEndpointUrl };

export class PromptOptimizerService {
  /**
   * 获取当前 API Key 所支持的模型列表
   */
  static async fetchModels(
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal,
    endpoint: string = '/v1/chat/completions'
  ): Promise<string[]> {
    const protocol = resolveOptimizerProtocol(endpoint);
    const uniqueIds = await fetchRemoteModels(baseUrl, apiKey, signal, { headers: optimizerAuthHeaders(protocol, apiKey) });
    return uniqueIds.sort((a, b) => {
      const priorityKeywords = ['gpt-5.6-terra', 'gpt-5.6', 'gpt-5', 'gpt-4o', 'gpt-4', 'claude-3', 'claude', 'deepseek', 'gemini', 'qwen'];
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
      throw new Error('请先在右上角「设置 -> 生图服务」中配置 API 地址');
    }
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('请先在右上角「设置 -> 生图服务」中配置 API Key');
    }
    if (!isHttpUrl(config.baseUrl)) {
      throw new Error('优化接口地址需以 http:// 或 https:// 开头');
    }
    if (!config.model || !config.model.trim()) {
      throw new Error('请先在提示词优化设置中填写模型名称');
    }
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('请输入提示词后再进行优化');
    }

    const rawTemplate = (customTemplate || ENV_OPTIMIZER_PROMPT_TEMPLATE).trim();
    const promptContent = rawTemplate.includes('{prompt}')
      ? rawTemplate.replace(/\{prompt\}/g, userPrompt.trim())
      : `${rawTemplate}\n\nUser input: ${userPrompt.trim()}`;

    const request = createOptimizerRequest(config.endpoint, config.model, config.apiKey, promptContent);
    const targetUrl = normalizeEndpointUrl(config.baseUrl, request.endpoint);
    throwIfAborted(signal);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal
    });

    throwIfAborted(signal);
    if (!response.ok) {
      const errorDetail = await extractResponseError(response, '提示词优化');
      throwIfAborted(signal);
      throw new Error(`提示词优化请求失败: ${errorDetail}`);
    }

    let json: unknown;
    try {
      json = await parseResponseSafeJson(response, '提示词优化');
    } catch (error) {
      throwIfAborted(signal);
      throw error;
    }
    throwIfAborted(signal);
    if (isResponseRecord(json) && json.error) {
      const detail = extractJsonErrorMessage(json.error);
      throw new Error(`提示词优化请求失败: ${sanitizeErrorText(detail || '服务返回错误响应')}`);
    }
    const content = extractOptimizerText(request.protocol, json);
    if (!content.trim()) throw new Error('模型未返回有效的优化提示词');

    // 清洗模型输出的多余引号或代码块标记
    let cleaned = content.trim();
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }

    if (!cleaned.trim()) throw new Error('模型未返回有效的优化提示词');
    return cleaned;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException('请求已中止', 'AbortError');
}
