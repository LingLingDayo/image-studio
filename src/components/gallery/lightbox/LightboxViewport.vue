<script setup lang="ts">
import type { MediaAsset } from '@/types/asset';
import type { ViewportCanvasState } from '@/composables/useViewportCanvas';
import UiImageViewer from '@/components/ui/UiImageViewer.vue';

withDefaults(defineProps<{
  activeItem: MediaAsset;
  batchAssets: MediaAsset[];
  currentIndex: number;
  standalone?: boolean;
  canNavigate?: boolean;
  showFavorite?: boolean;
  showDownload?: boolean;
  showDelete?: boolean;
  allowContextDelete?: boolean;
  isFullscreen?: boolean;
}>(), {
  standalone: false,
  showFavorite: false,
  showDownload: false,
  showDelete: false,
  allowContextDelete: undefined,
  isFullscreen: false
});

const emit = defineEmits<{
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'toggleFullscreen'): void;
  (e: 'exitFullscreen'): void;
  (e: 'update:isFullscreen', isFullscreen: boolean): void;
  (e: 'update:canvas', state: ViewportCanvasState): void;
  (e: 'toggleFavorite'): void;
  (e: 'download'): void;
  (e: 'delete'): void;
  (e: 'copy'): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();
</script>

<template>
  <UiImageViewer
    :src="activeItem?.url"
    :blob="activeItem?.blob"
    :alt="activeItem?.prompt"
    :status="activeItem?.status"
    :error-message="activeItem?.errorMessage"
    :images="batchAssets.map((a, idx) => ({ id: a.id ?? idx, url: a.url, blob: a.blob, alt: a.prompt, status: a.status, errorMessage: a.errorMessage }))"
    :current-index="currentIndex"
    :standalone="standalone"
    :can-navigate="canNavigate"
    :keyboard-navigation="false"
    :show-favorite="showFavorite"
    :is-favorite="Boolean(activeItem?.isFavorite)"
    :show-download="showDownload"
    :download-disabled="activeItem?.status === 'failed'"
    :show-delete="showDelete"
    :allow-context-delete="allowContextDelete"
    :is-fullscreen="isFullscreen"
    @prev="emit('prev')"
    @next="emit('next')"
    @toggle-fullscreen="emit('toggleFullscreen')"
    @exit-fullscreen="emit('exitFullscreen')"
    @update:is-fullscreen="emit('update:isFullscreen', $event)"
    @update:canvas="(state) => emit('update:canvas', state)"
    @toggle-favorite="emit('toggleFavorite')"
    @download="emit('download')"
    @delete="emit('delete')"
    @copy="emit('copy')"
    @show-toast="(msg, type) => emit('showToast', msg, type)"
  />
</template>
