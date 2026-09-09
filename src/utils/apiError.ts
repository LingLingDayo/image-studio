/**
 * API 错误智能解析与清洗工具
 */

/**
 * 常见安全与审核限制关键词
 */
const SAFETY_KEYWORDS = [
  'content_policy_violation',
  'content policy',
  'content_policy',
  'safety_ratings',
  'safety filter',
  'safety system',
  'blocked by safety',
  'moderation_blocked',
  'moderation',
  'sensitive',
  'inappropriate',
  'nsfw',
  'violate',
  'policy violation',
  'prompt was blocked',
  'prompt is blocked',
  'not allowed by our safety',
  'safety',
  '被安全',
  '安全政策',
  '内容审核',
  '内容违规',
  '敏感内容',
  '审核拦截',
  '审核未通过'
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
  'permission_denied',
  '鉴权失败',
  '密钥无效'
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
  'quota',
  '额度',
  '次数用尽'
];

/**
 * 常见模型关键词
 */
const MODEL_KEYWORDS = [
  'model_not_found',
  'does not exist',
  'model not found',
  'invalid_model',
  '模型不存在'
];

/**
 * 服务不可用 / 过载
 */
const UNAVAILABLE_KEYWORDS = [
  'service unavailable',
  'service_unavailable',
  'overloaded',
  'no available channel',
  'no available',
  'upstream error',
  'upstream_error',
  '无可用渠道',
  '负载已饱和',
  '服务不可用',
  '服务繁忙',
  '上游异常'
];

/**
 * 超时
 */
const TIMEOUT_KEYWORDS = [
  'timeout',
  'timed out',
  'time out',
  'deadline exceeded',
  'gateway timeout',
  'signal timed out',
  'etimedout',
  '超时'
];

const JSON_MESSAGE_KEYS = [
  'message',
  'msg',
  'error_message',
  'errorMessage',
  'detail',
  'reason',
  'description',
  'error_description',
  'title'
];

const CATEGORY_PREFIX_RE = /^\[[^\]]+\]\s/;

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

function stripHtmlTags(text: string): string {
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从 HTML 文本中提取页面标题或主要错误标题
 */
export function extractHtmlTitle(html: string): string | null {
  if (!html) return null;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = stripHtmlTags(titleMatch[1]);
    if (rawTitle) {
      if (rawTitle.includes('Just a moment')) {
        return 'Cloudflare 安全验证拦截 (请检查网络或防爬虫规则)';
      }
      return rawTitle;
    }
  }

  const hMatch = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  if (hMatch && hMatch[1]) {
    const rawHeading = stripHtmlTags(hMatch[1]);
    if (rawHeading && rawHeading.length < 120) {
      return rawHeading;
    }
  }

  return null;
}

/**
 * 清洗错误文本：去掉 HTML 源码，保留可读摘要
 */
export function sanitizeErrorText(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (isHtmlContent(trimmed)) {
    const title = extractHtmlTitle(trimmed);
    if (title) return title;
    const stripped = stripHtmlTags(trimmed);
    if (stripped && stripped.length <= 240 && !stripped.includes('<')) {
      return stripped;
    }
    return '服务返回了 HTML 错误页，而非接口数据';
  }

  if (/<\/?[a-zA-Z][^>]*>/.test(trimmed)) {
    return stripHtmlTags(trimmed);
  }

  return trimmed;
}

/**
 * 从 JSON 对象中智能递归提取错误文本
 */
export function extractJsonErrorMessage(json: any, depth = 0): string | null {
  if (json == null || depth > 5) return null;

  if (typeof json === 'string') {
    const trimmed = json.trim();
    return trimmed || null;
  }

  if (typeof json !== 'object') return null;

  if (Array.isArray(json)) {
    for (const item of json) {
      const found = extractJsonErrorMessage(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  for (const key of JSON_MESSAGE_KEYS) {
    if (typeof json[key] === 'string' && json[key].trim()) {
      return json[key].trim();
    }
  }

  if (typeof json.error === 'string' && json.error.trim()) {
    return json.error.trim();
  }

  if (json.error && typeof json.error === 'object') {
    const nested = extractJsonErrorMessage(json.error, depth + 1);
    if (nested) return nested;
  }

  for (const key of ['errors', 'detail', 'details']) {
    if (key === 'detail' && typeof json.detail === 'string') continue;
    if (Array.isArray(json[key])) {
      const nested = extractJsonErrorMessage(json[key], depth + 1);
      if (nested) return nested;
    }
  }

  if (typeof json.code === 'string' && json.code.trim()) {
    return json.code.trim();
  }

  return null;
}

function includesKeyword(lower: string, keywords: string[]): boolean {
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * 对错误详情按类型增强分类标签
 */
export function categorizeErrorDetail(message: string, status?: number): string {
  const cleaned = sanitizeErrorText(message) || message;
  if (!cleaned) {
    return status ? `[HTTP ${status}] 请求失败` : '';
  }

  if (CATEGORY_PREFIX_RE.test(cleaned)) {
    return cleaned;
  }

  const lower = cleaned.toLowerCase();

  if (includesKeyword(lower, SAFETY_KEYWORDS)) {
    return `[内容安全审核拦截] ${cleaned}`;
  }

  if (status === 401 || status === 403 || includesKeyword(lower, AUTH_KEYWORDS)) {
    return `[API Key 鉴权失败] ${cleaned}`;
  }

  if (status === 429 || includesKeyword(lower, RATE_LIMIT_KEYWORDS)) {
    return `[额度超限/请求受限] ${cleaned}`;
  }

  if (status === 404 || includesKeyword(lower, MODEL_KEYWORDS)) {
    return `[模型或接口不存在] ${cleaned}`;
  }

  if (status === 408 || status === 504 || status === 524 || includesKeyword(lower, TIMEOUT_KEYWORDS)) {
    const tag = status && (status === 408 || status === 504 || status === 524) ? `[请求超时 ${status}]` : '[请求超时]';
    return `${tag} ${cleaned}`;
  }

  if (status === 503 || status === 529 || includesKeyword(lower, UNAVAILABLE_KEYWORDS)) {
    const tag = status && (status === 503 || status === 529) ? `[服务不可用 ${status}]` : '[服务不可用]';
    return `${tag} ${cleaned}`;
  }

  if (status === 502) {
    return `[网关错误 502] ${cleaned}`;
  }

  if (status && status >= 500) {
    return `[服务端错误 ${status}] ${cleaned}`;
  }

  return cleaned;
}

function isTimeoutMessage(lower: string): boolean {
  return includesKeyword(lower, TIMEOUT_KEYWORDS);
}

function isNetworkFailure(name: string, lower: string): boolean {
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('err_connection') ||
    lower.includes('err_name_not_resolved') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('net::') ||
    (name === 'TypeError' && (lower.includes('fetch') || lower.includes('network')))
  );
}

function isAbortMessage(name: string, lower: string): boolean {
  return (
    name === 'AbortError' ||
    lower === 'aborted' ||
    lower.includes('the operation was aborted') ||
    lower.includes('the user aborted') ||
    lower.includes('request aborted')
  );
}

/**
 * 将 fetch / 运行时异常转换为可读错误，避免直接展示 HTML 或浏览器内部文案
 */
export function formatThrownError(err: unknown, actionName = '生图'): string {
  if (err == null) {
    return `${actionName}失败: 未知错误`;
  }

  const anyErr = err as { name?: string; message?: string };
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const rawMessage = typeof anyErr.message === 'string' && anyErr.message.trim()
    ? anyErr.message
    : String(err);
  const message = sanitizeErrorText(rawMessage) || rawMessage;
  const lower = message.toLowerCase();

  if (
    message.startsWith(`${actionName}失败`) ||
    message.startsWith('生图失败') ||
    message.startsWith('图生图/编辑失败') ||
    CATEGORY_PREFIX_RE.test(message)
  ) {
    return message;
  }

  if (name === 'TimeoutError' || isTimeoutMessage(lower)) {
    const detail = message.includes('超时') ? message : '生图请求超时，服务未在限定时间内返回结果';
    return categorizeErrorDetail(detail, 504);
  }

  if (isAbortMessage(name, lower)) {
    return '请求已取消';
  }

  if (isNetworkFailure(name, lower)) {
    return '[网络连接失败] 无法连接到生图接口，请检查接口地址、网络或跨域配置';
  }

  if (isHtmlContent(rawMessage)) {
    return categorizeErrorDetail(message || '服务返回了 HTML 错误页');
  }

  return categorizeErrorDetail(message);
}

/**
 * 卡片左侧使用的短标题，详细原因仍展示完整 errorMessage
 */
export function getErrorHeadline(message?: string | null): string {
  if (!message) return '生成失败';
  if (message.includes('已取消') || message.includes('请求已取消')) return '已取消';
  if (
    message.includes('内容安全') ||
    message.includes('安全审核') ||
    message.includes('安全政策') ||
    message.includes('内容违规') ||
    message.includes('敏感内容')
  ) {
    return '安全拦截';
  }
  if (message.includes('鉴权') || message.includes('API Key')) return '鉴权失败';
  if (message.includes('额度') || message.includes('请求受限') || message.includes('[额度')) return '请求受限';
  if (message.includes('超时') || message.includes('504') || message.includes('408') || message.includes('524')) {
    return '请求超时';
  }
  if (message.includes('网络连接') || message.includes('网络异常')) return '网络异常';
  if (message.includes('503') || message.includes('服务不可用') || message.includes('过载')) return '服务不可用';
  if (message.includes('502') || message.includes('网关错误')) return '网关错误';
  if (message.includes('模型或接口不存在') || message.includes('[模型')) return '接口不存在';
  return '生成失败';
}

/**
 * 从 Fetch Response 中提取友好、清晰的错误信息
 */
export async function extractResponseError(response: Response | any, defaultActionName = '请求失败'): Promise<string> {
  const status = response?.status;
  const statusText = response?.statusText || '';

  const fallbackHttp = () => {
    const errorMsg = statusText ? `HTTP ${status} (${statusText})` : `HTTP ${status}`;
    return categorizeErrorDetail(errorMsg, status);
  };

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
    return fallbackHttp();
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
    return fallbackHttp() || `${defaultActionName}: HTTP ${status} ${statusText}`.trim();
  }

  const cleanBody = rawBody.trim();

  if (!cleanBody) {
    return fallbackHttp();
  }

  try {
    const json = JSON.parse(cleanBody);
    const detail = extractJsonErrorMessage(json);
    if (detail) {
      return categorizeErrorDetail(detail, status);
    }
    const compact = JSON.stringify(json);
    if (compact && compact !== '{}' && compact.length <= 240) {
      return categorizeErrorDetail(compact, status);
    }
  } catch {
    // 非 JSON，继续检查
  }

  if (isHtmlContent(cleanBody)) {
    const title = extractHtmlTitle(cleanBody);
    if (title) {
      return categorizeErrorDetail(`服务返回 HTML 页面: ${title}`, status);
    }
    if (status === 503) {
      return '[服务不可用 503] 生图服务暂时不可用 (Service Unavailable)';
    }
    if (status === 502) {
      return '[网关错误 502] 服务网关无响应 (Bad Gateway)，返回了 HTML 错误页';
    }
    if (status === 504) {
      return '[网关超时 504] 上游生图服务响应超时 (Gateway Timeout)';
    }
    if (status === 524) {
      return '[请求超时 524] 源站响应超时 (Cloudflare Timeout)';
    }
    return `[HTTP ${status}] 服务端/反向代理异常，返回了 HTML 页面而非 API 数据`;
  }

  const sanitized = sanitizeErrorText(cleanBody);
  const truncated = sanitized.length > 280 ? `${sanitized.slice(0, 280)}...` : sanitized;
  return categorizeErrorDetail(truncated, status);
}

/**
 * 封装带友好错误解析的 JSON 获取，杜绝抛出 Unexpected token '<' 异常
 */
export async function parseResponseSafeJson(response: Response | any, actionName = '生图'): Promise<any> {
  if (!response) {
    throw new Error(`${actionName}失败: 服务端返回了空响应`);
  }

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
    const sanitized = sanitizeErrorText(clean);
    const preview = sanitized.length > 100 ? `${sanitized.slice(0, 100)}...` : sanitized;
    throw new Error(`${actionName}失败: 接口返回了无效的非 JSON 数据: ${preview}`);
  }
}
