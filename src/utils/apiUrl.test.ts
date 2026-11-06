import { describe, expect, it } from 'vitest';
import { isHttpUrl, normalizeEndpointUrl } from './apiUrl';

describe('API 地址', () => {
  it('接受带或不带 v1 的完整 HTTP 地址', () => {
    expect(isHttpUrl(' https://api.example.com/v1 ')).toBe(true);
    expect(isHttpUrl('http://localhost:8080')).toBe(true);
    expect(normalizeEndpointUrl('https://api.example.com/v1', '/v1/models')).toBe('https://api.example.com/v1/models');
  });

  it.each(['', 'api.example.com', '/v1', 'https:api.example.com', 'https://', 'ftp://api.example.com', 'javascript:alert(1)'])('拒绝不可用的接口地址 %s', (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});
