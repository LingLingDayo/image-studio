<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { downloadRotatedImage, generateAssetFilename } from '@/utils/download';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { X } from 'lucide-vue-next';
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

const currentBatchAssets = computed(() => props.allAssets || (currentActiveItem.value ? [currentActiveItem.value] : []));
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

async function handleDownload() {
  const item = currentActiveItem.value;
  if (item) {
    const ext = (item.format || 'png').replace(/^\./, '');
    const filename = generateAssetFilename(item, undefined, rotation.value);
    const normRot = ((rotation.value % 360) + 360) % 360;
    
    await downloadRotatedImage(item.url, filename, rotation.value, ext);
    emit('showToast', normRot !== 0 ? `已下载旋转 (${normRot}°) 后的原图！` : '已开始下载原图！', 'success');
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
  emit('close');
  emit('showToast', '图片已删除', 'info');
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  } else if (e.key === 'ArrowLeft') {
    handlePrev();
  } else if (e.key === 'ArrowRight') {
    handleNext();
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
