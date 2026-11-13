<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, getCurrentInstance } from 'vue';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  RotateCw, 
  Scaling,
  Maximize2, 
  Minimize2,
  X,
  ChevronLeft, 
  ChevronRight,
  AlertCircle,
  Loader2
} from '@lucide/vue';
import { useViewportCanvas } from '@/composables/useViewportCanvas';
import { getErrorHeadline } from '@/utils/apiError';

export interface ViewerImageItem {
  id?: string | number;
  url: string;
  alt?: string;
  status?: string;
  errorMessage?: string;
}

const props = withDefaults(defineProps<{
  // 单图
  src?: string;
  alt?: string;
  // 多图
  images?: Array<string | ViewerImageItem>;
  currentIndex?: number;
  // 画布控制（若父组件传入则使用受控模式，若不传则组件内部自管理）
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotation?: number;
  isDragging?: boolean;
  // 全屏控制
  isFullscreen?: boolean;
  allowFullscreen?: boolean;
  // 错误状态
  status?: string;
  errorMessage?: string;
  // 界面选项
  showToolbar?: boolean;
  showNavigation?: boolean;
  showClose?: boolean;
  // 独立查看器模式（独立弹窗/全屏时显示左右切换按钮；嵌入式如作品详情左侧传 false）
  standalone?: boolean;
  // 外部存在跨组可切换图片时可显式开启左右导航
  canNavigate?: boolean;
  // 是否由查看器自身响应左右方向键
  keyboardNavigation?: boolean;
  // 工具栏静止隐藏时间 (ms)，默认 4000ms (4s)
  idleTimeout?: number;
}>(), {
  allowFullscreen: true,
  showToolbar: true,
  showNavigation: true,
  showClose: true,
  standalone: true,
  canNavigate: undefined,
  keyboardNavigation: true,
  idleTimeout: 4000
});

const emit = defineEmits<{
  (e: 'update:currentIndex', index: number): void;
  (e: 'update:isFullscreen', isFullscreen: boolean): void;
  (e: 'update:rotation', rotation: number): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'close'): void;
  (e: 'exitFullscreen'): void;
  (e: 'toggleFullscreen'): void;
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
  (e: 'resetScale'): void;
  (e: 'resetView'): void;
  (e: 'rotateCw'): void;
  (e: 'rotateCcw'): void;
  (e: 'wheel', event: WheelEvent): void;
  (e: 'pointerdown', event: PointerEvent): void;
  (e: 'mousedown', event: MouseEvent): void;
  (e: 'dblclick', event: MouseEvent): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

// 归一化图片列表
const normalizedImages = computed<ViewerImageItem[]>(() => {
  if (props.images && props.images.length > 0) {
    return props.images.map((item, idx) => {
      if (typeof item === 'string') {
        return { id: idx, url: item, alt: `Image ${idx + 1}` };
      }
      return {
        id: item.id ?? idx,
        url: item.url,
        alt: item.alt || `Image ${idx + 1}`,
        status: item.status,
        errorMessage: item.errorMessage
      };
    });
  }
  if (props.src) {
    return [{
      url: props.src,
      alt: props.alt || 'Image',
      status: props.status,
      errorMessage: props.errorMessage
    }];
  }
  return [];
});

const internalIndex = ref(0);
const isIndexControlled = computed(() => props.currentIndex !== undefined);

watch(
  () => normalizedImages.value.length,
  (len) => {
    if (len === 0) {
      internalIndex.value = 0;
    } else if (internalIndex.value >= len) {
      internalIndex.value = len - 1;
    }
  }
);

const activeIndex = computed(() => {
  if (normalizedImages.value.length === 0) return 0;
  const raw = isIndexControlled.value ? (props.currentIndex ?? 0) : internalIndex.value;
  return Math.min(Math.max(0, raw), normalizedImages.value.length - 1);
});

const currentActiveItem = computed<ViewerImageItem | null>(() => {
  if (normalizedImages.value.length === 0) return null;
  return normalizedImages.value[activeIndex.value];
});

// 组件内部自管理画布手势（非受控模式下使用）
const internalCanvas = useViewportCanvas(containerRef);

// 判断当前各状态是否受控
const instance = getCurrentInstance();
const isScaleControlled = computed(() => props.scale !== undefined);
const isTransformControlled = computed(() => props.translateX !== undefined && props.translateY !== undefined);
const isRotationControlled = computed(() => props.rotation !== undefined);
const isDraggingControlled = computed(() => props.isDragging !== undefined);
const isFullscreenControlled = computed(() => {
  if (!instance?.vnode.props) return false;
  return (
    'isFullscreen' in instance.vnode.props ||
    'is-fullscreen' in instance.vnode.props ||
    'onUpdate:isFullscreen' in instance.vnode.props ||
    'onUpdate:is-fullscreen' in instance.vnode.props
  );
});

const currentScale = computed(() => isScaleControlled.value ? (props.scale ?? 1) : internalCanvas.scale.value);
const currentTranslateX = computed(() => isTransformControlled.value ? (props.translateX ?? 0) : internalCanvas.translateX.value);
const currentTranslateY = computed(() => isTransformControlled.value ? (props.translateY ?? 0) : internalCanvas.translateY.value);
const currentRotation = computed(() => isRotationControlled.value ? (props.rotation ?? 0) : internalCanvas.rotation.value);
const currentIsDragging = computed(() => isDraggingControlled.value ? (props.isDragging ?? false) : internalCanvas.isDragging.value);

// 内部全屏管理（非受控时使用）
const internalFullscreen = ref(false);
const activeFullscreen = computed(() => isFullscreenControlled.value ? (props.isFullscreen ?? false) : internalFullscreen.value);

// 独立查看器弹窗或全屏模式下展示左右切图按钮，嵌入式查看器（如详情左侧）不显示
const isSideNavContext = computed(() => props.standalone || activeFullscreen.value);
const canSideNavigate = computed(() => props.canNavigate ?? normalizedImages.value.length > 1);

// 工具栏鼠标静止 4s 自动隐藏收起
const isToolbarVisible = ref(false);
let toolbarTimer: ReturnType<typeof setTimeout> | null = null;

function clearToolbarTimer() {
  if (toolbarTimer !== null) {
    clearTimeout(toolbarTimer);
    toolbarTimer = null;
  }
}

function resetToolbarTimer() {
  isToolbarVisible.value = true;
  clearToolbarTimer();
  if (props.idleTimeout > 0) {
    toolbarTimer = setTimeout(() => {
      isToolbarVisible.value = false;
    }, props.idleTimeout);
  }
}

function handleMouseEnter() {
  resetToolbarTimer();
}

function handleMouseMove() {
  resetToolbarTimer();
}

function handleMouseLeave() {
  clearToolbarTimer();
  isToolbarVisible.value = false;
}

function handleToggleFullscreen() {
  resetToolbarTimer();
  emit('toggleFullscreen');
  if (isFullscreenControlled.value) {
    emit('update:isFullscreen', !props.isFullscreen);
    return;
  }
  internalFullscreen.value = !internalFullscreen.value;
}

function handleExitFullscreen() {
  resetToolbarTimer();
  emit('exitFullscreen');
  if (isFullscreenControlled.value) {
    emit('update:isFullscreen', false);
    return;
  }
  internalFullscreen.value = false;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isFullscreenControlled.value && e.key === 'Escape' && activeFullscreen.value) {
    handleExitFullscreen();
    return;
  }
  if (!props.keyboardNavigation || !props.showNavigation || !canSideNavigate.value) return;
  if (e.defaultPrevented || e.isComposing || isTypingTarget(e.target)) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    handlePrev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    handleNext();
  }
}

// 退出全屏时清掉工具栏残留焦点，避免键盘退出后浏览器给全屏按钮套上默认 focus 描边
watch(activeFullscreen, (isFullscreenNow, wasFullscreen) => {
  if (!wasFullscreen || isFullscreenNow) return;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.closest('.image-floating-toolbar, .fullscreen-close-btn, .viewer-side-nav')) {
    active.blur();
  }
});

// 交互控件不参与画布拖拽：容器的 setPointerCapture 会把后续 click 派发到容器，
// 使按钮点击失效。控件自身已阻止冒泡，这里作为通用兜底。
function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, .image-floating-toolbar, .lightbox-carousel-controls');
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  clearToolbarTimer();
  window.removeEventListener('keydown', handleKeyDown);
});

// 手势与工具栏操作
function handleZoomIn() {
  resetToolbarTimer();
  emit('zoomIn');
  if (!isScaleControlled.value) {
    internalCanvas.zoomIn();
  }
}

function handleZoomOut() {
  resetToolbarTimer();
  emit('zoomOut');
  if (!isScaleControlled.value) {
    internalCanvas.zoomOut();
  }
}

function handleResetScale() {
  resetToolbarTimer();
  emit('resetScale');
  if (!isScaleControlled.value) {
    internalCanvas.resetScale();
  }
}

function handleResetView() {
  resetToolbarTimer();
  emit('resetView');
  if (!isScaleControlled.value && !isTransformControlled.value) {
    internalCanvas.resetView();
  }
}

function handleRotateCw() {
  resetToolbarTimer();
  emit('rotateCw');
  if (!isRotationControlled.value) {
    internalCanvas.rotateCw();
    emit('update:rotation', internalCanvas.rotation.value);
  }
}

function handleRotateCcw() {
  resetToolbarTimer();
  emit('rotateCcw');
  if (!isRotationControlled.value) {
    internalCanvas.rotateCcw();
    emit('update:rotation', internalCanvas.rotation.value);
  }
}

function onWheel(e: WheelEvent) {
  resetToolbarTimer();
  emit('wheel', e);
  if (!isScaleControlled.value) {
    internalCanvas.handleWheel(e);
  }
}

function onPointerDown(e: PointerEvent) {
  resetToolbarTimer();
  if (isInteractiveTarget(e.target)) return;
  emit('pointerdown', e);
  if (!isDraggingControlled.value) {
    internalCanvas.handlePointerDown(e);
  }
}

function onMouseDown(e: MouseEvent) {
  resetToolbarTimer();
  if (isInteractiveTarget(e.target)) return;
  emit('mousedown', e);
  if (!isDraggingControlled.value) {
    internalCanvas.handleMouseDown(e);
  }
}

function onDoubleClick(e: MouseEvent) {
  resetToolbarTimer();
  emit('dblclick', e);
  if (!isScaleControlled.value && !isTransformControlled.value) {
    internalCanvas.handleDoubleClick(e);
  }
}

function handlePrev() {
  resetToolbarTimer();
  emit('prev');
  if (normalizedImages.value.length > 1) {
    const prevIdx = (activeIndex.value - 1 + normalizedImages.value.length) % normalizedImages.value.length;
    if (!isIndexControlled.value) {
      internalIndex.value = prevIdx;
    }
    emit('update:currentIndex', prevIdx);
    if (!isScaleControlled.value) {
      internalCanvas.resetTransform();
    }
  }
}

function handleNext() {
  resetToolbarTimer();
  emit('next');
  if (normalizedImages.value.length > 1) {
    const nextIdx = (activeIndex.value + 1) % normalizedImages.value.length;
    if (!isIndexControlled.value) {
      internalIndex.value = nextIdx;
    }
    emit('update:currentIndex', nextIdx);
    if (!isScaleControlled.value) {
      internalCanvas.resetTransform();
    }
  }
}

const headlineText = computed(() => {
  return getErrorHeadline(currentActiveItem.value?.errorMessage);
});

defineExpose({
  containerRef,
  activeIndex,
  prev: handlePrev,
  next: handleNext,
  resetTransform: internalCanvas.resetTransform,
  resetView: handleResetView,
  zoomIn: handleZoomIn,
  zoomOut: handleZoomOut,
  rotateCw: handleRotateCw,
  rotateCcw: handleRotateCcw,
  toggleFullscreen: handleToggleFullscreen,
  exitFullscreen: handleExitFullscreen,
  isToolbarVisible,
  resetToolbarTimer
});
</script>

<template>
  <div 
    ref="containerRef" 
    class="modal-image-panel" 
    :class="{ 'is-dragging': currentIsDragging, 'is-fullscreen': activeFullscreen }"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @mousedown="onMouseDown"
    @dblclick="onDoubleClick"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- 全屏模式右上角退出按钮：点击取消全屏 -->
    <button
      v-if="activeFullscreen && showClose"
      type="button"
      class="fullscreen-close-btn"
      data-tip="退出全屏 (Esc)"
      aria-label="退出全屏"
      @pointerdown.stop
      @mousedown.stop
      @dblclick.stop
      @click.stop="handleExitFullscreen"
    >
      <X :size="18" />
    </button>

    <!-- 失败状态视口展示 -->
    <div 
      v-if="currentActiveItem && currentActiveItem.status === 'failed'" 
      class="viewport-failed-stage"
    >
      <div class="failed-card-box">
        <div class="failed-icon-wrap">
          <AlertCircle :size="48" class="fail-icon" />
        </div>
        <h3 class="failed-title">{{ headlineText }}</h3>
        <p class="failed-message">{{ currentActiveItem.errorMessage || '该图像加载或生成失败，未返回具体原因' }}</p>
        <p class="failed-hint">
          此批次中的当前项未生成或加载成功。您可以点击切换按钮查看其他图片。
        </p>
      </div>
    </div>

    <!-- 像素尚未按需装载完成时显示加载态，区别于真正的生成失败 -->
    <div v-else-if="currentActiveItem && !currentActiveItem.url" class="viewport-loading-stage">
      <Loader2 :size="28" class="viewer-loading-icon" />
      <span>图片加载中…</span>
    </div>

    <!-- 正常图片视口展示 -->
    <div 
      v-else-if="currentActiveItem && currentActiveItem.url"
      class="image-stage"
      :style="{
        transform: `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentScale})`,
        transition: currentIsDragging ? 'none' : 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)'
      }"
    >
      <img 
        :src="currentActiveItem.url" 
        :alt="currentActiveItem.alt || 'Preview'"
        :style="{
          transform: `rotate(${currentRotation}deg)`,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }"
        draggable="false"
      />
    </div>

    <!-- 多图切换悬浮胶囊 (多图时可见，与作品卡片多图切换风格保持一致) -->
    <div 
      v-if="showNavigation && normalizedImages.length > 1" 
      class="lightbox-carousel-controls" 
      @pointerdown.stop="resetToolbarTimer" 
      @mousedown.stop="resetToolbarTimer"
      @dblclick.stop
    >
      <button type="button" class="btn-lightbox-nav prev" data-tip="上一张 (← 键盘左键)" aria-label="上一张" @click.stop="handlePrev">
        <ChevronLeft :size="16" />
      </button>
      <span class="lightbox-counter">{{ activeIndex + 1 }} / {{ normalizedImages.length }}</span>
      <button type="button" class="btn-lightbox-nav next" data-tip="下一张 (→ 键盘右键)" aria-label="下一张" @click.stop="handleNext">
        <ChevronRight :size="16" />
      </button>
    </div>

    <!-- 独立查看器 / 全屏模式左右切图按钮 (鼠标静止时随底部工具栏自动隐藏) -->
    <button
      v-if="showNavigation && isSideNavContext && canSideNavigate"
      type="button"
      class="viewer-side-nav is-prev"
      :class="{ 'is-visible': isToolbarVisible }"
      data-tip="上一张 (←)"
      aria-label="上一张"
      @pointerdown.stop="resetToolbarTimer"
      @mousedown.stop="resetToolbarTimer"
      @focusin="resetToolbarTimer"
      @dblclick.stop
      @click.stop="handlePrev"
    >
      <ChevronLeft :size="24" />
    </button>

    <button
      v-if="showNavigation && isSideNavContext && canSideNavigate"
      type="button"
      class="viewer-side-nav is-next"
      :class="{ 'is-visible': isToolbarVisible }"
      data-tip="下一张 (→)"
      aria-label="下一张"
      @pointerdown.stop="resetToolbarTimer"
      @mousedown.stop="resetToolbarTimer"
      @focusin="resetToolbarTimer"
      @dblclick.stop
      @click.stop="handleNext"
    >
      <ChevronRight :size="24" />
    </button>

    <!-- 浮动半透明工具栏 (鼠标移动显示/静止4s自动收起，仅在图片正常时呈现) -->
    <div 
      v-if="showToolbar && currentActiveItem && currentActiveItem.status !== 'failed' && currentActiveItem.url"
      class="image-floating-toolbar" 
      :class="{ 'is-visible': isToolbarVisible }"
      @pointerdown.stop="resetToolbarTimer" 
      @mousedown.stop="resetToolbarTimer" 
      @focusin="resetToolbarTimer"
      @wheel.stop 
      @dblclick.stop
    >
      <button class="tool-btn" data-tip="缩小 (滚轮向下)" @click="handleZoomOut">
        <ZoomOut :size="15" />
      </button>

      <button class="tool-btn scale-indicator" data-tip="重置缩放 (100%)" @click="handleResetScale">
        <span>{{ Math.round(currentScale * 100) }}%</span>
      </button>

      <button class="tool-btn" data-tip="放大 (滚轮向上)" @click="handleZoomIn">
        <ZoomIn :size="15" />
      </button>

      <div class="tool-divider"></div>

      <button class="tool-btn" data-tip="向左旋转 90°" @click="handleRotateCcw">
        <RotateCcw :size="15" />
      </button>

      <button class="tool-btn" data-tip="向右旋转 90°" @click="handleRotateCw">
        <RotateCw :size="15" />
      </button>

      <div class="tool-divider"></div>

      <button class="tool-btn" data-tip="重置视图 (100% 居中)" @click="handleResetView">
        <Scaling :size="15" />
      </button>

      <button
        v-if="allowFullscreen"
        class="tool-btn"
        :data-tip="activeFullscreen ? '退出全屏 (Esc)' : '全屏显示'"
        @click="handleToggleFullscreen"
      >
        <Minimize2 v-if="activeFullscreen" :size="15" />
        <Maximize2 v-else :size="15" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-image-panel {
  background: $bg-surface-subtle;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
  border-right: 1px solid $border-color;
  cursor: default; /* hover 时使用默认箭头样式 */
  user-select: none;
  touch-action: none;
  height: 100%;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: 860px) {
    flex: 0 0 auto;
    width: 100%;
    height: 36vh;
    min-height: 168px;
    max-height: 38vh;
    padding: 12px;
    border-right: none;
    border-bottom: 1px solid $border-color;
  }

  &.is-dragging {
    cursor: grabbing;
  }

  &.is-fullscreen {
    border-right: none;
    border-radius: 0;

    @media (max-width: 860px) {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 0;
      max-height: none;
      border-bottom: none;
    }
  }
}

.fullscreen-close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: $bg-glass;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid $border-color;
  box-shadow: $shadow-lg;
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 50;
  transition: color 0.12s ease, background-color 0.12s ease;

  &:hover {
    background: $bg-surface;
    color: $text-main;
  }

  @media (max-width: 860px) {
    top: 12px;
    right: 12px;
    width: 34px;
    height: 34px;
  }
}

.viewport-loading-stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: $text-dim;
  font-size: 0.85rem;
  z-index: 1;
}

.viewer-loading-icon {
  color: $accent-primary;
  animation: viewer-spin 1s infinite linear;
}

@keyframes viewer-spin {
  to { transform: rotate(360deg); }
}

.viewport-failed-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  z-index: 1;

  .failed-card-box {
    max-width: 480px;
    width: 100%;
    background: $bg-surface;
    border: 1px solid $danger-border;
    border-radius: 12px;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    box-shadow: 0 10px 25px -5px $danger-soft, $shadow-xs;
  }

  .failed-icon-wrap {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: $danger-subtle;
    color: $danger;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  .failed-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: $danger;
    margin: 0 0 10px 0;
  }

  .failed-message {
    font-size: 0.88rem;
    color: $danger-hover;
    background: $danger-subtle;
    border: 1px solid $danger-subtle;
    border-radius: 6px;
    padding: 10px 14px;
    margin: 0 0 14px 0;
    line-height: 1.5;
    word-break: break-word;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }

  .failed-hint {
    font-size: 0.78rem;
    color: $text-secondary;
    line-height: 1.45;
    margin: 0;
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
    border: 1px solid $border-subtle;
    will-change: transform;
    user-select: none;
  }
}

/* 多图切换悬浮胶囊 */
.lightbox-carousel-controls {
  position: absolute;
  top: 20px;
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: $bg-glass;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  padding: 4px 8px;
  border-radius: 9999px;
  border: 1px solid $border-color;
  box-shadow: $shadow-lg;
  z-index: 10;

  .btn-lightbox-nav {
    background: transparent;
    border: none;
    color: $text-secondary;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    transition: color 0.12s ease, background-color 0.12s ease;

    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 1px solid $accent-border;
      outline-offset: 2px;
    }

    &:hover {
      background: $bg-surface-hover;
      color: $text-main;
    }
  }

  .lightbox-counter {
    color: $text-secondary;
    font-family: $font-mono;
    font-size: 0.78rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 0 4px;
    white-space: nowrap;
    user-select: none;
  }
}

/* 独立查看器 / 全屏模式左右切图按钮（静止自动隐藏，显隐与底部工具栏同步） */
.viewer-side-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid $border-color;
  background: $bg-glass;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: $shadow-lg;
  color: $text-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, color 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;

  &.is-visible {
    opacity: 1;
    pointer-events: auto;
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 1px solid $accent-border;
    outline-offset: 2px;
  }

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
}

.image-floating-toolbar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translate(-50%, 10px);
  background: $bg-glass;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid $border-color;
  box-shadow: $shadow-lg;
  border-radius: 9999px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);

  &.is-visible {
    opacity: 1;
    transform: translate(-50%, 0);
    pointer-events: auto;
  }

  .tool-btn {
    background: transparent;
    border: none;
    color: $text-secondary;
    height: 30px;
    width: 30px;
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 0.12s ease, background-color 0.12s ease;
    user-select: none;

    // 覆盖浏览器默认的粗黑 focus 描边，键盘导航时仅保留一条极细提示线
    &:focus {
      outline: none;
    }

    &:focus-visible {
      outline: 1px solid $accent-border;
      outline-offset: 2px;
    }

    &:hover {
      background: $bg-surface-hover;
      color: $text-main;
    }

    &.scale-indicator {
      font-family: $font-mono;
      font-size: 0.72rem;
      // 固定宽度 + 等宽数字：百分比位数变化时不会推着整条工具栏左右抖动
      width: 52px;
      min-width: 52px;
      padding: 0 4px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: $accent-primary;
    }
  }

  .tool-divider {
    width: 1px;
    height: 14px;
    background: $border-strong;
    margin: 0 2px;
  }
}


@media (max-width: 860px) {
  .lightbox-carousel-controls {
    top: 12px;
    left: 12px;
  }

  .viewer-side-nav {
    width: 36px;
    height: 36px;
    opacity: 1;
    pointer-events: auto;

    &.is-prev {
      left: 8px;
    }

    &.is-next {
      right: 8px;
    }
  }

  .image-floating-toolbar {
    opacity: 1;
    transform: translate(-50%, 0);
    pointer-events: auto;
    bottom: 12px;
  }
}
</style>
