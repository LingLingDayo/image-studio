<script setup lang="ts">
import { useConfigStore } from '@/stores/configStore';
import { Globe, Key } from 'lucide-vue-next';
import { UiInput } from '@/components/ui';

const configStore = useConfigStore();

const localBaseUrl = defineModel<string>('baseUrl', { required: true });
const localApiKey = defineModel<string>('apiKey', { required: true });
</script>

<template>
  <div class="tab-content">
    <!-- 仅在未通过环境变量配置时展示生图 API Base URL 输入框；已在 env 配置则直接隐藏 -->
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

    <!-- 仅在未通过环境变量配置时展示生图 API Key 输入框；已在 env 配置则直接隐藏 -->
    <UiInput
      v-if="!configStore.hasEnvApiKey"
      id="apiKey"
      v-model="localApiKey"
      label="生图 API Key"
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
</style>
