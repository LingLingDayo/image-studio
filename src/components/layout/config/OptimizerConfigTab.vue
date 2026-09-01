<script setup lang="ts">
import { ref, computed } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import { COMMON_OPTIMIZER_ENDPOINTS } from '@/types/config';
import { Globe, Key, Cpu, Route, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-vue-next';
import { UiInput, UiButton, UiSelect } from '@/components/ui';

const configStore = useConfigStore();

const localOptimizerBaseUrl = defineModel<string>('baseUrl', { required: true });
const localOptimizerApiKey = defineModel<string>('apiKey', { required: true });
const localOptimizerModel = defineModel<string>('model', { required: true });
const localOptimizerEndpoint = defineModel<string>('endpoint', { required: true });

// 模型获取状态
const fetchedModels = ref<string[]>([]);
const isFetchingModels = ref(false);
const fetchStatus = ref<{ type: 'idle' | 'success' | 'error'; message: string }>({
  type: 'idle',
  message: ''
});

// 计算优化服务有效 Base URL
const effectiveOptimizerBaseUrl = computed(() =>
  configStore.hasEnvOptimizerBaseUrl
    ? configStore.effectiveOptimizerBaseUrl
    : localOptimizerBaseUrl.value.trim()
);

// 计算优化服务有效 API Key
const effectiveOptimizerApiKey = computed(() =>
  configStore.hasEnvOptimizerApiKey
    ? configStore.effectiveOptimizerApiKey
    : localOptimizerApiKey.value.trim()
);

// 下拉模型选项
const modelSelectOptions = computed(() => {
  if (fetchedModels.value.length === 0) {
    if (!localOptimizerModel.value) return [];
    return [
      { label: localOptimizerModel.value, value: localOptimizerModel.value }
    ];
  }
  return fetchedModels.value.map((m) => ({ label: m, value: m }));
});

// 获取可用模型列表
async function handleFetchModels() {
  const url = effectiveOptimizerBaseUrl.value;
  const key = effectiveOptimizerApiKey.value;

  // 如果用户填写的信息不全，不自动填入默认模型
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

      // 默认选中 gpt-5.6-terra（如果模型列表中存在该模型）
      // 如果没有 gpt-5.6-terra 且当前选择为空或不在列表中，自动切换成模型列表第一个
      const hasTerra = list.includes('gpt-5.6-terra');
      if (!localOptimizerModel.value || !list.includes(localOptimizerModel.value)) {
        localOptimizerModel.value = hasTerra ? 'gpt-5.6-terra' : list[0];
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

defineExpose({
  handleFetchModels,
  resetStatus: () => {
    fetchStatus.value = { type: 'idle', message: '' };
  }
});
</script>

<template>
  <div class="tab-content">
    <!-- 仅在未通过环境变量配置时展示优化 API Base URL 输入框；已在 env 配置则直接隐藏 -->
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

    <!-- 仅在未通过环境变量配置时展示优化 API Key 输入框；已在 env 配置则直接隐藏 -->
    <UiInput
      v-if="!configStore.hasEnvOptimizerApiKey"
      id="optimizerApiKey"
      v-model="localOptimizerApiKey"
      label="优化 API Key"
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

    <!-- 模型拉取与端点设置控制面板 (仅在具备有效 API Key 后展示) -->
    <div v-if="effectiveOptimizerApiKey" class="control-subcard">
      <div class="subcard-header">
        <div class="subcard-title">
          <Cpu :size="14" />
          <span>模型与调用端点</span>
        </div>

        <!-- 获取模型列表按钮 -->
        <UiButton
          size="sm"
          variant="secondary"
          :disabled="isFetchingModels || !effectiveOptimizerApiKey"
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
            label="模型名称"
            placeholder="gpt-5.6-terra"
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
            <span>调用端点</span>
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
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

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

.flex-1 {
  flex: 1;
}
</style>
