export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: import.meta.env.VITE_IMAGE_API_BASE_URL || '',
  apiKey: import.meta.env.VITE_IMAGE_API_KEY || '',
  model: 'gpt-image-2'
};
