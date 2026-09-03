export const SETTING_KEYS = {
  imageBaseUrl: 'image.baseUrl',
  imageApiKey: 'image.apiKey',
  optimizerBaseUrl: 'optimizer.baseUrl',
  optimizerApiKey: 'optimizer.apiKey',
  optimizerModel: 'optimizer.model',
  optimizerEndpoint: 'optimizer.endpoint'
} as const;

export const SETTING_RUNTIME = {
  optimizerModels: 'optimizer.models',
  optimizerFetchStatus: 'optimizer.fetchStatus',
  optimizerIsFetching: 'optimizer.isFetching'
} as const;

export const SETTING_SECTION = {
  image: 'image',
  optimizer: 'optimizer'
} as const;

export const SETTING_CATEGORY = {
  service: '服务'
} as const;
