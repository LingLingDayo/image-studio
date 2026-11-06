export type OptimizerProtocol = 'chat-completions' | 'responses' | 'messages';

const PROTOCOL_ENDPOINTS: Record<OptimizerProtocol, string> = {
  'chat-completions': '/v1/chat/completions',
  responses: '/v1/responses',
  messages: '/v1/messages'
};

export function resolveOptimizerProtocol(endpoint: string = ''): OptimizerProtocol {
  const path = (endpoint.trim() || '/v1/chat/completions').replace(/^\/+/, '').replace(/^v1\//, '').replace(/\/+$/, '');
  switch (path) {
    case 'chat/completions': return 'chat-completions';
    case 'responses': return 'responses';
    case 'messages': return 'messages';
    default: throw new Error('不支持的提示词优化端点，请选择 Chat Completions、Responses 或 Messages');
  }
}

export function optimizerAuthHeaders(protocol: OptimizerProtocol, apiKey: string): Record<string, string> {
  if (protocol === 'messages') {
    return { 'x-api-key': apiKey.trim(), 'anthropic-version': '2023-06-01' };
  }
  return { Authorization: `Bearer ${apiKey.trim()}` };
}

export function createOptimizerRequest(
  endpoint: string,
  model: string,
  apiKey: string,
  prompt: string
) {
  const protocol = resolveOptimizerProtocol(endpoint);
  const body: Record<string, unknown> = protocol === 'responses'
    ? { model: model.trim(), input: prompt, store: false }
    : {
        model: model.trim(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        ...(protocol === 'messages' ? { max_tokens: 2048 } : {})
      };
  return {
    protocol,
    endpoint: PROTOCOL_ENDPOINTS[protocol],
    headers: { 'Content-Type': 'application/json', ...optimizerAuthHeaders(protocol, apiKey) },
    body
  };
}

export function isResponseRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function textBlocks(content: unknown, type: 'text' | 'output_text'): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((block: unknown) => {
    if (typeof block === 'string') return block;
    if (!isResponseRecord(block) || (block.type != null && block.type !== type) || typeof block.text !== 'string') return '';
    return block.text;
  }).join('');
}

function legacyText(json: Record<string, unknown>): string {
  const content = textBlocks(json.content, 'text');
  if (content) return content;
  if (typeof json.output === 'string') return json.output;
  if (typeof json.response === 'string') return json.response;
  if (isResponseRecord(json.response) && typeof json.response.text === 'string') return json.response.text;
  return '';
}

export function extractOptimizerText(protocol: OptimizerProtocol, data: unknown): string {
  if (!isResponseRecord(data)) return '';
  if (protocol === 'responses') {
    if (typeof data.status === 'string' && data.status !== 'completed') {
      throw new Error('提示词优化未完成，请重试或选择其他模型');
    }
    const output = Array.isArray(data.output) ? data.output : [];
    const text = output.map((item: unknown) =>
      isResponseRecord(item) && item.type === 'message' ? textBlocks(item.content, 'output_text') : ''
    ).join('');
    // 原生 REST 返回 output；部分兼容服务会暴露 SDK 的便捷 output_text 字段。
    return text || (typeof data.output_text === 'string' ? data.output_text : '') || legacyText(data);
  }
  if (protocol === 'messages') return textBlocks(data.content, 'text');

  const firstChoice: unknown = Array.isArray(data.choices) ? data.choices[0] : undefined;
  if (isResponseRecord(firstChoice)) {
    const message = firstChoice.message;
    const content = isResponseRecord(message) ? textBlocks(message.content, 'text') : '';
    if (content) return content;
    if (typeof firstChoice.text === 'string') return firstChoice.text;
  }
  return legacyText(data);
}
