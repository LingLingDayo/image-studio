import { describe, it, expect } from 'vitest';
import {
  isHtmlContent,
  extractHtmlTitle,
  extractJsonErrorMessage,
  categorizeErrorDetail,
  extractResponseError,
  parseResponseSafeJson,
  sanitizeErrorText,
  formatThrownError,
  getErrorHeadline
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
    expect(extractJsonErrorMessage({ code: 400, msg: '内容违规' })).toBe('内容违规');
    expect(extractJsonErrorMessage({ error: { code: 'content_policy_violation' } })).toBe('content_policy_violation');
    expect(extractJsonErrorMessage({ errors: [{ message: 'channel overloaded' }] })).toBe('channel overloaded');
  });

  it('should categorize error messages with friendly tags', () => {
    expect(categorizeErrorDetail('Your prompt was flagged by our safety system')).toContain('[内容安全审核拦截]');
    expect(categorizeErrorDetail('Invalid API Key provided', 401)).toContain('[API Key 鉴权失败]');
    expect(categorizeErrorDetail('insufficient_quota', 429)).toContain('[额度超限/请求受限]');
    expect(categorizeErrorDetail('The model `gpt-unknown` does not exist', 404)).toContain('[模型或接口不存在]');
    expect(categorizeErrorDetail('Bad Gateway', 502)).toContain('[网关错误 502]');
    expect(categorizeErrorDetail('Service Unavailable', 503)).toContain('[服务不可用 503]');
    expect(categorizeErrorDetail('Gateway Timeout', 504)).toContain('[请求超时 504]');
    expect(categorizeErrorDetail('upstream timeout: deadline exceeded')).toContain('[请求超时]');
  });

  it('should not double-prefix already categorized messages', () => {
    const tagged = '[内容安全审核拦截] prompt blocked';
    expect(categorizeErrorDetail(tagged)).toBe(tagged);
  });

  it('should strip HTML source instead of displaying it', () => {
    const html = '<!DOCTYPE html><html><head><title>503 Service Temporarily Unavailable</title></head><body><center><h1>503</h1></center></html>';
    const sanitized = sanitizeErrorText(html);
    expect(sanitized).toBe('503 Service Temporarily Unavailable');
    expect(sanitized).not.toContain('<html');
    expect(sanitized).not.toContain('<!DOCTYPE');
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
    expect(errorMsg).not.toContain('<html');
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

  it('should extract 503 and timeout errors from real gateway pages', async () => {
    const unavailable = new Response(
      '<html><head><title>503 Service Temporarily Unavailable</title></head><body><center><h1>503 Service Temporarily Unavailable</h1></center></html>',
      { status: 503, statusText: 'Service Unavailable' }
    );
    const unavailableMsg = await extractResponseError(unavailable, '生图');
    expect(unavailableMsg).toContain('[服务不可用 503]');
    expect(unavailableMsg).not.toContain('<center>');

    const timeout = new Response(
      '<html><head><title>504 Gateway Time-out</title></head></html>',
      { status: 504, statusText: 'Gateway Timeout' }
    );
    const timeoutMsg = await extractResponseError(timeout, '生图');
    expect(timeoutMsg).toContain('[请求超时 504]');

    const empty503 = new Response('', { status: 503, statusText: 'Service Unavailable' });
    const empty503Msg = await extractResponseError(empty503, '生图');
    expect(empty503Msg).toContain('[服务不可用 503]');
    expect(empty503Msg).toContain('HTTP 503');
  });

  it('should parse safe json when valid and throw friendly error when html', async () => {
    const okResponse = new Response(JSON.stringify({ data: [{ url: 'http://img.png' }] }), { status: 200 });
    const data = await parseResponseSafeJson(okResponse);
    expect(data.data[0].url).toBe('http://img.png');

    const htmlResponse = new Response('<!DOCTYPE html><html><head><title>Gateway Error</title></head></html>', { status: 200 });
    await expect(parseResponseSafeJson(htmlResponse, '生图')).rejects.toThrow('接口返回了 HTML 网页而非 JSON 数据');
  });

  it('should format network and timeout thrown errors', () => {
    expect(formatThrownError(new TypeError('Failed to fetch'))).toContain('[网络连接失败]');
    expect(formatThrownError(Object.assign(new Error('signal timed out'), { name: 'TimeoutError' }))).toContain('[请求超时');
    expect(formatThrownError(new DOMException('Aborted', 'AbortError'))).toBe('请求已取消');
    expect(formatThrownError(new Error('生图失败: [内容安全审核拦截] blocked'))).toBe('生图失败: [内容安全审核拦截] blocked');
  });

  it('should summarize error headlines for the task card', () => {
    expect(getErrorHeadline('[内容安全审核拦截] prompt blocked')).toBe('安全拦截');
    expect(getErrorHeadline('[服务不可用 503] Service Unavailable')).toBe('服务不可用');
    expect(getErrorHeadline('[请求超时 504] Gateway Timeout')).toBe('请求超时');
    expect(getErrorHeadline('[网络连接失败] 无法连接')).toBe('网络异常');
    expect(getErrorHeadline(undefined)).toBe('生成失败');
  });
});
