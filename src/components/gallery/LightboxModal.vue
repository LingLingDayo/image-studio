<script setup lang="ts">
import type { MediaAsset } from '@/types/asset';
import { formatFullTime, downloadRotatedImage } from '@/utils/download';
import { formatQualityLabel, getResolutionDisplay } from '@/utils/imageSize';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { 
  X, 
  Download, 
  RotateCcw, 
  Trash2, 
  Copy, 
  Edit3, 
  Star, 
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

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

const isCopied = ref(false);
const panelRef = ref<HTMLElement | null>(null);
const currentActiveItem = ref<MediaAsset | null>(props.item);

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

const resolutionText = computed(() => getResolutionDisplay(currentActiveItem.value || undefined));

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

async function handleDownload() {
  const item = currentActiveItem.value;
  if (item) {
    const ext = item.format || 'png';
    const normRot = ((rotation.value % 360) + 360) % 360;
    const nameSuffix = normRot !== 0 ? `_r${normRot}` : '';
    const filename = `image_${item.id || Date.now()}${nameSuffix}.${ext}`;
    
    await downloadRotatedImage(item.url, filename, rotation.value, ext);
    emit('showToast', normRot !== 0 ? `已下载旋转 (${normRot}°) 后的原图！` : '已开始下载原图！', 'success');
  }
}

function handleCopyPrompt() {
  const item = currentActiveItem.value;
  if (item) {
    navigator.clipboard.writeText(item.prompt);
    isCopied.value = true;
    emit('showToast', '提示词已复制到剪贴板', 'info');
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }
}

function handleReuse() {
  const item = currentActiveItem.value;
  if (item) {
    emit('reuse', item);
    emit('close');
    emit('showToast', '已复用提示词与参数', 'info');
  }
}

function handleEditAsReference() {
  const item = currentActiveItem.value;
  if (item) {
    emit('editAsReference', item);
    emit('close');
    emit('showToast', '已将此图置入参考图栏', 'info');
  }
}

function handleDelete() {
  const item = currentActiveItem.value;
  if (item?.id) {
    emit('delete', item.id);
    emit('close');
    emit('showToast', '图片已删除', 'info');
  }
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
      <button class="modal-close-btn" @click="emit('close')">
        <X :size="18" />
      </button>

      <div class="modal-body">
        <!-- 左侧大图展示与交互视口 -->
        <div 
          ref="panelRef" 
          class="modal-image-panel" 
          :class="{ 'is-dragging': isDragging }"
          @wheel.prevent="handleWheel"
          @mousedown="handleMouseDown"
          @dblclick="handleDoubleClick"
        >
          <div 
            class="image-stage"
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)'
            }"
          >
            <img 
              :src="currentActiveItem.url" 
              :alt="currentActiveItem.prompt"
              :style="{
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }"
              draggable="false"
            />
          </div>

          <!-- 多图大图切换悬浮按钮 (批次多图时可见) -->
          <div v-if="currentBatchAssets.length > 1" class="lightbox-carousel-controls" @mousedown.stop>
            <button class="btn-lightbox-nav prev" data-tip="上一张 (← 键盘左键)" @click.stop="handlePrev">
              <ChevronLeft :size="20" />
            </button>
            <span class="lightbox-counter">{{ currentAssetIndex + 1 }} / {{ currentBatchAssets.length }}</span>
            <button class="btn-lightbox-nav next" data-tip="下一张 (→ 键盘右键)" @click.stop="handleNext">
              <ChevronRight :size="20" />
            </button>
          </div>

          <!-- 浮动半透明工具栏 (hover 显示) -->
          <div class="image-floating-toolbar" @mousedown.stop @wheel.stop @dblclick.stop>
            <button class="tool-btn" data-tip="缩小 (快捷键: 滚轮向下)" @click="zoomOut">
              <ZoomOut :size="15" />
            </button>

            <button class="tool-btn scale-indicator" data-tip="点击重置缩放为 100%" @click="resetScale">
              <span>{{ Math.round(scale * 100) }}%</span>
            </button>

            <button class="tool-btn" data-tip="放大 (快捷键: 滚轮向上)" @click="zoomIn">
              <ZoomIn :size="15" />
            </button>

            <div class="tool-divider"></div>

            <button class="tool-btn" data-tip="顺时针旋转 90°" @click="rotateCw">
              <RotateCw :size="15" />
              <span class="btn-text">旋转</span>
            </button>

            <button class="tool-btn" data-tip="视图归位 (100% 居中)" @click="resetView">
              <Maximize2 :size="14" />
              <span class="btn-text">归位</span>
            </button>
          </div>
        </div>

        <!-- 右侧信息与操作 -->
        <div class="modal-info-panel">
          <div class="info-header">
            <h3>作品详情</h3>
            <button 
              class="btn-fav" 
              :class="{ 'is-fav': currentActiveItem.isFavorite }" 
              data-tip="收藏"
              @click="currentActiveItem.id && emit('toggleFavorite', currentActiveItem.id)"
            >
              <Star :size="17" :class="{ 'star-filled': currentActiveItem.isFavorite }" />
            </button>
          </div>

          <!-- Prompt -->
          <div class="info-block">
            <div class="block-label">
              <span>提示词 (Prompt)</span>
              <button class="btn-text-copy" @click="handleCopyPrompt">
                <Check v-if="isCopied" :size="13" />
                <Copy v-else :size="13" />
                <span>{{ isCopied ? '已复制' : '复制' }}</span>
              </button>
            </div>
            <div class="prompt-box">
              {{ currentActiveItem.prompt }}
            </div>
          </div>

          <!-- Revised Prompt (如有) -->
          <div v-if="currentActiveItem.revisedPrompt" class="info-block">
            <span class="block-label">模型优化提示词 (Revised)</span>
            <div class="prompt-box revised">
              {{ currentActiveItem.revisedPrompt }}
            </div>
          </div>

          <!-- 参数详情表格 -->
          <div class="meta-grid">
            <div class="meta-row">
              <span class="meta-k">分辨率</span>
              <span class="meta-v">{{ resolutionText }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-k">尺寸比例</span>
              <span class="meta-v">{{ currentActiveItem.width ? `${currentActiveItem.width}×${currentActiveItem.height} (${currentActiveItem.ratio || ''})` : currentActiveItem.size }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-k">质量 / 格式</span>
              <span class="meta-v">{{ formatQualityLabel(currentActiveItem.quality) }} / {{ (currentActiveItem.format || 'png').toUpperCase() }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-k">生成耗时</span>
              <span class="meta-v">{{ currentActiveItem.duration }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-k">创建时间</span>
              <span class="meta-v">{{ formatFullTime(currentActiveItem.timestamp) }}</span>
            </div>
          </div>

          <!-- 底部操作按钮 -->
          <div class="modal-actions">
            <button class="btn-primary full-width" @click="handleDownload">
              <Download :size="16" />
              <span>{{ rotation % 360 !== 0 ? `下载旋转 (${((rotation % 360) + 360) % 360}°) 原图` : '下载原图' }}</span>
            </button>

            <div class="action-btn-row">
              <button class="btn-secondary flex-1" @click="handleReuse">
                <RotateCcw :size="15" />
                <span>复用参数</span>
              </button>

              <button class="btn-secondary flex-1" @click="handleEditAsReference">
                <Edit3 :size="15" />
                <span>以此图编辑</span>
              </button>

              <button class="btn-danger-outline" @click="handleDelete">
                <Trash2 :size="15" />
              </button>
            </div>
          </div>
        </div>
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

.modal-image-panel {
  background: #f8fafc;
  background-image: radial-gradient(#e2e8f0 1.2px, transparent 1.2px);
  background-size: 20px 20px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
  border-right: 1px solid $border-color;
  cursor: grab;
  user-select: none;
  touch-action: none;
  height: 100%;

  @media (max-width: 860px) {
    min-height: 380px;
    height: 48vh;
    border-right: none;
    border-bottom: 1px solid $border-color;
    flex-shrink: 0;
  }

  &.is-dragging {
    cursor: grabbing;
  }
}

.image-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  will-change: transform;
  pointer-events: none;

  img {
    max-width: calc(100% - 40px);
    max-height: calc(100% - 40px);
    object-fit: contain;
    border-radius: $radius-md;
    box-shadow: $shadow-md;
    border: 1px solid rgba(0, 0, 0, 0.04);
    will-change: transform;
    user-select: none;
  }
}

/* 多图大图切换悬浮按钮 */
.lightbox-carousel-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(12px);
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  .btn-lightbox-nav {
    background: transparent;
    border: none;
    color: #ffffff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
    }
  }

  .lightbox-counter {
    color: #ffffff;
    font-family: $font-mono;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0 4px;
  }
}

.image-floating-toolbar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translate(-50%, 10px);
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  .tool-btn {
    background: transparent;
    border: none;
    color: #e2e8f0;
    height: 30px;
    min-width: 30px;
    padding: 0 8px;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    &:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      transform: scale(1.04);
    }

    &:active {
      transform: scale(0.96);
    }

    &.scale-indicator {
      font-family: $font-mono;
      font-size: 0.72rem;
      min-width: 48px;
      padding: 0 6px;
      font-weight: 600;
      color: #93c5fd;

      &:hover {
        background: rgba(59, 130, 246, 0.25);
        color: #ffffff;
      }
    }

    .btn-text {
      font-size: 0.75rem;
    }
  }

  .tool-divider {
    width: 1px;
    height: 14px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0 2px;
  }
}

.modal-image-panel:hover .image-floating-toolbar,
.modal-image-panel:focus-within .image-floating-toolbar {
  opacity: 1;
  transform: translate(-50%, 0);
  pointer-events: auto;
}

.modal-info-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  border-left: 1px solid $border-color;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: $text-main;
  }
}

.btn-fav {
  background: transparent;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 4px;

  &:hover {
    color: #ca8a04;
  }

  &.is-fav {
    color: #ca8a04;
  }

  .star-filled {
    fill: #eab308;
    color: #ca8a04;
  }
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: $text-muted;
}

.btn-text-copy {
  background: none;
  border: none;
  color: $accent-primary;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.prompt-box {
  font-size: 0.85rem;
  color: $text-main;
  background: $bg-surface-subtle;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 10px 12px;
  line-height: 1.5;
  max-height: 140px;
  overflow-y: auto;
  word-break: break-word;

  &.revised {
    color: $text-secondary;
    font-style: italic;
  }
}

.meta-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: $bg-surface-subtle;
  padding: 12px;
  border-radius: $radius-md;
  border: 1px solid $border-color;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;

  .meta-k {
    color: $text-muted;
  }

  .meta-v {
    font-family: $font-mono;
    font-weight: 500;
    color: $text-main;
  }
}

.modal-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.action-btn-row {
  display: flex;
  gap: 8px;
}

.flex-1 {
  flex: 1;
}

.full-width {
  width: 100%;
}
</style>
