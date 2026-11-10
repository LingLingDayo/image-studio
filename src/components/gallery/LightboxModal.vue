<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { downloadRotatedImage, generateAssetFilename, supportsCanvasImageFormat } from '@/utils/download';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { useArtworkSwitcher } from '@/composables/useArtworkSwitcher';
import { useConfigStore } from '@/stores/configStore';
import { X, ChevronLeft, ChevronRight } from '@lucide/vue';
import LightboxViewport from './lightbox/LightboxViewport.vue';
import LightboxDetailPanel from './lightbox/LightboxDetailPanel.vue';

const props = withDefaults(defineProps<{
  item: MediaAsset | null;
  allAssets?: MediaAsset[];
  // preview: 仅看图（点缩略图进入）；detail: 看图 + 右侧作品详情（点标题进入）
  mode?: 'preview' | 'detail';
}>(), {
  mode: 'detail'
});

// 详情面板仅在 detail 模式挂载，预览模式保持纯看图
const showDetailPanel = computed(() => props.mode === 'detail');

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'previewReference', images: string[], index: number): void;
  (e: 'reuse', item: MediaAsset): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'toggleFavorite', id: number): void;
  (e: 'delete', id: number): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();

const currentActiveItem = ref<MediaAsset | null>(props.item);
const viewportRef = ref<InstanceType<typeof LightboxViewport> | null>(null);
const panelRef = computed<HTMLElement | null>(() => viewportRef.value?.containerRef || null);

const {
  canSwitchWork,
  currentWorkIndex,
  currentBatchAssets: storeBatchAssets,
  prevWork,
  nextWork
} = useArtworkSwitcher(currentActiveItem);

const {
  scale,
  translateX,
  translateY,
  rotation,
  isDragging,
  zoomIn,
  zoomOut,
  resetScale,
  resetView,
  resetTransform,
  rotateCw,
  rotateCcw,
  handleWheel,
  handlePointerDown,
  handleMouseDown,
  handleDoubleClick
} = useViewportCanvas(panelRef);

const configStore = useConfigStore();
const isFullscreen = ref(false);

async function toggleFullscreen() {
  if (!isFullscreen.value) {
    isFullscreen.value = true;
    if (configStore.previewFullscreenMode === 'native') {
      try {
        if (document.fullscreenEnabled && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // 允许降级为纯 CSS 页面内全屏
      }
    }
  } else {
    await exitFullscreen();
  }
}

async function exitFullscreen() {
  isFullscreen.value = false;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    // 忽略退出异常
  }
}

function handleFullscreenChange() {
  if (!document.fullscreenElement && isFullscreen.value && configStore.previewFullscreenMode === 'native') {
    isFullscreen.value = false;
  }
}

watch(() => props.item, (newItem) => {
  currentActiveItem.value = newItem;
  resetTransform();
});

const currentBatchAssets = computed(() => {
  if (currentWorkIndex.value >= 0) {
    return storeBatchAssets.value;
  }
  return props.allAssets || (currentActiveItem.value ? [currentActiveItem.value] : []);
});
const currentAssetIndex = computed(() => {
  if (!currentActiveItem.value || currentBatchAssets.value.length === 0) return 0;
  const idx = currentBatchAssets.value.findIndex(
    (a) =>
      (a.id && a.id === currentActiveItem.value?.id) ||
      (a.url && a.url === currentActiveItem.value?.url) ||
      a === currentActiveItem.value
  );
  return idx !== -1 ? idx : 0;
});

function handlePrev() {
  const list = currentBatchAssets.value;
  if (list.length <= 1) return;
  const nextIdx = (currentAssetIndex.value - 1 + list.length) % list.length;
  currentActiveItem.value = list[nextIdx];
  resetTransform();
}

function handleNext() {
  const list = currentBatchAssets.value;
  if (list.length <= 1) return;
  const nextIdx = (currentAssetIndex.value + 1) % list.length;
  currentActiveItem.value = list[nextIdx];
  resetTransform();
}

function handlePrevWork() {
  if (prevWork()) {
    resetTransform();
  }
}

function handleNextWork() {
  if (nextWork()) {
    resetTransform();
  }
}

async function handleDownload() {
  const item = currentActiveItem.value;
  if (item) {
    if (item.status === 'failed' || !item.url) {
      emit('showToast', '当前图片未生成成功，无法下载', 'error');
      return;
    }
    const pattern = configStore.downloadFilenamePattern;
    const targetFormat = configStore.downloadImageFormat;
    const origExt = (item.format || 'png').replace(/^\./, '');
    const finalExt = targetFormat && targetFormat !== 'auto' ? targetFormat : origExt;
    const filename = generateAssetFilename(item, undefined, rotation.value, { pattern, targetFormat });
    const normRot = ((rotation.value % 360) + 360) % 360;
    
    try {
      await downloadRotatedImage(item.url, filename, rotation.value, finalExt, origExt);
      const message = normRot !== 0 && !supportsCanvasImageFormat(finalExt)
        ? '已开始下载原件，GIF/SVG 不应用旋转'
        : normRot !== 0 ? `已下载旋转 (${normRot}°) 后的图片！` : '已开始下载图片！';
      emit('showToast', message, 'success');
    } catch (error) {
      emit('showToast', error instanceof Error ? error.message : '图片下载失败，请重试', 'error');
    }
  }
}

function handleClose() {
  if (isFullscreen.value) {
    exitFullscreen();
    return;
  }
  emit('close');
}

function handleReuse(item: MediaAsset) {
  if (isFullscreen.value) {
    exitFullscreen();
  }
  emit('reuse', item);
  emit('close');
}

function handleEditAsReference(item: MediaAsset) {
  if (isFullscreen.value) {
    exitFullscreen();
  }
  emit('editAsReference', item);
  emit('close');
}

function handleDelete(id: number) {
  emit('delete', id);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function handleKeyDown(e: KeyboardEvent) {
  if (!currentActiveItem.value || isTypingTarget(e.target)) return;

  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      exitFullscreen();
      return;
    }
    handleClose();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (currentBatchAssets.value.length > 1) {
      handlePrev();
    } else {
      handlePrevWork();
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (currentBatchAssets.value.length > 1) {
      handleNext();
    } else {
      handleNextWork();
    }
  }
}

const isLightboxOpen = computed(() => currentActiveItem.value !== null);

watch(isLightboxOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  } else {
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    exitFullscreen();
  }
}, { immediate: true });

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  exitFullscreen();
});
</script>

<template>
  <div 
    v-if="currentActiveItem" 
    class="modal-backdrop" 
    :class="{ 'is-fullscreen': isFullscreen }"
    @click.self="handleClose"
  >
    <button
      v-if="canSwitchWork && !isFullscreen"
      type="button"
      class="lightbox-side-nav is-prev"
      data-tip="上一件作品"
      aria-label="上一件作品"
      @click.stop="handlePrevWork"
    >
      <ChevronLeft :size="28" />
    </button>

    <button
      v-if="canSwitchWork && !isFullscreen"
      type="button"
      class="lightbox-side-nav is-next"
      data-tip="下一件作品"
      aria-label="下一件作品"
      @click.stop="handleNextWork"
    >
      <ChevronRight :size="28" />
    </button>

    <div class="modal-card">
      <button 
        v-if="!isFullscreen" 
        class="modal-close-btn" 
        data-tip="关闭 (Esc)" 
        @click="handleClose"
      >
        <X :size="18" />
      </button>

      <div class="modal-body" :class="{ 'is-preview': !showDetailPanel }">
        <!-- 左侧大图展示与交互视口 -->
        <LightboxViewport
          ref="viewportRef"
          :active-item="currentActiveItem"
          :batch-assets="currentBatchAssets"
          :current-index="currentAssetIndex"
          :scale="scale"
          :translate-x="translateX"
          :translate-y="translateY"
          :rotation="rotation"
          :is-dragging="isDragging"
          v-model:is-fullscreen="isFullscreen"
          @prev="handlePrev"
          @next="handleNext"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-scale="resetScale"
          @reset-view="resetView"
          @rotate-cw="rotateCw"
          @rotate-ccw="rotateCcw"
          @toggle-fullscreen="toggleFullscreen"
          @exit-fullscreen="exitFullscreen"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @mousedown="handleMouseDown"
          @dblclick="handleDoubleClick"
        />

        <!-- 右侧信息与操作（仅作品详情模式） -->
        <template v-if="showDetailPanel">
          <LightboxDetailPanel
            v-show="!isFullscreen"
            :item="currentActiveItem"
            :rotation="rotation"
            @toggle-favorite="emit('toggleFavorite', $event)"
            @reuse="handleReuse"
            @edit-as-reference="handleEditAsReference"
            @delete="handleDelete"
            @download="handleDownload"
            @show-toast="(msg, type) => emit('showToast', msg, type)"
            @preview-reference="(images, index) => emit('previewReference', images, index)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: $overlay;
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.2s ease;

  &.is-fullscreen {
    padding: 0;
    background: $stage;
    backdrop-filter: none;

    .modal-card {
      max-width: 100vw;
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      max-height: 100vh;
      border-radius: 0;
      border: none;
      box-shadow: none;
      background: $stage;
    }

    .modal-body {
      grid-template-columns: 1fr;
      width: 100%;
      height: 100%;
    }
  }

  @media (max-width: 860px) {
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }
}

.modal-card {
  max-width: 1060px;
  width: 100%;
  height: 86vh;
  min-height: min(560px, 90vh);
  max-height: 90vh;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  box-shadow: none;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 860px) {
    max-width: none;
    height: 100%;
    min-height: 0;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
  }
}

.lightbox-side-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid $media-glass-border;
  background: $media-glass;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: $shadow-scrim;
  color: $media-text;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;

  &:hover {
    background: $bg-surface;
    color: $text-main;
    border-color: $accent-border;
  }

  &.is-prev {
    left: 16px;
  }

  &.is-next {
    right: 16px;
  }

  @media (max-width: 860px) {
    width: 36px;
    height: 36px;

    &.is-prev {
      left: 8px;
    }

    &.is-next {
      right: 8px;
    }
  }
}

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
  transition: color 0.12s ease, background-color 0.12s ease;

  &:hover {
    background: $bg-surface-hover;
    color: $text-main;
  }
}

.modal-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 380px;
  overflow: hidden;

  // 预览模式无详情面板，画面独占整个弹窗
  &.is-preview {
    grid-template-columns: 1fr;

    // 独占时不需要与详情面板之间的分隔线
    :deep(.modal-image-panel) {
      border-right: none;
    }
  }

  @media (max-width: 860px) {
    display: flex;
    flex-direction: column;
    overflow: hidden;

    // 窄屏下预览模式让画面占满可视高度，而不是被压到 36vh
    &.is-preview :deep(.modal-image-panel) {
      flex: 1 1 auto;
      height: 100%;
      max-height: none;
    }
  }
}
</style>
