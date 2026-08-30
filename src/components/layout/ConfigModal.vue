<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { X, Save, Key, Globe } from 'lucide-vue-next';
import { UiInput, UiButton } from '@/components/ui';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const configStore = useConfigStore();

const localBaseUrl = ref(configStore.baseUrl);
const localApiKey = ref(configStore.apiKey);

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      localBaseUrl.value = configStore.baseUrl;
      localApiKey.value = configStore.apiKey;
    }
  }
);

function handleSave() {
  if (!localBaseUrl.value.trim() || !localApiKey.value.trim()) {
    return;
  }
  configStore.updateConfig({
    baseUrl: localBaseUrl.value,
    apiKey: localApiKey.value
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
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <div class="icon-circle">
            <Key :size="18" />
          </div>
          <div>
            <h3>API 配置</h3>
            <p>配置接口地址与密钥</p>
          </div>
        </div>
        <button class="btn-close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="dialog-body">
        <UiInput
          id="baseUrl"
          v-model="localBaseUrl"
          label="API Base URL"
          placeholder="https://api.example.com"
          required
          mono
        >
          <template #label-prefix>
            <Globe :size="14" />
          </template>
        </UiInput>

        <UiInput
          id="apiKey"
          v-model="localApiKey"
          label="API Key (令牌)"
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
            令牌只保存在本机浏览器，不会上传到工作台服务器
          </template>
        </UiInput>
      </div>

      <div class="dialog-footer">
        <UiButton variant="secondary" @click="emit('close')">
          取消
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!localBaseUrl.trim() || !localApiKey.trim()"
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
  max-width: 520px;
  width: 100%;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  box-shadow: $shadow-float;
  display: flex;
  flex-direction: column;
  animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
