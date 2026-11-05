<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MediaAsset } from '@/types/asset';
import UiImageViewer from '@/components/ui/UiImageViewer.vue';

const props = withDefaults(defineProps<{
  activeItem: MediaAsset;
  batchAssets: MediaAsset[];
  currentIndex: number;
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotation?: number;
  isDragging?: boolean;
  isFullscreen?: boolean;
}>(), {
  isFullscreen: false
});

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
  (e: 'resetScale'): void;
  (e: 'resetView'): void;
  (e: 'rotateCw'): void;
  (e: 'rotateCcw'): void;
  (e: 'toggleFullscreen'): void;
  (e: 'wheel', event: WheelEvent): void;
  (e: 'pointerdown', event: PointerEvent): void;
  (e: 'mousedown', event: MouseEvent): void;
  (e: 'dblclick', event: MouseEvent): void;
}>();

const viewerRef = ref<InstanceType<typeof UiImageViewer> | null>(null);
const containerRef = computed<HTMLElement | null>(() => viewerRef.value?.containerRef || null);

defineExpose({
  containerRef
});
</script>

<template>
  <UiImageViewer
    ref="viewerRef"
    :src="activeItem?.url"
    :alt="activeItem?.prompt"
    :status="activeItem?.status"
    :error-message="activeItem?.errorMessage"
    :images="batchAssets.map((a, idx) => ({ id: a.id ?? idx, url: a.url, alt: a.prompt, status: a.status, errorMessage: a.errorMessage }))"
    :current-index="currentIndex"
    :scale="scale"
    :translate-x="translateX"
    :translate-y="translateY"
    :rotation="rotation"
    :is-dragging="isDragging"
    :is-fullscreen="isFullscreen"
    @prev="emit('prev')"
    @next="emit('next')"
    @zoom-in="emit('zoomIn')"
    @zoom-out="emit('zoomOut')"
    @reset-scale="emit('resetScale')"
    @reset-view="emit('resetView')"
    @rotate-cw="emit('rotateCw')"
    @rotate-ccw="emit('rotateCcw')"
    @toggle-fullscreen="emit('toggleFullscreen')"
    @exit-fullscreen="emit('toggleFullscreen')"
    @wheel="emit('wheel', $event)"
    @pointerdown="emit('pointerdown', $event)"
    @mousedown="emit('mousedown', $event)"
    @dblclick="emit('dblclick', $event)"
  />
</template>
