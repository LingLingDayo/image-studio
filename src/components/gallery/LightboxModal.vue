<script setup lang="ts">
import type { MediaAsset } from '@/types/asset';
import { formatFullTime, downloadRotatedImage, generateAssetFilename } from '@/utils/download';
import { formatQualityLabel, getResolutionDisplay, inferResolutionTier } from '@/utils/imageSize';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { 
  X, 
  Download, 
  CornerUpLeft, 
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
  ChevronRight,
  Sliders,
  Image as ImageIcon,
  Timer,
  Clock
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

// 模型优化提示词有效性判定（存在且不等于原提示词）
const hasRevisedPrompt = computed(() => {
  const item = currentActiveItem.value;
  if (!item?.revisedPrompt) return false;
  const revised = item.revisedPrompt.trim();
  const origin = (item.prompt || '').trim();
  return revised !== '' && revised !== origin;
});

// 生图模式标签
const presetTypeLabel = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '文生图';
  return item.type === 'i2i' || (item.referenceImages && item.referenceImages.length > 0) ? '图生图' : '文生图';
});

// 1. 分辨率：设定分辨率 vs 实际分辨率
const presetResolution = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '自动';
  if (item.targetResolution) {
    return item.targetResolution === 'auto' ? '自动' : item.targetResolution.toUpperCase();
  }
  return item.size === 'auto' ? '自动' : getResolutionDisplay(item);
});

const actualResolution = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '-';
  if (item.width && item.height) {
    return inferResolutionTier(Math.max(item.width, item.height)).toUpperCase();
  }
  return getResolutionDisplay(item);
});

// 2. 宽高比：设定比例 vs 实际比例
const presetRatio = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '自动';
  if (item.targetRatio) {
    return item.targetRatio === 'auto' ? '自动' : item.targetRatio;
  }
  return item.ratio && item.ratio !== 'auto' ? item.ratio : '自动';
});

const actualRatio = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '-';
  return item.ratio || '1:1';
});

// 3. 物理尺寸：设定尺寸 vs 真实尺寸
const presetSize = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '自动';
  if (item.targetSize) {
    return item.targetSize === 'auto' ? '自动' : item.targetSize.replace(/x/i, '×');
  }
  if (item.size && item.size !== 'auto') {
    return item.size.replace(/x/i, '×');
  }
  return '自动';
});

const actualDimension = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return '-';
  if (item.width && item.height) {
    return `${item.width}×${item.height}`;
  }
  return item.size ? item.size.replace(/x/i, '×') : '-';
});

// 4. 质量与格式：设定画质 vs 实际格式
const presetQuality = computed(() => {
  return formatQualityLabel(currentActiveItem.value?.quality);
});

const actualFormat = computed(() => {
  const item = currentActiveItem.value;
  if (!item) return 'PNG';
  return (item.format || 'png').toUpperCase();
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
    const ext = (item.format || 'png').replace(/^\./, '');
    const filename = generateAssetFilename(item, undefined, rotation.value);
    const normRot = ((rotation.value % 360) + 360) % 360;
    
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
      <button class="modal-close-btn" data-tip="关闭 (Esc)" @click="emit('close')">
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
            <button class="tool-btn" data-tip="缩小 (滚轮向下)" @click="zoomOut">
              <ZoomOut :size="15" />
            </button>

            <button class="tool-btn scale-indicator" data-tip="重置缩放 (100%)" @click="resetScale">
              <span>{{ Math.round(scale * 100) }}%</span>
            </button>

            <button class="tool-btn" data-tip="放大 (滚轮向上)" @click="zoomIn">
              <ZoomIn :size="15" />
            </button>

            <div class="tool-divider"></div>

            <button class="tool-btn" data-tip="顺时针旋转 90°" @click="rotateCw">
              <RotateCw :size="15" />
            </button>

            <button class="tool-btn" data-tip="重置视图 (100% 居中)" @click="resetView">
              <Maximize2 :size="15" />
            </button>
          </div>
        </div>

        <!-- 右侧信息与操作 -->
        <div class="modal-info-panel">
          <div class="info-header">
            <div class="header-title-wrap">
              <h3>作品详情</h3>
              <button 
                class="btn-fav" 
                :class="{ 'is-fav': currentActiveItem.isFavorite }" 
                :data-tip="currentActiveItem.isFavorite ? '取消收藏' : '收藏此图'"
                @click="currentActiveItem.id && emit('toggleFavorite', currentActiveItem.id)"
              >
                <Star :size="17" :class="{ 'star-filled': currentActiveItem.isFavorite }" />
              </button>
            </div>
          </div>

          <!-- Prompt -->
          <div class="info-block">
            <div class="block-label">
              <span>提示词</span>
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

          <!-- Revised Prompt (如有且与原提示词不同) -->
          <div v-if="hasRevisedPrompt" class="info-block">
            <span class="block-label">模型优化提示词</span>
            <div class="prompt-box revised">
              {{ currentActiveItem?.revisedPrompt }}
            </div>
          </div>

          <!-- 参数与规格看板 (单层一体化布局) -->
          <div v-if="currentActiveItem" class="params-dashboard">
            <!-- 核心规格双栏对比区 -->
            <div class="specs-grid">
              <!-- 左栏：生图设定 (4项核心维度) -->
              <div class="spec-column preset-column">
                <div class="spec-column-header">
                  <div class="header-title">
                    <Sliders :size="12" />
                    <span>生图设定</span>
                  </div>
                  <span class="mode-mini-tag" :class="presetTypeLabel === '图生图' ? 'is-i2i' : 'is-t2i'">
                    {{ presetTypeLabel }}
                  </span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">设定分辨率</span>
                  <span class="spec-v">{{ presetResolution }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">设定比例</span>
                  <span class="spec-v">{{ presetRatio }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">设定尺寸</span>
                  <span class="spec-v">{{ presetSize }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">设定画质</span>
                  <span class="spec-v">{{ presetQuality }}</span>
                </div>
              </div>

              <!-- 右栏：实际结果 (4项核心维度) -->
              <div class="spec-column output-column">
                <div class="spec-column-header">
                  <div class="header-title">
                    <ImageIcon :size="12" />
                    <span>实际结果</span>
                  </div>
                  <span v-if="currentActiveItem.transparent" class="mode-mini-tag is-transparent">
                    透明底
                  </span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">实际分辨率</span>
                  <span class="spec-v">{{ actualResolution }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">实际比例</span>
                  <span class="spec-v">{{ actualRatio }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">真实尺寸</span>
                  <span class="spec-v highlight-mono">{{ actualDimension }}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-k">图像格式</span>
                  <span class="spec-v">{{ actualFormat }}</span>
                </div>
              </div>
            </div>

            <!-- 底部一体化元数据栏 -->
            <div class="meta-footer">
              <div class="meta-stat-item" :data-tip="`生成耗时: ${currentActiveItem.duration}`">
                <Timer :size="12" class="stat-icon" />
                <span class="stat-k">耗时</span>
                <span class="stat-v">{{ currentActiveItem.duration }}</span>
              </div>
              <div class="meta-stat-divider"></div>
              <div class="meta-stat-item" :data-tip="`创建时间: ${formatFullTime(currentActiveItem.timestamp)}`">
                <Clock :size="12" class="stat-icon" />
                <span class="stat-k">时间</span>
                <span class="stat-v">{{ formatFullTime(currentActiveItem.timestamp) }}</span>
              </div>
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
                <CornerUpLeft :size="15" />
                <span>复用参数</span>
              </button>

              <button class="btn-secondary flex-1" @click="handleEditAsReference">
                <Edit3 :size="15" />
                <span>以此图编辑</span>
              </button>

              <button class="btn-danger-outline btn-icon" data-tip="删除此图片" @click="handleDelete">
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
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 4px 10px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.1), 0 2px 6px -1px rgba(15, 23, 42, 0.05);
  z-index: 10;

  .btn-lightbox-nav {
    background: transparent;
    border: none;
    color: #475569;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(241, 245, 249, 0.95);
      color: #0f172a;
      transform: scale(1.1);
    }
  }

  .lightbox-counter {
    color: #334155;
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9);
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
    color: #475569;
    height: 30px;
    width: 30px;
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    &:hover {
      background: #f1f5f9;
      color: #0f172a;
      transform: scale(1.06);
    }

    &:active {
      transform: scale(0.94);
    }

    &.scale-indicator {
      font-family: $font-mono;
      font-size: 0.72rem;
      width: auto;
      min-width: 48px;
      padding: 0 6px;
      font-weight: 600;
      color: $accent-primary;

      &:hover {
        background: $accent-subtle;
        color: #1d4ed8;
      }
    }
  }

  .tool-divider {
    width: 1px;
    height: 14px;
    background: #e2e8f0;
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
  padding-right: 36px; // 避开右上角关闭按钮区域
  min-height: 32px;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;

    h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: $text-main;
      margin: 0;
    }
  }
}

.btn-fav {
  background: transparent;
  border: none;
  color: $text-dim;
  cursor: pointer;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: $radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    color: $favorite;
    background: rgba(245, 158, 11, 0.1);
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-fav {
    color: $favorite;

    &:hover {
      background: rgba(245, 158, 11, 0.14);
    }
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 3px rgba(245, 158, 11, 0.28));
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

.params-dashboard {
  background: $bg-surface-subtle;
  padding: 12px 14px;
  border-radius: $radius-lg;
  border: 1px solid $border-color;
  display: flex;
  flex-direction: column;
}

.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.spec-column {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:first-child {
    padding-right: 4px;
    border-right: 1px solid $border-color;

    @media (max-width: 360px) {
      padding-right: 0;
      border-right: none;
      padding-bottom: 8px;
      border-bottom: 1px solid $border-color;
    }
  }

  .spec-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.73rem;
    font-weight: 600;
    padding-bottom: 5px;
    margin-bottom: 2px;
    border-bottom: 1px solid $border-light;

    .header-title {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
  }

  &.preset-column .spec-column-header .header-title {
    color: $accent-primary;
  }

  &.output-column .spec-column-header .header-title {
    color: #059669;
  }
}

.mode-mini-tag {
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 500;
  line-height: 1.2;

  &.is-t2i {
    background: $accent-subtle;
    color: $accent-primary;
  }

  &.is-i2i {
    background: rgba(168, 85, 247, 0.1);
    color: #9333ea;
  }

  &.is-transparent {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
  }
}

.spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  gap: 8px;

  .spec-k {
    color: $text-muted;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .spec-v {
    color: $text-main;
    font-weight: 500;
    white-space: nowrap;
    text-align: right;

    &.highlight-mono {
      font-family: $font-mono;
      font-size: 0.72rem;
    }
  }
}

.meta-footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
}

.meta-stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: $text-muted;

  .stat-icon {
    color: $text-dim;
    flex-shrink: 0;
  }

  .stat-k {
    color: $text-muted;
  }

  .stat-v {
    color: $text-main;
    font-weight: 500;
    font-family: $font-mono;
  }
}

.meta-stat-divider {
  width: 1px;
  height: 12px;
  background: $border-color;
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
  align-items: center;

  .btn-danger-outline {
    width: 36px;
    height: 36px;
    padding: 0;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }
}

.flex-1 {
  flex: 1;
}

.full-width {
  width: 100%;
}
</style>
