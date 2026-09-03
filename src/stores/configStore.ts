import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  type ApiConfig,
  type OptimizerConfig,
  type GeneralConfig,
  DEFAULT_CONFIG,
  DEFAULT_OPTIMIZER_CONFIG,
  DEFAULT_GENERAL_CONFIG,
  ENV_BASE_URL,
  ENV_API_KEY,
  ENV_API_KEY_HINT,
  ENV_OPTIMIZER_BASE_URL,
  ENV_OPTIMIZER_API_KEY,
  ENV_OPTIMIZER_API_KEY_HINT
} from '@/types/config';
import type { ProviderConfig } from '@/types/provider';

export const useConfigStore = defineStore('config', () => {
  // ---- 1. 生图服务配置 ----
  const hasEnvBaseUrl = computed(() => ENV_BASE_URL.length > 0);
  const hasEnvApiKey = computed(() => ENV_API_KEY.length > 0);
  const apiKeyHint = computed(() => ENV_API_KEY_HINT);

  const baseUrl = ref<string>(localStorage.getItem('gpt_image_base_url') || DEFAULT_CONFIG.baseUrl);
  const apiKey = ref<string>(localStorage.getItem('gpt_image_api_key') || DEFAULT_CONFIG.apiKey);
  // 请求仍携带 model；当前默认 gpt-image-2，配置弹窗不暴露以免误配其他模型
  const model = ref<string>(localStorage.getItem('gpt_image_model') || DEFAULT_CONFIG.model);

  const effectiveBaseUrl = computed(() => (hasEnvBaseUrl.value ? ENV_BASE_URL : baseUrl.value.trim()));
  const effectiveApiKey = computed(() => (hasEnvApiKey.value ? ENV_API_KEY : apiKey.value.trim()));

  const isConfigured = computed(
    () => effectiveApiKey.value.length > 0 && effectiveBaseUrl.value.length > 0
  );

  const providerConfig = computed<ProviderConfig>(() => ({
    baseUrl: effectiveBaseUrl.value,
    apiKey: effectiveApiKey.value,
    model: model.value
  }));

  function updateConfig(newConfig: Partial<ApiConfig>) {
    if (newConfig.baseUrl !== undefined) {
      baseUrl.value = newConfig.baseUrl.trim();
      localStorage.setItem('gpt_image_base_url', baseUrl.value);
    }
    if (newConfig.apiKey !== undefined) {
      apiKey.value = newConfig.apiKey.trim();
      localStorage.setItem('gpt_image_api_key', apiKey.value);
    }
    if (newConfig.model !== undefined) {
      model.value = newConfig.model.trim();
      localStorage.setItem('gpt_image_model', model.value);
    }
  }

  // ---- 2. 提示词优化模型配置 ----
  const hasEnvOptimizerBaseUrl = computed(() => ENV_OPTIMIZER_BASE_URL.length > 0);
  const hasEnvOptimizerApiKey = computed(() => ENV_OPTIMIZER_API_KEY.length > 0);
  const optimizerApiKeyHint = computed(() => ENV_OPTIMIZER_API_KEY_HINT);

  const optimizerBaseUrl = ref<string>(
    localStorage.getItem('gpt_optimizer_base_url') || DEFAULT_OPTIMIZER_CONFIG.baseUrl
  );
  const optimizerApiKey = ref<string>(
    localStorage.getItem('gpt_optimizer_api_key') || DEFAULT_OPTIMIZER_CONFIG.apiKey
  );
  const optimizerModel = ref<string>(
    localStorage.getItem('gpt_optimizer_model') || DEFAULT_OPTIMIZER_CONFIG.model
  );
  const optimizerEndpoint = ref<string>(
    localStorage.getItem('gpt_optimizer_endpoint') || DEFAULT_OPTIMIZER_CONFIG.endpoint
  );

  const effectiveOptimizerBaseUrl = computed(() =>
    hasEnvOptimizerBaseUrl.value ? ENV_OPTIMIZER_BASE_URL : optimizerBaseUrl.value.trim()
  );
  const effectiveOptimizerApiKey = computed(() =>
    hasEnvOptimizerApiKey.value ? ENV_OPTIMIZER_API_KEY : optimizerApiKey.value.trim()
  );

  const isOptimizerConfigured = computed(
    () =>
      effectiveOptimizerApiKey.value.length > 0 &&
      effectiveOptimizerBaseUrl.value.length > 0 &&
      optimizerModel.value.trim().length > 0
  );

  const optimizerConfig = computed<OptimizerConfig>(() => ({
    baseUrl: effectiveOptimizerBaseUrl.value,
    apiKey: effectiveOptimizerApiKey.value,
    model: optimizerModel.value.trim() || 'gpt-5.6-terra',
    endpoint: optimizerEndpoint.value.trim() || '/v1/chat/completions'
  }));

  function updateOptimizerConfig(newConfig: Partial<OptimizerConfig>) {
    if (newConfig.baseUrl !== undefined) {
      optimizerBaseUrl.value = newConfig.baseUrl.trim();
      localStorage.setItem('gpt_optimizer_base_url', optimizerBaseUrl.value);
    }
    if (newConfig.apiKey !== undefined) {
      optimizerApiKey.value = newConfig.apiKey.trim();
      localStorage.setItem('gpt_optimizer_api_key', optimizerApiKey.value);
    }
    if (newConfig.model !== undefined) {
      optimizerModel.value = newConfig.model.trim();
      localStorage.setItem('gpt_optimizer_model', optimizerModel.value);
    }
    if (newConfig.endpoint !== undefined) {
      optimizerEndpoint.value = newConfig.endpoint.trim();
      localStorage.setItem('gpt_optimizer_endpoint', optimizerEndpoint.value);
    }
  }

  // ---- 3. 通用设置配置 ----
  const clearPromptOnGenerate = ref<boolean>(
    localStorage.getItem('gpt_image_clear_prompt_on_generate') === 'true'
      ? true
      : DEFAULT_GENERAL_CONFIG.clearPromptOnGenerate
  );
  const downloadFilenamePattern = ref<string>(
    localStorage.getItem('gpt_image_download_filename_pattern') || DEFAULT_GENERAL_CONFIG.downloadFilenamePattern
  );
  const downloadImageFormat = ref<string>(
    localStorage.getItem('gpt_image_download_format') || DEFAULT_GENERAL_CONFIG.downloadImageFormat
  );

  function updateGeneralConfig(newConfig: Partial<GeneralConfig>) {
    if (newConfig.clearPromptOnGenerate !== undefined) {
      clearPromptOnGenerate.value = Boolean(newConfig.clearPromptOnGenerate);
      localStorage.setItem('gpt_image_clear_prompt_on_generate', String(clearPromptOnGenerate.value));
    }
    if (newConfig.downloadFilenamePattern !== undefined) {
      downloadFilenamePattern.value = newConfig.downloadFilenamePattern.trim();
      localStorage.setItem('gpt_image_download_filename_pattern', downloadFilenamePattern.value);
    }
    if (newConfig.downloadImageFormat !== undefined) {
      downloadImageFormat.value = newConfig.downloadImageFormat.trim();
      localStorage.setItem('gpt_image_download_format', downloadImageFormat.value);
    }
  }

  return {
    // 生图配置
    baseUrl,
    effectiveBaseUrl,
    hasEnvBaseUrl,
    apiKey,
    effectiveApiKey,
    hasEnvApiKey,
    apiKeyHint,
    model,
    isConfigured,
    providerConfig,
    updateConfig,

    // 优化模型配置
    optimizerBaseUrl,
    effectiveOptimizerBaseUrl,
    hasEnvOptimizerBaseUrl,
    optimizerApiKey,
    effectiveOptimizerApiKey,
    hasEnvOptimizerApiKey,
    optimizerApiKeyHint,
    optimizerModel,
    optimizerEndpoint,
    isOptimizerConfigured,
    optimizerConfig,
    updateOptimizerConfig,

    // 通用配置
    clearPromptOnGenerate,
    downloadFilenamePattern,
    downloadImageFormat,
    updateGeneralConfig
  };
});
