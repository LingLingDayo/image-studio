<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { X, Save, Key, ImageIcon, Sparkles } from 'lucide-vue-next';
import { UiButton } from '@/components/ui';
import ImageConfigTab from './config/ImageConfigTab.vue';
import OptimizerConfigTab from './config/OptimizerConfigTab.vue';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    initialTab?: 'image' | 'optimizer';
  }>(),
  {
    initialTab: 'image'
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const configStore = useConfigStore();

const activeTab = ref<'image' | 'optimizer'>('image');
const optimizerTabRef = ref<InstanceType<typeof OptimizerConfigTab> | null>(null);

// 生图服务本地表单
const localBaseUrl = ref(configStore.baseUrl);
const localApiKey = ref(configStore.apiKey);

// 优化模型本地表单
const localOptimizerBaseUrl = ref(configStore.optimizerBaseUrl);
const localOptimizerApiKey = ref(configStore.optimizerApiKey);
const localOptimizerModel = ref(configStore.optimizerModel);
const localOptimizerEndpoint = ref(configStore.optimizerEndpoint);

// 计算生图服务有效 Base URL
const effectiveImageBaseUrl = computed(() =>
  configStore.hasEnvBaseUrl ? configStore.effectiveBaseUrl : localBaseUrl.value.trim()
);

// 计算优化服务有效 Base URL
const effectiveOptimizerBaseUrl = computed(() =>
  configStore.hasEnvOptimizerBaseUrl
    ? configStore.effectiveOptimizerBaseUrl
    : localOptimizerBaseUrl.value.trim()
);

// 生图配置校验
const isImageFormValid = computed(() => {
  return effectiveImageBaseUrl.value.length > 0 && localApiKey.value.trim().length > 0;
});

// 同步 Store 到表单
function syncFromStore() {
  localBaseUrl.value = configStore.baseUrl;
  localApiKey.value = configStore.apiKey;
  localOptimizerBaseUrl.value = configStore.optimizerBaseUrl;
  localOptimizerApiKey.value = configStore.optimizerApiKey;
  localOptimizerModel.value = configStore.optimizerModel;
  localOptimizerEndpoint.value = configStore.optimizerEndpoint;
  optimizerTabRef.value?.resetStatus();
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      activeTab.value = props.initialTab || 'image';
      syncFromStore();
      // 如果优化模型配置了 key 与 url，自动预拉取一次模型列表
      if (effectiveOptimizerBaseUrl.value && localOptimizerApiKey.value.trim()) {
        setTimeout(() => {
          optimizerTabRef.value?.handleFetchModels();
        }, 50);
      }
    }
  }
);

function handleSave() {
  if (!isImageFormValid.value) {
    activeTab.value = 'image';
    return;
  }

  // 1. 保存生图配置
  configStore.updateConfig({
    ...(configStore.hasEnvBaseUrl ? {} : { baseUrl: localBaseUrl.value }),
    apiKey: localApiKey.value
  });

  // 2. 保存提示词优化配置
  configStore.updateOptimizerConfig({
    ...(configStore.hasEnvOptimizerBaseUrl ? {} : { baseUrl: localOptimizerBaseUrl.value }),
    apiKey: localOptimizerApiKey.value,
    model: localOptimizerModel.value,
    endpoint: localOptimizerEndpoint.value
  });

  emit('saved');
  emit('close');
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="emit('close')">
    <div class="config-dialog">
      <!-- 弹窗顶栏 -->
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <div class="icon-circle">
            <Key :size="18" />
          </div>
          <div>
            <h3>系统设置</h3>
            <p>管理生图接口与提示词优化大模型配置</p>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Tab 切换导航 -->
      <div class="tab-nav-bar">
        <button
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'image' }"
          @click="activeTab = 'image'"
        >
          <ImageIcon :size="14" />
          <span>生图服务 (Image)</span>
        </button>
        <button
          class="tab-btn"
          :class="{ 'is-active': activeTab === 'optimizer' }"
          @click="activeTab = 'optimizer'"
        >
          <Sparkles :size="14" />
          <span>提示词优化 (Optimizer)</span>
          <span
            v-if="configStore.isOptimizerConfigured"
            class="badge-configured"
            title="已就绪"
          ></span>
        </button>
      </div>

      <div class="dialog-body">
        <!-- 1. 生图服务 Tab -->
        <ImageConfigTab
          v-if="activeTab === 'image'"
          v-model:base-url="localBaseUrl"
          v-model:api-key="localApiKey"
        />

        <!-- 2. 提示词优化大模型 Tab -->
        <OptimizerConfigTab
          v-if="activeTab === 'optimizer'"
          ref="optimizerTabRef"
          v-model:base-url="localOptimizerBaseUrl"
          v-model:api-key="localOptimizerApiKey"
          v-model:model="localOptimizerModel"
          v-model:endpoint="localOptimizerEndpoint"
        />
      </div>

      <div class="dialog-footer">
        <UiButton variant="secondary" @click="emit('close')">
          取消
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!isImageFormValid"
          @click="handleSave"
        >
          <template #icon>
            <Save :size="15" />
          </template>
          保存设置
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.config-dialog {
  max-width: 540px;
  width: 100%;
  max-height: 90vh;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  box-shadow: $shadow-float;
  display: flex;
  flex-direction: column;
  animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(241, 245, 249, 0.9);
}

.dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;

  .icon-circle {
    width: 38px;
    height: 38px;
    border-radius: $radius-lg;
    background: $accent-subtle;
    color: $accent-primary;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: $text-main;
  }

  p {
    font-size: 0.8rem;
    color: $text-muted;
  }
}

.btn-close {
  background: none;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &:hover {
    background: #f1f5f9;
    color: $text-main;
  }
}

.tab-nav-bar {
  display: flex;
  padding: 8px 24px;
  gap: 8px;
  background: #f8fafc;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: $radius-md;
  border: 1px solid transparent;
  background: transparent;
  color: $text-muted;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.6);
  }

  &.is-active {
    background: #ffffff;
    color: $accent-primary;
    font-weight: 600;
    border-color: rgba(226, 232, 240, 0.9);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .badge-configured {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
  }
}

.dialog-body {
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  max-height: calc(90vh - 190px);
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(241, 245, 249, 0.9);
  background: #ffffff;
  border-radius: 0 0 20px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
