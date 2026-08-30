import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { type ApiConfig, DEFAULT_CONFIG, ENV_BASE_URL } from '@/types/config';
import type { ProviderConfig } from '@/types/provider';

export const useConfigStore = defineStore('config', () => {
  const hasEnvBaseUrl = computed(() => ENV_BASE_URL.length > 0);

  const baseUrl = ref<string>(localStorage.getItem('gpt_image_base_url') || DEFAULT_CONFIG.baseUrl);
  const apiKey = ref<string>(localStorage.getItem('gpt_image_api_key') || DEFAULT_CONFIG.apiKey);
  // 请求仍携带 model；当前默认 gpt-image-2，配置弹窗不暴露以免误配其他模型
  const model = ref<string>(localStorage.getItem('gpt_image_model') || DEFAULT_CONFIG.model);

  const effectiveBaseUrl = computed(() => (hasEnvBaseUrl.value ? ENV_BASE_URL : baseUrl.value.trim()));

  const isConfigured = computed(
    () => apiKey.value.trim().length > 0 && effectiveBaseUrl.value.length > 0
  );

  const providerConfig = computed<ProviderConfig>(() => ({
    baseUrl: effectiveBaseUrl.value,
    apiKey: apiKey.value.trim(),
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

  return {
    baseUrl,
    effectiveBaseUrl,
    hasEnvBaseUrl,
    apiKey,
    model,
    isConfigured,
    providerConfig,
    updateConfig
  };
});
