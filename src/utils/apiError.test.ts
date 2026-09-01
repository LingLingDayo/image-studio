import { describe, it, expect } from 'vitest';
import {
  isHtmlContent,
  extractHtmlTitle,
  extractJsonErrorMessage,
  categorizeErrorDetail,
  extractResponseError,
  parseResponseSafeJson
} from './apiError';

describe('apiError utilities (apiError.ts)', () => {
  it('should identify HTML content correctly', () => {
    expect(isHtmlContent('<!DOCTYPE html><html><head><title>502</title></head></html>')).toBe(true);
    expect(isHtmlContent('<html><body>Error</body></html>')).toBe(true);
    expect(isHtmlContent('{"error": "bad request"}')).toBe(false);
    expect(isHtmlContent('Plain text error')).toBe(false);
  });

  it('should extract title from HTML', () => {
    const html = '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>';
    expect(extractHtmlTitle(html)).toBe('502 Bad Gateway');

    const cfHtml = '<html><head><title>Just a moment...</title></head></html>';
    expect(extractHtmlTitle(cfHtml)).toContain('Cloudflare');
  });

  it('should extract error message from standard JSON formats', () => {
    expect(extractJsonErrorMessage({ error: { message: 'Prompt blocked' } })).toBe('Prompt blocked');
    expect(extractJsonErrorMessage({ message: 'Rate limit exceeded' })).toBe('Rate limit exceeded');
    expect(extractJsonErrorMessage({ detail: 'Invalid token' })).toBe('Invalid token');
    expect(extractJsonErrorMessage({ detail: [{ msg: 'Field required' }] })).toBe('Field required');
  });

  it('should categorize error messages with friendly tags', () => {
    expect(categorizeErrorDetail('Your prompt was flagged by our safety system')).toContain('[内容安全审核拦截]');
    expect(categorizeErrorDetail('Invalid API Key provided', 401)).toContain('[API Key 鉴权失败]');
    expect(categorizeErrorDetail('insufficient_quota', 429)).toContain('[额度超限/请求受限]');
    expect(categorizeErrorDetail('The model `gpt-unknown` does not exist', 404)).toContain('[模型或接口不存在]');
    expect(categorizeErrorDetail('Bad Gateway', 502)).toContain('[网关错误 502]');
  });

  it('should extract friendly error from Response with HTML body', async () => {
    const response = new Response(
      '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>',
      { status: 502, statusText: 'Bad Gateway' }
    );
    const errorMsg = await extractResponseError(response, '生图失败');
    expect(errorMsg).toContain('502');
    expect(errorMsg).toContain('502 Bad Gateway');
    expect(errorMsg).not.toContain('<!DOCTYPE');
  });

  it('should extract friendly error from Response with JSON body', async () => {
    const response = new Response(
      JSON.stringify({ error: { message: 'content_policy_violation: prompt contains sensitive keywords' } }),
      { status: 400, statusText: 'Bad Request' }
    );
    const errorMsg = await extractResponseError(response, '生图失败');
    expect(errorMsg).toContain('[内容安全审核拦截]');
    expect(errorMsg).toContain('content_policy_violation');
  });

  it('should parse safe json when valid and throw friendly error when html', async () => {
    const okResponse = new Response(JSON.stringify({ data: [{ url: 'http://img.png' }] }), { status: 200 });
    const data = await parseResponseSafeJson(okResponse);
    expect(data.data[0].url).toBe('http://img.png');

    const htmlResponse = new Response('<!DOCTYPE html><html><head><title>Gateway Error</title></head></html>', { status: 200 });
    await expect(parseResponseSafeJson(htmlResponse, '生图')).rejects.toThrow('接口返回了 HTML 网页而非 JSON 数据');
  });
});
