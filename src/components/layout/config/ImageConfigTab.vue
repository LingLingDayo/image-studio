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
