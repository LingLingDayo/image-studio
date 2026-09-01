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
export const ENV_OPTIMIZER_MODEL: string = (import.meta.env.VITE_OPTIMIZER_MODEL || '').trim();
export const ENV_OPTIMIZER_ENDPOINT: string = (import.meta.env.VITE_OPTIMIZER_ENDPOINT || '').trim() || '/v1/chat/completions';
export const ENV_OPTIMIZER_API_KEY_HINT: string = (import.meta.env.VITE_OPTIMIZER_API_KEY_HINT || '').trim() || DEFAULT_API_KEY_HINT;

export const DEFAULT_OPTIMIZER_CONFIG: OptimizerConfig = {
  baseUrl: ENV_OPTIMIZER_BASE_URL,
  apiKey: ENV_OPTIMIZER_API_KEY,
  model: ENV_OPTIMIZER_MODEL,
  endpoint: ENV_OPTIMIZER_ENDPOINT
};

export const DEFAULT_OPTIMIZER_PROMPT_TEMPLATE = `你是一位顶尖的 AI 生图提示词工程专家。你的任务是将用户输入的简要生图概念扩写并优化为丰富、生动且极具画面细节的高质量提示词。重点补充：主体特征细节、艺术风格、光影效果、色彩基调、构图与镜头视角、材质质感及环境氛围。务必忠实保留用户的原始主体与核心意图。只直接输出优化后的提示词内容，严禁输出任何问候语、前缀、解释说明或 Markdown 代码块。

用户输入的提示词：{prompt}`;

export const ENV_OPTIMIZER_PROMPT_TEMPLATE: string =
  (import.meta.env.VITE_OPTIMIZER_PROMPT_TEMPLATE || '').trim() || DEFAULT_OPTIMIZER_PROMPT_TEMPLATE;

export const COMMON_OPTIMIZER_ENDPOINTS = [
  { label: '/v1/chat/completions (推荐)', value: '/v1/chat/completions' },
  { label: '/v1/messages (Claude)', value: '/v1/messages' },
  { label: '/v1/responses', value: '/v1/responses' }
];
