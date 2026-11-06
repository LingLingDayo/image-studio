import { describe, expect, it } from 'vitest';
import { createOptimizerRequest, extractOptimizerText, optimizerAuthHeaders, resolveOptimizerProtocol } from './protocol';

describe('optimizer protocol', () => {
  it.each([
    ['', 'chat-completions'],
    ['/v1/chat/completions', 'chat-completions'],
    ['chat/completions', 'chat-completions'],
    [' /v1/responses/ ', 'responses'],
    ['/messages', 'messages']
  ] as const)('规范化已知端点 %s', (endpoint, protocol) => {
    expect(resolveOptimizerProtocol(endpoint)).toBe(protocol);
  });

  it.each(['/proxy/responses', 'https://example.com/v1/responses', '/v1/unknown'])('未知路径 %s 不猜测协议', (endpoint) => {
    expect(() => resolveOptimizerProtocol(endpoint)).toThrow('不支持');
  });

  it('不同协议认证头不混用，且请求仅使用指定模型', () => {
    expect(optimizerAuthHeaders('responses', ' key ')).toEqual({ Authorization: 'Bearer key' });
    const request = createOptimizerRequest('/messages', 'chosen-model', 'key', 'input');
    expect(request.body.model).toBe('chosen-model');
    expect(request.headers).not.toHaveProperty('Authorization');
  });

  it.each([null, undefined, [], 'text', { choices: [{ message: { content: { unexpected: true } } }] }])('未知响应形状不会被字符串化为提示词', (response) => {
    expect(extractOptimizerText('chat-completions', response)).toBe('');
  });

  it('保留兼容服务明确的纯文本响应，忽略有类型的非文本块', () => {
    expect(extractOptimizerText('chat-completions', { content: ['one', { text: 'two' }, { type: 'thinking', text: 'hidden' }] })).toBe('onetwo');
    expect(extractOptimizerText('chat-completions', { choices: [{ text: 'legacy choice' }] })).toBe('legacy choice');
    expect(extractOptimizerText('chat-completions', { response: { text: 'legacy response' } })).toBe('legacy response');
  });

  it('Responses 拒绝未完成状态，且不把推理或拒绝文本当作优化内容', () => {
    expect(() => extractOptimizerText('responses', { status: 'in_progress', output: [] })).toThrow('未完成');
    expect(extractOptimizerText('responses', { output: [
      { type: 'reasoning', content: [{ type: 'output_text', text: 'reasoning' }] },
      { type: 'message', content: [{ type: 'refusal', refusal: 'refused' }] }
    ] })).toBe('');
  });
});
