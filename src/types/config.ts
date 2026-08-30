export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
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
