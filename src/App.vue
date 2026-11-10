<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { SettingsModal } from '@/components/settings';
import PromptBar from '@/components/studio/PromptBar.vue';
import ReferencePreviewModal from '@/components/studio/ReferencePreviewModal.vue';
import GalleryGrid from '@/components/gallery/GalleryGrid.vue';
import LightboxModal from '@/components/gallery/LightboxModal.vue';
import { Tooltip, UiDialog } from '@/components/ui';
import { useGalleryStore } from '@/stores/galleryStore';
import { useConfigStore } from '@/stores/configStore';
import { useImageStudio } from '@/composables/useImageStudio';
import { useTheme } from '@/composables/useTheme';
import { SETTING_SECTION, type SettingSectionId } from '@/settings/keys';
import type { ArtworkBatch, MediaAsset } from '@/types/asset';
import type { GenerationTask, ReferencePreviewItem, TaskReferenceImage } from '@/types/task';

const isConfigOpen = ref(false);
const configInitialTab = ref<SettingSectionId>(SETTING_SECTION.general);
const activeLightboxItem = ref<MediaAsset | null>(null);
const activeLightboxBatch = ref<MediaAsset[]>([]);
// 灯箱模式：点缩略图进入纯看图预览，点标题进入作品详情
const activeLightboxMode = ref<'preview' | 'detail'>('detail');
const activePreviewRefImage = ref<ReferencePreviewItem | null>(null);
const activePreviewRefBatch = ref<ReferencePreviewItem[]>([]);
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

function openConfig(tab: SettingSectionId = SETTING_SECTION.general) {
  configInitialTab.value = tab;
  isConfigOpen.value = true;
}

const configStore = useConfigStore();

useTheme();

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
  moderation,
  outputCompression,
  frameCount,
  frameDurationMs,
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

function ensureImageServiceConfigured(): boolean {
  if (configStore.isConfigured) return true;
  openConfig('image');
  return false;
}

onMounted(async () => {
  await galleryStore.loadGallery();
});

async function handleGenerate() {
  if (!ensureImageServiceConfigured()) return;
  try {
    const tasks = await generate();
    showToast(
      tasks.length > 1
        ? `已发起 ${tasks.length} 个批次的生成任务，正在实时绘制...`
        : '已发起生成任务，正在实时绘制...',
      'info'
    );
  } catch (error) {
    showToast(getOperationErrorMessage(error, '发起生图失败'), 'error');
  }
}

async function handleRegenerate(item: MediaAsset | ArtworkBatch | GenerationTask) {
  if (!ensureImageServiceConfigured()) return;
  if ('params' in item) {
    retryTask(item);
  } else {
    try {
      await reuseItem(item);
      await handleGenerate();
    } catch (error) {
      showToast(getOperationErrorMessage(error, '恢复生成参数失败，请重试'), 'error');
    }
  }
}

function handleRetryTask(task: GenerationTask) {
  if (!ensureImageServiceConfigured()) return;
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

function getOperationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function handleReuse(item: MediaAsset | ArtworkBatch | GenerationTask) {
  try {
    await reuseItem(item);
    showToast('已复用提示词与全部参数设置', 'info');
  } catch (error) {
    showToast(getOperationErrorMessage(error, '复用失败，请重试'), 'error');
  }
}

async function handleEditAsReference(item: MediaAsset) {
  try {
    await reuseItem(item);
    await useImageAsReference(item.url);
    showToast('已将选定图片加入参考图栏', 'info');
  } catch (error) {
    showToast(getOperationErrorMessage(error, '加载参考图失败，请重试'), 'error');
  }
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, 4000);
}

function handleOpenLightbox(
  item: MediaAsset,
  allAssets?: MediaAsset[],
  mode: 'preview' | 'detail' = 'detail'
) {
  activeLightboxItem.value = item;
  activeLightboxBatch.value = allAssets || [item];
  activeLightboxMode.value = mode;
}

// 外部点击缩略图：直接进入图片预览，关闭即回到首页
function handlePreviewArtwork(item: MediaAsset, allAssets?: MediaAsset[]) {
  handleOpenLightbox(item, allAssets, 'preview');
}

// 点击标题：进入作品详情
function handleOpenArtworkDetail(item: MediaAsset, allAssets?: MediaAsset[]) {
  handleOpenLightbox(item, allAssets, 'detail');
}

function handleCloseLightbox() {
  activeLightboxItem.value = null;
  activeLightboxBatch.value = [];
}

function handlePreviewReferenceImage(img: TaskReferenceImage, all: TaskReferenceImage[]) {
  activePreviewRefImage.value = img;
  activePreviewRefBatch.value = all;
}

// 作品详情里的参考图以 data URL 保存，映射成预览弹窗所需的最小结构后独立预览
function handlePreviewArtworkReferences(urls: string[], index: number) {
  const list: ReferencePreviewItem[] = urls.map((url, i) => ({
    id: `artwork-ref-${i}`,
    previewUrl: url
  }));
  activePreviewRefImage.value = list[index] ?? null;
  activePreviewRefBatch.value = list;
}

function handleCloseRefPreview() {
  activePreviewRefImage.value = null;
  activePreviewRefBatch.value = [];
}

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
      <AppHeader @open-config="openConfig()" />

      <!-- 主画廊相册展示区 -->
      <main class="content-area">
        <GalleryGrid 
          @open-config="openConfig('image')"
          @preview="handlePreviewArtwork"
          @view="handleOpenArtworkDetail"
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
        v-model:moderation="moderation"
        v-model:output-compression="outputCompression"
        v-model:frame-count="frameCount"
        v-model:frame-duration-ms="frameDurationMs"
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
        @open-config-optimizer="openConfig('image')"
        @show-toast="showToast"
      />
    </div>

    <!-- 设置弹窗 -->
    <SettingsModal 
      :is-open="isConfigOpen"
      :initial-tab="configInitialTab"
      @close="isConfigOpen = false" 
      @saved="showToast('设置已保存', 'success')"
    />

    <!-- 大图高清查看灯箱 -->
    <LightboxModal 
      :item="activeLightboxItem"
      :all-assets="activeLightboxBatch"
      :mode="activeLightboxMode"
      @close="handleCloseLightbox"
      @preview-reference="handlePreviewArtworkReferences"
      @reuse="handleReuse"
      @edit-as-reference="handleEditAsReference"
      @toggle-favorite="id => galleryStore.toggleFavorite(id)"
      @delete="(id) => requestDeleteItem(id, true)"
      @show-toast="showToast"
    />

    <ReferencePreviewModal
      v-if="activePreviewRefImage"
      v-model:item="activePreviewRefImage"
      :images="activePreviewRefBatch"
      @close="handleCloseRefPreview"
    />

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
  /* 透出 body 的主题渐变光晕，避免纯色铺底盖掉明暗两套背景 */
  background-color: transparent;
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
