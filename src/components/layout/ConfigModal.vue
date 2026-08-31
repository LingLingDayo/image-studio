<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import { COMMON_OPTIMIZER_ENDPOINTS } from '@/types/config';
import {
  X,
  Save,
  Key,
  Globe,
  ImageIcon,
  Sparkles,
  RefreshCw,
  Cpu,
  Route,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next';
import { UiInput, UiButton, UiSelect } from '@/components/ui';

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

// 生图服务本地表单
const localBaseUrl = ref(configStore.baseUrl);
const localApiKey = ref(configStore.apiKey);

// 优化模型本地表单
const localOptimizerBaseUrl = ref(configStore.optimizerBaseUrl);
const localOptimizerApiKey = ref(configStore.optimizerApiKey);
const localOptimizerModel = ref(configStore.optimizerModel);
const localOptimizerEndpoint = ref(configStore.optimizerEndpoint);

// 模型获取状态
const fetchedModels = ref<string[]>([]);
const isFetchingModels = ref(false);
const fetchStatus = ref<{ type: 'idle' | 'success' | 'error'; message: string }>({
  type: 'idle',
  message: ''
});

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

// 下拉模型选项
const modelSelectOptions = computed(() => {
  if (fetchedModels.value.length === 0) {
    return [
      { label: localOptimizerModel.value || 'gpt-4o-mini', value: localOptimizerModel.value || 'gpt-4o-mini' }
    ];
  }
  return fetchedModels.value.map((m) => ({ label: m, value: m }));
});

// 同步 Store 到表单
function syncFromStore() {
  localBaseUrl.value = configStore.baseUrl;
  localApiKey.value = configStore.apiKey;
  localOptimizerBaseUrl.value = configStore.optimizerBaseUrl;
  localOptimizerApiKey.value = configStore.optimizerApiKey;
  localOptimizerModel.value = configStore.optimizerModel;
  localOptimizerEndpoint.value = configStore.optimizerEndpoint;
  fetchStatus.value = { type: 'idle', message: '' };
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      activeTab.value = props.initialTab || 'image';
      syncFromStore();
      // 如果优化模型配置了 key 与 url，自动预拉取一次模型列表
      if (effectiveOptimizerBaseUrl.value && localOptimizerApiKey.value.trim()) {
        handleFetchModels();
      }
    }
  }
);

// 获取模型列表
async function handleFetchModels() {
  const url = effectiveOptimizerBaseUrl.value;
  const key = localOptimizerApiKey.value.trim();

  if (!url) {
    fetchStatus.value = { type: 'error', message: '请先填写优化 API Base URL' };
    return;
  }
  if (!key) {
    fetchStatus.value = { type: 'error', message: '请先填写优化 API Key' };
    return;
  }

  isFetchingModels.value = true;
  fetchStatus.value = { type: 'idle', message: '正在获取模型列表...' };

  try {
    const list = await PromptOptimizerService.fetchModels(url, key);
    fetchedModels.value = list;
    if (list.length > 0) {
      fetchStatus.value = {
        type: 'success',
        message: `已成功获取 ${list.length} 个支持的模型`
      };
      if (!list.includes(localOptimizerModel.value)) {
        localOptimizerModel.value = list[0];
      }
    } else {
      fetchStatus.value = {
        type: 'error',
        message: '接口未返回任何可用模型'
      };
    }
  } catch (err: any) {
    fetchStatus.value = {
      type: 'error',
      message: err.message || '获取模型列表失败'
    };
  } finally {
    isFetchingModels.value = false;
  }
}

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
        <div v-if="activeTab === 'image'" class="tab-content">
          <UiInput
            v-if="!configStore.hasEnvBaseUrl"
            id="baseUrl"
            v-model="localBaseUrl"
            label="生图 API Base URL"
            placeholder="https://api.example.com"
            required
            mono
          >
            <template #label-prefix>
              <Globe :size="14" />
            </template>
          </UiInput>
          <div v-else class="env-info-box">
            <div class="env-info-header">
              <Globe :size="14" />
              <span>生图 API Base URL（环境变量锁定）</span>
            </div>
            <div class="env-info-value mono">{{ configStore.effectiveBaseUrl }}</div>
          </div>

          <UiInput
            id="apiKey"
            v-model="localApiKey"
            label="生图 API Key (令牌)"
            placeholder="sk-..."
            type="password"
            required
            mono
            show-password-toggle
          >
            <template #label-prefix>
              <Key :size="14" />
            </template>
            <template #hint>
              {{ configStore.apiKeyHint }}
            </template>
          </UiInput>
        </div>

        <!-- 2. 提示词优化大模型 Tab -->
        <div v-if="activeTab === 'optimizer'" class="tab-content">
          <UiInput
            v-if="!configStore.hasEnvOptimizerBaseUrl"
            id="optimizerBaseUrl"
            v-model="localOptimizerBaseUrl"
            label="优化 API Base URL"
            placeholder="https://api.openai.com"
            mono
          >
            <template #label-prefix>
              <Globe :size="14" />
            </template>
          </UiInput>
          <div v-else class="env-info-box">
            <div class="env-info-header">
              <Globe :size="14" />
              <span>优化 API Base URL（环境变量锁定）</span>
            </div>
            <div class="env-info-value mono">{{ configStore.effectiveOptimizerBaseUrl }}</div>
          </div>

          <UiInput
            id="optimizerApiKey"
            v-model="localOptimizerApiKey"
            label="优化 API Key (令牌)"
            placeholder="sk-..."
            type="password"
            mono
            show-password-toggle
          >
            <template #label-prefix>
              <Key :size="14" />
            </template>
            <template #hint>
              {{ configStore.optimizerApiKeyHint }}
            </template>
          </UiInput>

          <!-- 模型拉取与端点设置控制面板 -->
          <div class="control-subcard">
            <div class="subcard-header">
              <div class="subcard-title">
                <Cpu :size="14" />
                <span>模型与调用端点</span>
              </div>

              <!-- 获取模型列表按钮 -->
              <UiButton
                size="sm"
                variant="secondary"
                :disabled="isFetchingModels || !localOptimizerApiKey.trim()"
                @click="handleFetchModels"
              >
                <template #icon>
                  <RefreshCw :size="13" :class="{ 'spin-animate': isFetchingModels }" />
                </template>
                {{ isFetchingModels ? '拉取中...' : '获取可用模型' }}
              </UiButton>
            </div>

            <!-- 状态提示 -->
            <div v-if="fetchStatus.type !== 'idle'" class="fetch-status-bar" :class="fetchStatus.type">
              <CheckCircle2 v-if="fetchStatus.type === 'success'" :size="13" />
              <AlertCircle v-else :size="13" />
              <span>{{ fetchStatus.message }}</span>
            </div>

            <!-- 模型选择 / 手动输入 -->
            <div class="control-row">
              <div v-if="fetchedModels.length > 0" class="control-field flex-1">
                <label class="control-label">
                  <Cpu :size="13" />
                  <span>选择优化模型</span>
                </label>
                <UiSelect
                  v-model="localOptimizerModel"
                  :options="modelSelectOptions"
                  placement="bottom"
                  variant="default"
                  size="md"
                  block
                />
              </div>
              <div v-else class="control-field flex-1">
                <UiInput
                  id="optimizerModel"
                  v-model="localOptimizerModel"
                  label="模型名称 (可点击右上角获取)"
                  placeholder="gpt-4o-mini"
                  mono
                >
                  <template #label-prefix>
                    <Cpu :size="14" />
                  </template>
                </UiInput>
              </div>
            </div>

            <!-- 调用端点选择 -->
            <div class="control-row">
              <div class="control-field flex-1">
                <label class="control-label">
                  <Route :size="13" />
                  <span>调用端点 (Endpoint)</span>
                </label>
                <UiSelect
                  v-model="localOptimizerEndpoint"
                  :options="COMMON_OPTIMIZER_ENDPOINTS"
                  placement="bottom"
                  variant="default"
                  size="md"
                  block
                />
              </div>
            </div>
          </div>
        </div>
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

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.env-info-box {
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: $radius-md;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .env-info-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    font-weight: 600;
    color: $text-muted;
  }

  .env-info-value {
    font-size: 0.85rem;
    color: $text-main;
    word-break: break-all;
  }
}

.control-subcard {
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: $radius-lg;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subcard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .subcard-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: $text-main;
  }
}

.fetch-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  padding: 6px 10px;
  border-radius: $radius-sm;

  &.success {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  &.error {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }
}

.control-row {
  display: flex;
  gap: 10px;
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .control-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    font-weight: 600;
    color: $text-muted;
  }
}

.spin-animate {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
