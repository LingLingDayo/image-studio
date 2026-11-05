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

export interface GeneralConfig {
  clearPromptOnGenerate: boolean;
  downloadFilenamePattern: string;
  downloadImageFormat: string;
}

export const DEFAULT_GENERAL_CONFIG: GeneralConfig = {
  clearPromptOnGenerate: false,
  downloadFilenamePattern: '{prefix}_{date}_{time}_{id}',
  downloadImageFormat: 'auto'
};


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

export const DEFAULT_OPTIMIZER_PROMPT_TEMPLATE = `你是一位精通视觉生成模型（如 FLUX、Midjourney、SDXL、DALL-E 等）的提示词架构与语义优化专家。
你的核心任务是【优化提示词】，使其描写更准确、视觉表达更具象、且更加便于 AI 模型精准理解与还原，严禁盲目扩写或堆砌无关辞藻。

请遵循以下优化原则：
1. 精准具象：将模糊、抽象或口语化的描述，转化为明确、具体的视觉特征（如明确主体特征、形态动作、材质质感、空间关系），消除歧义。
2. 易于 AI 理解：按视觉逻辑结构化组织描述（核心主体与动作 -> 环境与构图视角 -> 光影与色彩氛围 -> 艺术风格/媒介），剔除无意义的画质废话（如“超高清”、“杰作”等），使模型能精准捕捉关键权重。
3. 忠实核心意图：严格保持用户的原始主体、核心构想与基调，不擅自增添无关要素或篡改画面焦点。
4. 凝练克制：注重信息密度与精准度，避免繁冗冗余的文学修饰，保持提示词精炼高效。
5. 语言一致：保持与用户输入相同的主语言（中文输入输出中文优化，英文输入输出英文优化）。
6. 格式要求：直接输出优化后的提示词正文，严禁输出任何问候语、前缀标签、解析说明或 Markdown 代码块。

用户输入的提示词：{prompt}`;

export const ENV_OPTIMIZER_PROMPT_TEMPLATE: string =
  (import.meta.env.VITE_OPTIMIZER_PROMPT_TEMPLATE || '').trim() || DEFAULT_OPTIMIZER_PROMPT_TEMPLATE;

export const COMMON_OPTIMIZER_ENDPOINTS = [
  { label: '/v1/chat/completions (推荐)', value: '/v1/chat/completions' },
  { label: '/v1/messages (Claude)', value: '/v1/messages' },
  { label: '/v1/responses', value: '/v1/responses' }
];
