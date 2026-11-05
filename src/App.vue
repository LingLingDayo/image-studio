<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { SettingsModal } from '@/components/settings';
import PromptBar from '@/components/studio/PromptBar.vue';
import GalleryGrid from '@/components/gallery/GalleryGrid.vue';
import LightboxModal from '@/components/gallery/LightboxModal.vue';
import { Tooltip, UiDialog, UiImageViewer } from '@/components/ui';
import { X } from '@lucide/vue';
import { useGalleryStore } from '@/stores/galleryStore';
import { useConfigStore } from '@/stores/configStore';
import { useImageStudio } from '@/composables/useImageStudio';
import type { ArtworkBatch, MediaAsset } from '@/types/asset';
import type { GenerationTask, TaskReferenceImage } from '@/types/task';

const isConfigOpen = ref(false);
const configInitialTab = ref<'image' | 'optimizer'>('image');
const isApiKeyMissingDialogOpen = ref(false);
const activeLightboxItem = ref<MediaAsset | null>(null);
const activeLightboxBatch = ref<MediaAsset[]>([]);
const activePreviewRefImage = ref<TaskReferenceImage | null>(null);
const activePreviewRefBatch = ref<TaskReferenceImage[]>([]);
const isRefPreviewFullscreen = ref(false);
const toasts = ref<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);
const pendingDelete = ref<
  | { kind: 'item'; id: number; closeLightbox: boolean }
  | { kind: 'batch'; batch: ArtworkBatch }
  | null
>(null);

const isDeleteDialogOpen = computed(() => pendingDelete.value !== null);
const deleteDialogDescription = computed(() => {
  if (pendingDelete.value?.kind === 'batch') {
    const n = pendingDelete.value.batch.assets.length;
    return `删除后无法恢复，确定要删除这批 ${n} 张图片吗？`;
  }
  return '删除后无法恢复，确定要删除这张图片吗？';
});

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
    const tasks = await generate();
    showToast(
      tasks.length > 1
        ? `已发起 ${tasks.length} 个批次的生成任务，正在实时绘制...`
        : '已发起生成任务，正在实时绘制...',
      'info'
    );
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

function handlePreviewReferenceImage(img: TaskReferenceImage, all: TaskReferenceImage[]) {
  activePreviewRefImage.value = img;
  activePreviewRefBatch.value = all;
}

async function exitRefPreviewFullscreen() {
  isRefPreviewFullscreen.value = false;
  if (configStore.previewFullscreenMode === 'native' && document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // 忽略退出异常
    }
  }
}

async function handleRefPreviewFullscreenChange(val: boolean) {
  isRefPreviewFullscreen.value = val;
  if (configStore.previewFullscreenMode === 'native') {
    if (val) {
      try {
        if (document.fullscreenEnabled && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // 允许降级
      }
    } else {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // 忽略退出异常
        }
      }
    }
  }
}

function handleRefFullscreenDomChange() {
  if (!document.fullscreenElement && isRefPreviewFullscreen.value && configStore.previewFullscreenMode === 'native') {
    isRefPreviewFullscreen.value = false;
  }
}

async function handleCloseRefPreview() {
  if (isRefPreviewFullscreen.value) {
    await exitRefPreviewFullscreen();
    return;
  }
  activePreviewRefImage.value = null;
  activePreviewRefBatch.value = [];
}

async function handleRefPreviewKeyDown(e: KeyboardEvent) {
  if (!activePreviewRefImage.value) return;

  if (e.key === 'Escape') {
    if (isRefPreviewFullscreen.value) {
      await exitRefPreviewFullscreen();
      return;
    }
    await handleCloseRefPreview();
  } else if (e.key === 'ArrowLeft') {
    if (activePreviewRefBatch.value.length > 1) {
      const list = activePreviewRefBatch.value;
      const idx = list.findIndex(item => item.id === activePreviewRefImage.value?.id);
      if (idx !== -1) {
        const nextIdx = (idx - 1 + list.length) % list.length;
        activePreviewRefImage.value = list[nextIdx] || null;
      }
    }
  } else if (e.key === 'ArrowRight') {
    if (activePreviewRefBatch.value.length > 1) {
      const list = activePreviewRefBatch.value;
      const idx = list.findIndex(item => item.id === activePreviewRefImage.value?.id);
      if (idx !== -1) {
        const nextIdx = (idx + 1) % list.length;
        activePreviewRefImage.value = list[nextIdx] || null;
      }
    }
  }
}

watch(activePreviewRefImage, (item) => {
  if (item) {
    window.addEventListener('keydown', handleRefPreviewKeyDown);
    document.addEventListener('fullscreenchange', handleRefFullscreenDomChange);
  } else {
    window.removeEventListener('keydown', handleRefPreviewKeyDown);
    document.removeEventListener('fullscreenchange', handleRefFullscreenDomChange);
    exitRefPreviewFullscreen();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleRefPreviewKeyDown);
  document.removeEventListener('fullscreenchange', handleRefFullscreenDomChange);
  exitRefPreviewFullscreen();
});

function requestDeleteItem(id: number, closeLightbox = false) {
  pendingDelete.value = { kind: 'item', id, closeLightbox };
}

function requestDeleteBatch(batch: ArtworkBatch) {
  pendingDelete.value = { kind: 'batch', batch };
}

function closeDeleteDialog() {
  pendingDelete.value = null;
}

async function confirmPendingDelete() {
  const pending = pendingDelete.value;
  if (!pending) return;
  pendingDelete.value = null;

  if (pending.kind === 'batch') {
    await galleryStore.removeBatch(pending.batch);
    showToast('整批图片已删除', 'info');
    return;
  }

  await galleryStore.removeItem(pending.id);
  showToast('图片已删除', 'info');
  if (pending.closeLightbox) {
    handleCloseLightbox();
  }
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
          @delete="requestDeleteItem"
          @delete-batch="requestDeleteBatch"
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
        @preview-image="handlePreviewReferenceImage"
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
      @delete="(id) => requestDeleteItem(id, true)"
      @show-toast="showToast"
    />

    <!-- 参考图独立预览弹窗 (复用通用图片预览器 UiImageViewer) -->
    <div 
      v-if="activePreviewRefImage" 
      class="modal-backdrop ref-preview-backdrop"
      :class="{ 'is-fullscreen': isRefPreviewFullscreen }"
      @click.self="handleCloseRefPreview"
    >
      <div class="modal-card ref-preview-modal-card">
        <button 
          v-if="!isRefPreviewFullscreen"
          class="modal-close-btn" 
          data-tip="关闭 (Esc)" 
          aria-label="关闭"
          @click="handleCloseRefPreview"
        >
          <X :size="18" />
        </button>

        <div class="modal-body ref-preview-body">
          <UiImageViewer
            :src="activePreviewRefImage.previewUrl"
            :alt="'参考图 ' + activePreviewRefImage.id"
            :images="activePreviewRefBatch.map((item) => ({ id: item.id, url: item.previewUrl }))"
            :current-index="activePreviewRefBatch.findIndex((item) => item.id === activePreviewRefImage?.id)"
            :is-fullscreen="isRefPreviewFullscreen"
            @update:is-fullscreen="handleRefPreviewFullscreenChange"
            @close="handleCloseRefPreview"
            @exit-fullscreen="exitRefPreviewFullscreen"
            @update:current-index="(idx) => activePreviewRefImage = activePreviewRefBatch[idx] || null"
          />
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗（回车确认） -->
    <UiDialog
      :is-open="isDeleteDialogOpen"
      type="danger"
      title="确认删除"
      :description="deleteDialogDescription"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmPendingDelete"
      @close="closeDeleteDialog"
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

.ref-preview-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.2s ease;

  &.is-fullscreen {
    padding: 0;
    background: #090d16;
    backdrop-filter: none;

    .ref-preview-modal-card {
      max-width: 100vw;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      border: none;
      box-shadow: none;
      background: #090d16;
    }
  }
}

.ref-preview-modal-card {
  max-width: 960px;
  width: 90vw;
  height: 82vh;
  min-height: min(480px, 90vh);
  max-height: 90vh;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  box-shadow: $shadow-float;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .modal-close-btn {
    position: absolute;
    top: 14px;
    right: 14px;
    background: $bg-surface-subtle;
    border: 1px solid $border-color;
    color: $text-secondary;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.15s ease;

    &:hover {
      background: #e2e8f0;
      color: $text-main;
    }
  }
}

.ref-preview-body {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
