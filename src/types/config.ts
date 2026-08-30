export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const ENV_BASE_URL: string = (import.meta.env.VITE_IMAGE_API_BASE_URL || '').trim();
export const ENV_API_KEY: string = (import.meta.env.VITE_IMAGE_API_KEY || '').trim();

export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: ENV_BASE_URL,
  apiKey: ENV_API_KEY,
  model: 'gpt-image-2'
};
