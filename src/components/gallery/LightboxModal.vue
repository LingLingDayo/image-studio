<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { downloadRotatedImage, generateAssetFilename } from '@/utils/download';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { useArtworkSwitcher } from '@/composables/useArtworkSwitcher';
import { useConfigStore } from '@/stores/configStore';
import { X, ChevronLeft, ChevronRight } from '@lucide/vue';
import LightboxViewport from './lightbox/LightboxViewport.vue';
import LightboxDetailPanel from './lightbox/LightboxDetailPanel.vue';

const props = defineProps<{
  item: MediaAsset | null;
  allAssets?: MediaAsset[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
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
  handleWheel,
  handleMouseDown,
  handleDoubleClick
} = useViewportCanvas(panelRef);

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
  const idx = currentBatchAssets.value.findIndex(a => a.id === currentActiveItem.value?.id || a.url === currentActiveItem.value?.url);
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

const configStore = useConfigStore();

async function handleDownload() {
  const item = currentActiveItem.value;
  if (item) {
    const pattern = configStore.downloadFilenamePattern;
    const targetFormat = configStore.downloadImageFormat;
    const origExt = (item.format || 'png').replace(/^\./, '');
    const finalExt = targetFormat && targetFormat !== 'auto' ? targetFormat : origExt;
    const filename = generateAssetFilename(item, undefined, rotation.value, { pattern, targetFormat });
    const normRot = ((rotation.value % 360) + 360) % 360;
    
    await downloadRotatedImage(item.url, filename, rotation.value, finalExt, origExt);
    emit('showToast', normRot !== 0 ? `已下载旋转 (${normRot}°) 后的图片！` : '已开始下载图片！', 'success');
  }
}

function handleReuse(item: MediaAsset) {
  emit('reuse', item);
  emit('close');
}

function handleEditAsReference(item: MediaAsset) {
  emit('editAsReference', item);
  emit('close');
}

function handleDelete(id: number) {
  emit('delete', id);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
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

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="currentActiveItem" class="modal-backdrop" @click.self="emit('close')">
    <button
      v-if="canSwitchWork"
      type="button"
      class="lightbox-side-nav is-prev"
      data-tip="上一件作品"
      aria-label="上一件作品"
      @click.stop="handlePrevWork"
    >
      <ChevronLeft :size="28" />
    </button>

    <button
      v-if="canSwitchWork"
      type="button"
      class="lightbox-side-nav is-next"
      data-tip="下一件作品"
      aria-label="下一件作品"
      @click.stop="handleNextWork"
    >
      <ChevronRight :size="28" />
    </button>

    <div class="modal-card">
      <button class="modal-close-btn" data-tip="关闭 (Esc)" @click="emit('close')">
        <X :size="18" />
      </button>

      <div class="modal-body">
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
          @prev="handlePrev"
          @next="handleNext"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset-scale="resetScale"
          @reset-view="resetView"
          @rotate-cw="rotateCw"
          @wheel="handleWheel"
          @mousedown="handleMouseDown"
          @dblclick="handleDoubleClick"
        />

        <!-- 右侧信息与操作 -->
        <LightboxDetailPanel
          :item="currentActiveItem"
          :rotation="rotation"
          @toggle-favorite="emit('toggleFavorite', $event)"
          @reuse="handleReuse"
          @edit-as-reference="handleEditAsReference"
          @delete="handleDelete"
          @download="handleDownload"
          @show-toast="(msg, type) => emit('showToast', msg, type)"
        />
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
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: fadeIn 0.2s ease;
}

.modal-card {
  max-width: 1060px;
  width: 100%;
  height: 86vh;
  min-height: min(560px, 90vh);
  max-height: 90vh;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  box-shadow: $shadow-float;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  @media (max-width: 860px) {
    height: auto;
    min-height: 0;
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
  border: 1px solid rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06);
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    background: #ffffff;
    color: $text-main;
    border-color: #93c5fd;
    transform: translateY(-50%) scale(1.06);
  }

  &:active {
    transform: translateY(-50%) scale(0.96);
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
  transition: all 0.15s ease;

  &:hover {
    background: #e2e8f0;
    color: $text-main;
  }
}

.modal-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 380px;
  overflow: hidden;

  @media (max-width: 860px) {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    overflow-y: auto;
  }
}
</style>
