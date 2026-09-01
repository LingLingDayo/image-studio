/**
 * API 错误智能解析与清洗工具
 */

/**
 * 常见安全与审核限制关键词
 */
const SAFETY_KEYWORDS = [
  'content_policy_violation',
  'safety',
  'safety_ratings',
  'moderation',
  'sensitive',
  'inappropriate',
  'blocked by safety filter',
  'safety system',
  'nsfw',
  'violate',
  'policy violation'
];

/**
 * 常见认证与权限关键词
 */
const AUTH_KEYWORDS = [
  'invalid_api_key',
  'incorrect api key',
  'invalid api key',
  'unauthorized',
  'authentication',
  'permission_denied'
];

/**
 * 常见额度与限流关键词
 */
const RATE_LIMIT_KEYWORDS = [
  'insufficient_quota',
  'quota_exceeded',
  'rate_limit_exceeded',
  'rate limit',
  'too many requests',
  'quota'
];

/**
 * 常见模型关键词
 */
const MODEL_KEYWORDS = [
  'model_not_found',
  'does not exist',
  'model not found',
  'invalid_model'
];

/**
 * 判断是否为 HTML 内容
 */
export function isHtmlContent(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<?xml') ||
    (trimmed.includes('<head>') && trimmed.includes('<body>')) ||
    (trimmed.includes('<title>') && trimmed.includes('</title>'))
  );
}

/**
 * 从 HTML 文本中提取页面标题或主要错误标题
 */
export function extractHtmlTitle(html: string): string | null {
  if (!html) return null;

  // 匹配 <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawTitle) {
      // 过滤 Cloudflare 默认验证标题
      if (rawTitle.includes('Just a moment')) {
        return 'Cloudflare 安全验证拦截 (请检查网络或防爬虫规则)';
      }
      return rawTitle;
    }
  }

  // 匹配 <h1>...</h1> 或 <h2>...</h2>
  const hMatch = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  if (hMatch && hMatch[1]) {
    const rawHeading = hMatch[1].replace(/<[^>]+>/g, '').trim();
    if (rawHeading && rawHeading.length < 100) {
      return rawHeading;
    }
  }

  return null;
}

/**
 * 从 JSON 对象中智能递归提取错误文本
 */
export function extractJsonErrorMessage(json: any): string | null {
  if (!json || typeof json !== 'object') return null;

  if (typeof json.error === 'string') {
    return json.error;
  }

  if (json.error && typeof json.error === 'object') {
    if (typeof json.error.message === 'string' && json.error.message.trim()) {
      return json.error.message.trim();
    }
    if (typeof json.error.detail === 'string' && json.error.detail.trim()) {
      return json.error.detail.trim();
    }
    if (typeof json.error.code === 'string') {
      return `错误代码: ${json.error.code}`;
    }
  }

  if (typeof json.message === 'string' && json.message.trim()) {
    return json.message.trim();
  }

  if (typeof json.detail === 'string' && json.detail.trim()) {
    return json.detail.trim();
  }

  if (Array.isArray(json.detail) && json.detail.length > 0) {
    const first = json.detail[0];
    if (typeof first === 'string') return first;
    if (first?.msg) return first.msg;
  }

  return null;
}

/**
 * 对错误详情按类型增强分类标签
 */
export function categorizeErrorDetail(message: string, status?: number): string {
  const lower = message.toLowerCase();

  if (SAFETY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return `[内容安全审核拦截] ${message}`;
  }

  if (status === 401 || AUTH_KEYWORDS.some((kw) => lower.includes(kw))) {
    return `[API Key 鉴权失败] ${message}`;
  }

  if (status === 429 || RATE_LIMIT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return `[额度超限/请求受限] ${message}`;
  }

  if (status === 404 || MODEL_KEYWORDS.some((kw) => lower.includes(kw))) {
    return `[模型或接口不存在] ${message}`;
  }

  if (status === 502) {
    return `[网关错误 502] ${message}`;
  }

  if (status === 504) {
    return `[网关超时 504] ${message}`;
  }

  if (status && status >= 500) {
    return `[服务端错误 ${status}] ${message}`;
  }

  return message;
}

/**
 * 从 Fetch Response 中提取友好、清晰的错误信息
 */
export async function extractResponseError(response: Response | any, defaultActionName = '请求失败'): Promise<string> {
  const status = response?.status;
  const statusText = response?.statusText || '';

  // 兼容 mock 环境或没有 text 方法的环境
  if (typeof response?.text !== 'function' && typeof response?.json === 'function') {
    try {
      const json = await response.json();
      const detail = extractJsonErrorMessage(json);
      if (detail) {
        return categorizeErrorDetail(detail, status);
      }
    } catch {
      // ignore
    }
    const errorMsg = statusText ? `HTTP ${status} (${statusText})` : `HTTP ${status}`;
    return categorizeErrorDetail(errorMsg, status);
  }

  let rawBody = '';
  try {
    rawBody = await response.text();
  } catch {
    if (typeof response?.json === 'function') {
      try {
        const json = await response.json();
        const detail = extractJsonErrorMessage(json);
        if (detail) return categorizeErrorDetail(detail, status);
      } catch {
        // ignore
      }
    }
    return `${defaultActionName}: HTTP ${status} ${statusText}`.trim();
  }

  const cleanBody = rawBody.trim();

  // 空响应体
  if (!cleanBody) {
    const errorMsg = statusText ? `HTTP ${status} (${statusText})` : `HTTP ${status}`;
    return categorizeErrorDetail(errorMsg, status);
  }

  // 1. 尝试解析为 JSON
  try {
    const json = JSON.parse(cleanBody);
    const detail = extractJsonErrorMessage(json);
    if (detail) {
      return categorizeErrorDetail(detail, status);
    }
  } catch {
    // 非 JSON，继续检查
  }

  // 2. 检测是否为 HTML 网页
  if (isHtmlContent(cleanBody)) {
    const title = extractHtmlTitle(cleanBody);
    if (title) {
      return categorizeErrorDetail(`服务返回 HTML 页面: ${title}`, status);
    }
    if (status === 502) {
      return '[网关错误 502] 服务网关无响应 (Bad Gateway)，返回了 HTML 错误页';
    }
    if (status === 504) {
      return '[网关超时 504] 上游生图服务响应超时 (Gateway Timeout)';
    }
    return `[HTTP ${status}] 服务端/反向代理异常，返回了 HTML 页面而非 API 数据`;
  }

  // 3. 普通文本（限制长度）
  const truncated = cleanBody.length > 200 ? `${cleanBody.slice(0, 200)}...` : cleanBody;
  return categorizeErrorDetail(truncated, status);
}

/**
 * 封装带友好错误解析的 JSON 获取，杜绝抛出 Unexpected token '<' 异常
 */
export async function parseResponseSafeJson(response: Response | any, actionName = '生图'): Promise<any> {
  if (!response) {
    throw new Error(`${actionName}失败: 服务端返回了空响应`);
  }

  // 兼容 mock 环境或无 text 方法环境
  if (typeof response.text !== 'function' && typeof response.json === 'function') {
    return await response.json();
  }

  let rawText = '';
  try {
    rawText = await response.text();
  } catch {
    if (typeof response.json === 'function') {
      return await response.json();
    }
    throw new Error(`${actionName}失败: 无法读取响应体`);
  }

  const clean = rawText.trim();

  if (!clean) {
    throw new Error(`${actionName}失败: 服务端返回了空响应`);
  }

  try {
    return JSON.parse(clean);
  } catch {
    if (isHtmlContent(clean)) {
      const title = extractHtmlTitle(clean);
      const titleInfo = title ? ` (${title})` : '';
      throw new Error(`${actionName}失败: 接口返回了 HTML 网页而非 JSON 数据${titleInfo}，请检查 API Base URL 或反向代理状态`);
    }
    const preview = clean.length > 100 ? `${clean.slice(0, 100)}...` : clean;
    throw new Error(`${actionName}失败: 接口返回了无效的非 JSON 数据: ${preview}`);
  }
}
