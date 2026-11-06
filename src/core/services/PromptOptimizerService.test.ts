import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OptimizerConfig } from '@/types/config';
import { PromptOptimizerService, normalizeEndpointUrl } from './PromptOptimizerService';

describe('PromptOptimizerService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeEndpointUrl', () => {
    it('should correctly join base and path without duplicating /v1', () => {
      expect(normalizeEndpointUrl('https://api.example.com', '/models')).toBe('https://api.example.com/v1/models');
      expect(normalizeEndpointUrl('https://api.example.com/v1', '/models')).toBe('https://api.example.com/v1/models');
      expect(normalizeEndpointUrl('https://api.example.com/v1/', '/v1/chat/completions')).toBe(
        'https://api.example.com/v1/chat/completions'
      );
      expect(normalizeEndpointUrl('https://api.example.com', '/v1/chat/completions')).toBe(
        'https://api.example.com/v1/chat/completions'
      );
    });
  });

  describe('fetchModels', () => {
    it('should fetch and sort models correctly with gpt-5.6-terra prioritized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'b-model' },
            { id: 'gpt-4o' },
            { id: 'gpt-5.6-terra' },
            { id: 'a-model' },
            { id: 'claude-3-5-sonnet' }
          ]
        })
      });

      const models = await PromptOptimizerService.fetchModels('https://api.example.com', 'sk-test');
      expect(models).toContain('gpt-5.6-terra');
      expect(models).toContain('gpt-4o');
      expect(models).toContain('claude-3-5-sonnet');
      // Priority models come first
      expect(models[0]).toBe('gpt-5.6-terra');
      expect(models[1]).toBe('gpt-4o');
      expect(models[2]).toBe('claude-3-5-sonnet');
    });

    it('should throw error when request fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: { message: 'Invalid token' } })
      });

      await expect(
        PromptOptimizerService.fetchModels('https://api.example.com', 'sk-bad')
      ).rejects.toThrow('Invalid token');
    });
  });

  describe('optimizePrompt', () => {
    it('should substitute template {prompt} and return cleaned response', async () => {
      let sentBody: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: any, init: any) => {
        sentBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '"A cinematic photo of a beautiful bird, highly detailed, soft sunlight"'
                }
              }
            ]
          })
        };
      });

      const result = await PromptOptimizerService.optimizePrompt(
        {
          baseUrl: 'https://api.example.com',
          apiKey: 'sk-test',
          model: 'gpt-4o-mini',
          endpoint: '/v1/chat/completions'
        },
        'a cute bird',
        'Optimize this: {prompt}'
      );

      expect(sentBody.messages[0].content).toBe('Optimize this: a cute bird');
      expect(result).toBe('A cinematic photo of a beautiful bird, highly detailed, soft sunlight');
    });

    it('should correctly format request and parse response for Claude Messages API', async () => {
      let sentBody: any = null;
      let sentHeaders: any = null;
      globalThis.fetch = vi.fn().mockImplementation(async (_url: any, init: any) => {
        sentBody = JSON.parse(init.body);
        sentHeaders = init.headers;
        return {
          ok: true,
          json: async () => ({
            id: 'msg_123',
            type: 'message',
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'A majestic lion basking in golden hour light, 8k resolution'
              }
            ]
          })
        };
      });

      const result = await PromptOptimizerService.optimizePrompt(
        {
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-ant-test',
          model: 'claude-3-5-sonnet-20241022',
          endpoint: '/v1/messages'
        },
        'a golden lion',
        'Enhance: {prompt}'
      );

      expect(sentBody.max_tokens).toBe(2048);
      expect(sentBody.messages[0].content).toBe('Enhance: a golden lion');
      expect(sentHeaders['x-api-key']).toBe('sk-ant-test');
      expect(sentHeaders['anthropic-version']).toBe('2023-06-01');
      expect(result).toBe('A majestic lion basking in golden hour light, 8k resolution');
    });

    it('should throw error if prompt is empty', async () => {
      await expect(
        PromptOptimizerService.optimizePrompt(
          {
            baseUrl: 'https://api.example.com',
            apiKey: 'sk-test',
            model: 'gpt-4o-mini',
            endpoint: '/v1/chat/completions'
          },
          '   '
        )
      ).rejects.toThrow('请输入提示词后再进行优化');
    });
  });
});

const PROTOCOL_CONFIG: OptimizerConfig = {
  baseUrl: 'https://api.example.com/v1',
  apiKey: ' test-key ',
  model: ' test-model ',
  endpoint: '/v1/chat/completions'
};

function mockProtocolResponse(data: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('提示词优化协议边界', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    { endpoint: undefined, headers: { Authorization: 'Bearer test-key' } },
    { endpoint: '/responses', headers: { Authorization: 'Bearer test-key' } },
    { endpoint: '/messages', headers: { 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' } }
  ])('模型列表按 $endpoint 协议选择认证，且保持参数兼容', async ({ endpoint, headers }) => {
    const fetchMock = mockProtocolResponse({ data: [{ id: 'model-a' }] });
    const controller = new AbortController();
    expect(await PromptOptimizerService.fetchModels('https://api.example.com', ' test-key ', controller.signal, endpoint)).toEqual(['model-a']);
    expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'GET', headers, signal: controller.signal });
  });

  it('Responses 兼容服务可使用 output_text 字段，但原生 output 优先', async () => {
    mockProtocolResponse({ output_text: 'compatibility' });
    expect(await PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint: '/responses' }, 'input', '{prompt}')).toBe('compatibility');
    mockProtocolResponse({ output_text: 'ignored', output: [{ type: 'message', content: [{ type: 'output_text', text: 'native' }] }] });
    expect(await PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint: '/responses' }, 'input', '{prompt}')).toBe('native');
  });

  it('HTTP 200 的业务错误响应仍然报错且不读取正文', async () => {
    mockProtocolResponse({ error: { message: 'provider unavailable' }, choices: [{ message: { content: 'wrong' } }] });
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}')).rejects.toThrow('provider unavailable');
  });

  it('读取响应时中止也保持原始 AbortError', async () => {
    const controller = new AbortController();
    const aborted = new DOMException('cancelled while reading', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => { controller.abort(aborted); throw aborted; }
    }));
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}', controller.signal)).rejects.toBe(aborted);
  });
  it('Chat Completions 仅使用 Bearer，完整替换模板并保留兼容请求结构', async () => {
    const fetchMock = mockProtocolResponse({ choices: [{ message: { content: 'result' } }] });
    const result = await PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, ' input ', '{prompt}/{prompt}');
    expect(result).toBe('result');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-key' });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'test-model', messages: [{ role: 'user', content: 'input/input' }], temperature: 0.7
    });
  });

  it.each(['/v1/responses', '/responses', 'responses'])('Responses 使用 input 并解析原生 output：%s', async (endpoint) => {
    const fetchMock = mockProtocolResponse({
      status: 'completed',
      output: [
        { type: 'reasoning', summary: [{ type: 'summary_text', text: '不要显示思考' }] },
        { type: 'message', role: 'assistant', content: [
          { type: 'output_text', text: '优化后的' },
          { type: 'output_text', text: '提示词' }
        ] }
      ]
    });
    expect(await PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint }, 'input', '模板:{prompt}')).toBe('优化后的提示词');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/responses');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-key' });
    expect(JSON.parse(String(init.body))).toEqual({ model: 'test-model', input: '模板:input', store: false });
  });

  it('Messages 使用自身认证头与 max_tokens，只读取文本块', async () => {
    const fetchMock = mockProtocolResponse({ content: [
      { type: 'thinking', thinking: 'hidden', text: '忽略思考' },
      { type: 'tool_use', name: 'tool', input: {} },
      { type: 'text', text: '可用的' }, { type: 'text', text: '提示词' }
    ] });
    expect(await PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint: '/messages' }, 'input', '{prompt}')).toBe('可用的提示词');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/messages');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'x-api-key': 'test-key', 'anthropic-version': '2023-06-01' });
    expect(JSON.parse(String(init.body))).toEqual({
      model: 'test-model', messages: [{ role: 'user', content: 'input' }], temperature: 0.7, max_tokens: 2048
    });
  });

  it('Chat 内容数组仅拼接文本，忽略图片与工具内容', async () => {
    mockProtocolResponse({ choices: [{ message: { content: [
      { type: 'text', text: 'one' }, { type: 'image_url', image_url: { url: 'https://example.com/x' } }, { type: 'text', text: 'two' }
    ] } }] });
    expect(await PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}')).toBe('onetwo');
  });

  it.each(['failed', 'incomplete'])('Responses 状态 %s 不把局部输出当作成功结果', async (status) => {
    mockProtocolResponse({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: 'partial' }] }] });
    await expect(PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint: '/responses' }, 'input', '{prompt}')).rejects.toThrow('未完成');
  });

  it('不支持的端点在请求前明确报错', async () => {
    const fetchMock = mockProtocolResponse({ choices: [{ message: { content: 'wrong' } }] });
    await expect(PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, endpoint: '/v1/unknown' }, 'input')).rejects.toThrow('不支持');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('空模型不使用硬编码默认模型，也不发起请求', async () => {
    const fetchMock = mockProtocolResponse({ choices: [{ message: { content: 'wrong' } }] });
    await expect(PromptOptimizerService.optimizePrompt({ ...PROTOCOL_CONFIG, model: '  ' }, 'input')).rejects.toThrow('模型名称');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('中止请求保持 AbortError，并传递原始 signal', async () => {
    const controller = new AbortController();
    const aborted = new DOMException('cancelled', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(aborted);
    vi.stubGlobal('fetch', fetchMock);
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}', controller.signal)).rejects.toBe(aborted);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('已经中止的请求不再发起网络调用', async () => {
    const fetchMock = mockProtocolResponse({ choices: [{ message: { content: 'wrong' } }] });
    const controller = new AbortController();
    controller.abort();
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('保留 HTTP 失败详情，不把错误响应当作正文', async () => {
    mockProtocolResponse({ error: { message: 'Invalid token' } }, 401);
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}')).rejects.toThrow('Invalid token');
  });

  it('清理代码块后空输出仍然报错', async () => {
    mockProtocolResponse({ choices: [{ message: { content: '```text\n```' } }] });
    await expect(PromptOptimizerService.optimizePrompt(PROTOCOL_CONFIG, 'input', '{prompt}')).rejects.toThrow('有效');
  });
});