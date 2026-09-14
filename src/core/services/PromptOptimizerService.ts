import type { OptimizerConfig } from '@/types/config';
import { ENV_OPTIMIZER_PROMPT_TEMPLATE } from '@/types/config';
import { extractResponseError, parseResponseSafeJson } from '@/utils/apiError';
import { normalizeEndpointUrl } from '@/utils/apiUrl';
import { fetchRemoteModels } from '@/utils/fetchRemoteModels';

export { normalizeEndpointUrl };

export class PromptOptimizerService {
  /**
   * 获取当前 API Key 所支持的模型列表
   */
  static async fetchModels(
    baseUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    const uniqueIds = await fetchRemoteModels(baseUrl, apiKey, signal);
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
    const isClaudeMessages = endpointPath.includes('/messages');

    const rawTemplate = (customTemplate || ENV_OPTIMIZER_PROMPT_TEMPLATE).trim();
    const promptContent = rawTemplate.includes('{prompt}')
      ? rawTemplate.replace(/\{prompt\}/g, userPrompt.trim())
      : `${rawTemplate}\n\nUser input: ${userPrompt.trim()}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey.trim()}`,
      'x-api-key': config.apiKey.trim(),
      'anthropic-version': '2023-06-01'
    };

    const payload: Record<string, any> = {
      model: config.model || (isClaudeMessages ? 'claude-3-5-sonnet-20241022' : 'gpt-5.6-terra'),
      messages: [
        {
          role: 'user',
          content: promptContent
        }
      ],
      temperature: 0.7
    };

    // Claude Messages API 必须带有 max_tokens 参数
    if (isClaudeMessages) {
      payload.max_tokens = 2048;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal
    });

    if (!response.ok) {
      const errorDetail = await extractResponseError(response, '提示词优化');
      throw new Error(`提示词优化请求失败: ${errorDetail}`);
    }

    const json = await parseResponseSafeJson(response, '提示词优化');
    let content = '';

    // 智能解析各厂商大模型返回格式 (Claude Messages / OpenAI Chat / Responses API 等)
    if (Array.isArray(json.content)) {
      content = json.content
        .map((item: any) => (typeof item === 'string' ? item : item.text || ''))
        .join('')
        .trim();
    } else if (typeof json.content === 'string') {
      content = json.content;
    } else if (json.choices && json.choices[0]?.message?.content) {
      content = json.choices[0].message.content;
    } else if (json.choices && json.choices[0]?.text) {
      content = json.choices[0].text;
    } else if (typeof json.output === 'string') {
      content = json.output;
    } else if (json.response) {
      content = typeof json.response === 'string' ? json.response : json.response.text || '';
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
