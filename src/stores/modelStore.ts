import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { type ModelProfile, GPT_IMAGE_2_PROFILE } from '@/types/model';

export const useModelStore = defineStore('model', () => {
  // 注册的模型列表，默认加载 gpt-image-2
  const registeredModels = ref<ModelProfile[]>([GPT_IMAGE_2_PROFILE]);
  const activeModelId = ref<string>(GPT_IMAGE_2_PROFILE.id);

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

  function setActiveModel(modelId: string) {
    const target = registeredModels.value.find((m) => m.id === modelId);
    if (target) {
      activeModelId.value = target.id;
    }
  }

  return {
    registeredModels,
    activeModelId,
    activeModel,
    registerModel,
    setActiveModel
  };
});
