<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import { UiImageViewer } from '@/components/ui';
import { useConfigStore } from '@/stores/configStore';
import type { ReferencePreviewItem } from '@/types/task';

const props = defineProps<{
  item: ReferencePreviewItem | null;
  images: ReferencePreviewItem[];
}>();
const emit = defineEmits<{
  (e: 'update:item', item: ReferencePreviewItem): void;
  (e: 'close'): void;
}>();

const configStore = useConfigStore();
const dialogRef = ref<HTMLElement | null>(null);
const viewerRef = ref<InstanceType<typeof UiImageViewer> | null>(null);
const isFullscreen = ref(false);
const imageList = computed(() => props.images.length > 0 ? props.images : props.item ? [props.item] : []);
const currentIndex = computed(() => Math.max(0, imageList.value.findIndex((item) => item.id === props.item?.id)));
let nativeOwner: Element | null = null;
let nativeRequest: Promise<void> | null = null;
let previousFocus: HTMLElement | null = null;
let previousOverflow: string | null = null;
let disposed = false;

async function releaseNativeFullscreen(): Promise<void> {
  const owner = nativeOwner;
  nativeOwner = null;
  if (owner && document.fullscreenElement === owner) {
    try {
      await document.exitFullscreen();
    } catch {
      // 浏览器可能已经通过自身操作退出全屏。
    }
  }
}

async function changeFullscreen(enabled: boolean): Promise<void> {
  isFullscreen.value = enabled;
  if (!enabled) {
    await releaseNativeFullscreen();
    return;
  }
  if (configStore.previewFullscreenMode !== 'native' || !document.fullscreenEnabled || document.fullscreenElement || nativeRequest) return;
  const target = document.documentElement;
  try {
    nativeRequest = target.requestFullscreen();
    await nativeRequest;
    if (document.fullscreenElement === target) nativeOwner = target;
    if (disposed || !props.item || !isFullscreen.value || configStore.previewFullscreenMode !== 'native') {
      await releaseNativeFullscreen();
    }
  } catch {
    // 不支持或拒绝原生全屏时仍保留页面内全屏。
  } finally {
    nativeRequest = null;
  }
}

function handleNativeFullscreenChange(): void {
  if (nativeOwner && document.fullscreenElement !== nativeOwner) {
    nativeOwner = null;
    isFullscreen.value = false;
  }
}

function selectImage(index: number): void {
  const item = imageList.value[index];
  if (item) emit('update:item', item);
}

function close(): void {
  if (isFullscreen.value) {
    void changeFullscreen(false);
    return;
  }
  emit('close');
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!props.item || event.defaultPrevented || event.isComposing) return;
  if (event.key === 'Tab') {
    const buttons = [...(dialogRef.value?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialogRef.value?.contains(active))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (active === last || !dialogRef.value?.contains(active))) {
      event.preventDefault();
      first?.focus();
    }
    return;
  }
  if (isTypingTarget(event.target)) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopImmediatePropagation();
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    if (imageList.value.length > 1) selectImage((currentIndex.value + direction + imageList.value.length) % imageList.value.length);
  }
}

function releaseDialog(): void {
  isFullscreen.value = false;
  void releaseNativeFullscreen();
  if (previousOverflow !== null) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = null;
  }
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}

watch(() => props.item !== null, async (open) => {
  if (!open) {
    releaseDialog();
    return;
  }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  await nextTick();
  if (props.item && !disposed) dialogRef.value?.querySelector<HTMLElement>('.modal-close-btn')?.focus();
}, { immediate: true });
watch(() => props.item?.id, () => {
  viewerRef.value?.resetTransform();
});
watch(() => configStore.previewFullscreenMode, () => {
  if (isFullscreen.value) {
    if (configStore.previewFullscreenMode === 'native') void changeFullscreen(true);
    else void releaseNativeFullscreen();
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
});
onUnmounted(() => {
  disposed = true;
  window.removeEventListener('keydown', handleKeyDown, true);
  document.removeEventListener('fullscreenchange', handleNativeFullscreenChange);
  releaseDialog();
});
</script>

<template>
  <div
    v-if="item"
    class="modal-backdrop ref-preview-backdrop"
    :class="{ 'is-fullscreen': isFullscreen }"
    @click.self="close"
  >
    <div ref="dialogRef" class="modal-card ref-preview-modal-card" role="dialog" aria-modal="true" aria-label="参考图预览">
      <button
        v-if="!isFullscreen"
        type="button"
        class="modal-close-btn"
        data-tip="关闭 (Esc)"
        aria-label="关闭参考图预览"
        @click="close"
      >
        <X :size="18" />
      </button>
      <div class="modal-body ref-preview-body">
        <UiImageViewer
          ref="viewerRef"
          :src="item.previewUrl"
          :alt="'参考图 ' + (currentIndex + 1)"
          :images="imageList.map((image, index) => ({ id: image.id, url: image.previewUrl, alt: '参考图 ' + (index + 1) }))"
          :current-index="currentIndex"
          :is-fullscreen="isFullscreen"
          @update:is-fullscreen="changeFullscreen"
          @update:current-index="selectImage"
          @close="close"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ref-preview-backdrop {
  position: fixed;
  inset: 0;
  background: $overlay;
  backdrop-filter: blur(8px);
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

    .ref-preview-modal-card {
      max-width: 100vw;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      border: none;
      box-shadow: none;
      background: $stage;
    }
  }
}

.ref-preview-modal-card {
  max-width: 960px;
  width: 90vw;
  height: 82vh;
  min-height: min(480px, 90vh);
  max-height: 90vh;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  box-shadow: $shadow-float;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

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
      background: $bg-surface-hover;
      color: $text-main;
    }
  }
}

.ref-preview-body {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
