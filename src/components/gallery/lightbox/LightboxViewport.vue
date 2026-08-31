<script setup lang="ts">
import { ref } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-vue-next';

defineProps<{
  activeItem: MediaAsset;
  batchAssets: MediaAsset[];
  currentIndex: number;
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
  isDragging: boolean;
}>();

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
  (e: 'resetScale'): void;
  (e: 'resetView'): void;
  (e: 'rotateCw'): void;
  (e: 'wheel', event: WheelEvent): void;
  (e: 'mousedown', event: MouseEvent): void;
  (e: 'dblclick', event: MouseEvent): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

defineExpose({
  containerRef
});
</script>

<template>
  <div 
    ref="containerRef" 
    class="modal-image-panel" 
    :class="{ 'is-dragging': isDragging }"
    @wheel.prevent="emit('wheel', $event)"
    @mousedown="emit('mousedown', $event)"
    @dblclick="emit('dblclick', $event)"
  >
    <div 
      class="image-stage"
      :style="{
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transition: isDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)'
      }"
    >
      <img 
        :src="activeItem.url" 
        :alt="activeItem.prompt"
        :style="{
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }"
        draggable="false"
      />
    </div>

    <!-- 多图大图切换悬浮按钮 (批次多图时可见) -->
    <div v-if="batchAssets.length > 1" class="lightbox-carousel-controls" @mousedown.stop>
      <button class="btn-lightbox-nav prev" data-tip="上一张 (← 键盘左键)" @click.stop="emit('prev')">
        <ChevronLeft :size="20" />
      </button>
      <span class="lightbox-counter">{{ currentIndex + 1 }} / {{ batchAssets.length }}</span>
      <button class="btn-lightbox-nav next" data-tip="下一张 (→ 键盘右键)" @click.stop="emit('next')">
        <ChevronRight :size="20" />
      </button>
    </div>

    <!-- 浮动半透明工具栏 (hover 显示) -->
    <div class="image-floating-toolbar" @mousedown.stop @wheel.stop @dblclick.stop>
      <button class="tool-btn" data-tip="缩小 (滚轮向下)" @click="emit('zoomOut')">
        <ZoomOut :size="15" />
      </button>

      <button class="tool-btn scale-indicator" data-tip="重置缩放 (100%)" @click="emit('resetScale')">
        <span>{{ Math.round(scale * 100) }}%</span>
      </button>

      <button class="tool-btn" data-tip="放大 (滚轮向上)" @click="emit('zoomIn')">
        <ZoomIn :size="15" />
      </button>

      <div class="tool-divider"></div>

      <button class="tool-btn" data-tip="顺时针旋转 90°" @click="emit('rotateCw')">
        <RotateCw :size="15" />
      </button>

      <button class="tool-btn" data-tip="重置视图 (100% 居中)" @click="emit('resetView')">
        <Maximize2 :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

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
</style>
