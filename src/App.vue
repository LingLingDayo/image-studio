<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { SettingsModal } from '@/components/settings';
import PromptBar from '@/components/studio/PromptBar.vue';
import GalleryGrid from '@/components/gallery/GalleryGrid.vue';
import LightboxModal from '@/components/gallery/LightboxModal.vue';
import { Tooltip, UiDialog } from '@/components/ui';
import { useGalleryStore } from '@/stores/galleryStore';
import { useConfigStore } from '@/stores/configStore';
import { useImageStudio } from '@/composables/useImageStudio';
import type { MediaAsset } from '@/types/asset';
import type { GenerationTask } from '@/types/task';

const isConfigOpen = ref(false);
const configInitialTab = ref<'image' | 'optimizer'>('image');
const isApiKeyMissingDialogOpen = ref(false);
const activeLightboxItem = ref<MediaAsset | null>(null);
const activeLightboxBatch = ref<MediaAsset[]>([]);
const toasts = ref<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

function openConfig(tab: 'image' | 'optimizer' = 'image') {
  configInitialTab.value = tab;
  isConfigOpen.value = true;
}

function handleGoToConfig() {
  isApiKeyMissingDialogOpen.value = false;
  openConfig('image');
}

const configStore = useConfigStore();
const galleryStore = useGalleryStore();
const {
  prompt,
  resolution,
  aspectRatio,
  sizeWidth,
  sizeHeight,
  setSizeAuto,
  materializeImageSize,
  quality,
  format,
  transparent,
  count,
  referenceImages,
  isGenerating,
  elapsedTime,
  progress,
  addReferenceImages,
  removeReferenceImage,
  clearReferenceImages,
  generate,
  retryTask,
  cancelTask,
  removeTask,
  cancel,
  reuseItem,
  useImageAsReference
} = useImageStudio();

onMounted(async () => {
  await galleryStore.loadGallery();
});

async function handleGenerate() {
  if (!configStore.isConfigured) {
    isApiKeyMissingDialogOpen.value = true;
    return;
  }
  try {
    await generate();
    showToast('已发起生成任务，正在实时绘制...', 'info');
  } catch (err: any) {
    showToast(err.message || '发起生图失败', 'error');
  }
}

async function handleRegenerate(item: MediaAsset | any) {
  if (!configStore.isConfigured) {
    isApiKeyMissingDialogOpen.value = true;
    return;
  }
  if ('params' in item) {
    retryTask(item);
  } else {
    await reuseItem(item);
    await handleGenerate();
  }
}

function handleRetryTask(task: any) {
  if (!configStore.isConfigured) {
    isApiKeyMissingDialogOpen.value = true;
    return;
  }
  retryTask(task);
  showToast('已重新发起生成任务', 'info');
}

function handleCancelTask(taskId: string) {
  cancelTask(taskId);
  showToast('已取消生成任务', 'info');
}

function handleRemoveTask(taskId: string) {
  removeTask(taskId);
}

async function handleReuse(item: MediaAsset | GenerationTask | any) {
  await reuseItem(item);
  showToast('已复用提示词与全部参数设置', 'info');
}

async function handleEditAsReference(item: MediaAsset) {
  await reuseItem(item);
  await useImageAsReference(item.url);
  showToast('已将选定图片加入参考图栏', 'info');
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 4000);
}

function handleOpenLightbox(item: MediaAsset, allAssets?: MediaAsset[]) {
  activeLightboxItem.value = item;
  activeLightboxBatch.value = allAssets || [item];
}

function handleCloseLightbox() {
  activeLightboxItem.value = null;
  activeLightboxBatch.value = [];
}

async function handleDeleteItem(id: number) {
  await galleryStore.removeItem(id);
}
</script>

<template>
  <div class="app-layout">
    <div class="app-main-content">
      <!-- 顶部导航与搜索栏 -->
      <AppHeader @open-config="openConfig('image')" />

      <!-- 主画廊相册展示区 -->
      <main class="content-area">
        <GalleryGrid 
          @view="handleOpenLightbox"
          @regenerate="handleRegenerate"
          @reuse="handleReuse"
          @edit-as-reference="handleEditAsReference"
          @retry-task="handleRetryTask"
          @cancel-task="handleCancelTask"
          @remove-task="handleRemoveTask"
          @show-toast="showToast"
        />
      </main>

      <!-- 底部悬浮/停靠控制台 -->
      <PromptBar
        v-model:prompt="prompt"
        v-model:resolution="resolution"
        v-model:aspect-ratio="aspectRatio"
        v-model:size-width="sizeWidth"
        v-model:size-height="sizeHeight"
        v-model:quality="quality"
        v-model:format="format"
        v-model:transparent="transparent"
        v-model:count="count"
        :reference-images="referenceImages"
        :is-generating="isGenerating"
        :elapsed-time="elapsedTime"
        :progress="progress"
        @size-auto="setSizeAuto"
        @size-materialize="materializeImageSize"
        @add-images="addReferenceImages"
        @remove-image="removeReferenceImage"
        @clear-images="clearReferenceImages"
        @generate="handleGenerate"
        @cancel="cancel"
        @open-config-optimizer="openConfig('optimizer')"
        @show-toast="showToast"
      />
    </div>

    <!-- 设置弹窗 -->
    <SettingsModal 
      :is-open="isConfigOpen"
      :initial-tab="configInitialTab"
      @close="isConfigOpen = false" 
      @saved="showToast('系统设置已保存', 'success')" 
    />

    <!-- 大图高清查看灯箱 -->
    <LightboxModal 
      :item="activeLightboxItem"
      :all-assets="activeLightboxBatch"
      @close="handleCloseLightbox"
      @reuse="handleReuse"
      @edit-as-reference="handleEditAsReference"
      @toggle-favorite="id => galleryStore.toggleFavorite(id)"
      @delete="handleDeleteItem"
      @show-toast="showToast"
    />

    <!-- 未配置 API Key 提示弹窗 -->
    <UiDialog
      :is-open="isApiKeyMissingDialogOpen"
      type="warning"
      title="未配置生图 API Key"
      description="检测到尚未配置生图接口地址或 API Key。请先前往系统设置完成配置后再发起生图任务。"
      confirm-text="前往配置"
      cancel-text="取消"
      @confirm="handleGoToConfig"
      @close="isApiKeyMissingDialogOpen = false"
    />

    <!-- 全局单例 Tooltip -->
    <Tooltip />

    <!-- 全局轻量 Toast 提示 -->
    <div class="toast-container">
      <div 
        v-for="t in toasts" 
        :key="t.id" 
        class="toast" 
        :class="t.type"
      >
        <span class="toast-dot"></span>
        <span class="toast-text">{{ t.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.app-layout {
  min-height: 100%;
  min-height: 100dvh;
  background-color: $bg-primary;
  display: flex;
  flex-direction: column;
}

.app-main-content {
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
  position: relative;
}

.content-area {
  flex: 1;
  padding-bottom: 24px;
}

/* Toast 提示消息 */
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  background: $bg-surface;
  border: 1px solid $border-color;
  box-shadow: $shadow-lg;
  color: $text-main;
  padding: 10px 16px;
  border-radius: $radius-lg;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: fadeIn 0.2s ease;

  .toast-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $accent-primary;
  }

  &.success .toast-dot {
    background: $success;
  }

  &.error .toast-dot {
    background: $danger;
  }

  &.info .toast-dot {
    background: $accent-primary;
  }
}
</style>
