export const SETTING_KEYS = {
  imageBaseUrl: 'image.baseUrl',
  imageApiKey: 'image.apiKey',
  optimizerBaseUrl: 'optimizer.baseUrl',
  optimizerApiKey: 'optimizer.apiKey',
  optimizerModel: 'optimizer.model',
  optimizerEndpoint: 'optimizer.endpoint',
  clearPromptOnGenerate: 'general.clearPromptOnGenerate',
  downloadFilenamePattern: 'general.downloadFilenamePattern',
  downloadImageFormat: 'general.downloadImageFormat'
} as const;

export const SETTING_RUNTIME = {
  optimizerModels: 'optimizer.models',
  optimizerFetchStatus: 'optimizer.fetchStatus',
  optimizerIsFetching: 'optimizer.isFetching'
} as const;

export const SETTING_SECTION = {
  general: 'general',
  image: 'image',
  optimizer: 'optimizer'
} as const;

export const SETTING_CATEGORY = {
  service: '服务',
  general: '通用'
} as const;

