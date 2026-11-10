import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import {
  type ModelProfile,
  GPT_IMAGE_2_PROFILE,
  DEFAULT_IMAGE_MODEL_ID,
  createImageModelProfile,
  pickAvailableImageModel,
  resolveImageModelList
} from '@/types/model';
import { useConfigStore } from '@/stores/configStore';
import { fetchRemoteModels } from '@/utils/fetchRemoteModels';

interface ModelFetchRequest {
  baseUrl: string;
  apiKey: string;
  version: number;
  promise: Promise<string[]>;
}

export const useModelStore = defineStore('model', () => {
  const configStore = useConfigStore();

  const registeredModels = ref<ModelProfile[]>([createImageModelProfile(GPT_IMAGE_2_PROFILE.id)]);
  const initialModelId = (configStore.model || DEFAULT_IMAGE_MODEL_ID).trim() || DEFAULT_IMAGE_MODEL_ID;
  if (initialModelId !== GPT_IMAGE_2_PROFILE.id) {
    registeredModels.value.push(createImageModelProfile(initialModelId));
  }

  const activeModelId = ref<string>(initialModelId);
  const availableModels = ref<string[]>([activeModelId.value]);
  const isFetchingModels = ref(false);

  let inflightFetch: ModelFetchRequest | null = null;
  let requestVersion = 0;

  watch(
    () => [configStore.effectiveBaseUrl, configStore.effectiveApiKey] as const,
    () => {
      // 旧服务的列表与进行中的请求不能继续用于新凭据。
      requestVersion += 1;
      inflightFetch = null;
      isFetchingModels.value = false;
      availableModels.value = [activeModelId.value];
    },
    { flush: 'sync' }
  );

  const activeModel = computed<ModelProfile>(() => {
    return registeredModels.value.find((m) => m.id === activeModelId.value) || GPT_IMAGE_2_PROFILE;
  });

  /**
   * 注册新模型画像
   * // Extension Point: 后续如需接入 flux-pro 等模型，直接在此注册对应 profile 即可
   */
  function registerModel(profile: ModelProfile) {
    const existingIndex = registeredModels.value.findIndex((m) => m.id === profile.id);
    if (existingIndex !== -1) {
      registeredModels.value[existingIndex] = profile;
    } else {
      registeredModels.value.push(profile);
    }
  }

  function ensureProfile(modelId: string): ModelProfile {
    const existing = registeredModels.value.find((m) => m.id === modelId);
    if (existing) return existing;
    const profile = createImageModelProfile(modelId);
    registeredModels.value.push(profile);
    return profile;
  }

  function setActiveModel(modelId: string) {
    const id = modelId.trim();
    if (!id) return;
    ensureProfile(id);
    activeModelId.value = id;
    if (!availableModels.value.includes(id)) {
      availableModels.value = [id, ...availableModels.value];
    }
    if (configStore.model !== id) {
      configStore.updateConfig({ model: id });
    }
  }

  watch(() => configStore.model, (id) => {
    if (id && id.trim() !== activeModelId.value) setActiveModel(id);
  }, { flush: 'sync' });

  function startFetch(baseUrl: string, apiKey: string): ModelFetchRequest {
    const request: ModelFetchRequest = {
      baseUrl,
      apiKey,
      version: ++requestVersion,
      promise: fetchRemoteModels(baseUrl, apiKey).then(resolveImageModelList)
    };
    inflightFetch = request;
    isFetchingModels.value = true;
    return request;
  }

  function isCurrentRequest(request: ModelFetchRequest): boolean {
    return request.version === requestVersion &&
      request.baseUrl === configStore.effectiveBaseUrl &&
      request.apiKey === configStore.effectiveApiKey;
  }

  /**
   * 拉取当前生图 Key 的模型列表。
   * adjustSelection：页面加载/凭据变化时，若当前模型不在列表中则回退。
   */
  async function refreshAvailableModels(options?: { adjustSelection?: boolean }): Promise<void> {
    if (!configStore.isConfigured) return;

    const baseUrl = configStore.effectiveBaseUrl;
    const apiKey = configStore.effectiveApiKey;
    const request = inflightFetch?.baseUrl === baseUrl && inflightFetch.apiKey === apiKey
      ? inflightFetch
      : startFetch(baseUrl, apiKey);

    try {
      const list = await request.promise;
      if (!isCurrentRequest(request) || list.length === 0) return;

      availableModels.value = list;
      for (const id of list) {
        ensureProfile(id);
      }

      if (options?.adjustSelection) {
        const next = pickAvailableImageModel(list, activeModelId.value);
        if (next !== activeModelId.value) {
          setActiveModel(next);
        }
      }
    } catch {
      // 无感失败：保留当前选择与已有列表
    } finally {
      if (inflightFetch === request) {
        isFetchingModels.value = false;
        inflightFetch = null;
      }
    }
  }

  return {
    registeredModels,
    activeModelId,
    activeModel,
    availableModels,
    isFetchingModels,
    registerModel,
    setActiveModel,
    refreshAvailableModels,
    getModelProfile: ensureProfile
  };
});
