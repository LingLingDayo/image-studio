export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface OptimizerConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  endpoint: string;
}

export const ENV_BASE_URL: string = (import.meta.env.VITE_IMAGE_API_BASE_URL || '').trim();
export const ENV_API_KEY: string = (import.meta.env.VITE_IMAGE_API_KEY || '').trim();
export const DEFAULT_API_KEY_HINT = '令牌只保存在本机浏览器，不会上传到工作台服务器';
export const ENV_API_KEY_HINT: string = (import.meta.env.VITE_IMAGE_API_KEY_HINT || '').trim() || DEFAULT_API_KEY_HINT;

export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: ENV_BASE_URL,
  apiKey: ENV_API_KEY,
  model: 'gpt-image-2'
};

export const ENV_OPTIMIZER_BASE_URL: string = (import.meta.env.VITE_OPTIMIZER_API_BASE_URL || '').trim();
export const ENV_OPTIMIZER_API_KEY: string = (import.meta.env.VITE_OPTIMIZER_API_KEY || '').trim();
export const ENV_OPTIMIZER_MODEL: string = (import.meta.env.VITE_OPTIMIZER_MODEL || '').trim() || 'gpt-4o-mini';
export const ENV_OPTIMIZER_ENDPOINT: string = (import.meta.env.VITE_OPTIMIZER_ENDPOINT || '').trim() || '/v1/chat/completions';
export const ENV_OPTIMIZER_API_KEY_HINT: string = (import.meta.env.VITE_OPTIMIZER_API_KEY_HINT || '').trim() || DEFAULT_API_KEY_HINT;

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  baseUrl: ENV_OPTIMIZER_BASE_URL,
  apiKey: ENV_OPTIMIZER_API_KEY,
  model: ENV_OPTIMIZER_MODEL,
  endpoint: ENV_OPTIMIZER_ENDPOINT
};

export const DEFAULT_OPTIMIZER_PROMPT_TEMPLATE = `You are a master AI prompt engineer specializing in text-to-image prompts (e.g. Midjourney, DALL-E 3, FLUX, Stable Diffusion). Your task is to expand and enhance the user's brief concept into a rich, evocative, highly-detailed English prompt. Focus on: main subject details, artistic style, composition, lighting, color palette, camera lens/angle, textures, and atmosphere. Keep the original intent and core elements intact. Output ONLY the optimized prompt directly without any introductory, conversational, or markdown explanatory text.

User input: {prompt}`;

export const ENV_OPTIMIZER_PROMPT_TEMPLATE: string =
  (import.meta.env.VITE_OPTIMIZER_PROMPT_TEMPLATE || '').trim() || DEFAULT_OPTIMIZER_PROMPT_TEMPLATE;

export const COMMON_OPTIMIZER_ENDPOINTS = [
  { label: '/v1/chat/completions (Chat 对话补全 - 推荐)', value: '/v1/chat/completions' },
  { label: '/v1/responses (Responses API)', value: '/v1/responses' },
  { label: '/v1/completions (Legacy Completions)', value: '/v1/completions' }
];
