<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { Paperclip, ArrowRight, X, Trash2, Loader2, UploadCloud, Square } from 'lucide-vue-next';
import {
  TRANSPARENT_DEFAULT_FORMAT,
  supportsAlphaChannel,
  type ModelFormat,
  type ModelQuality,
  type ResolutionTier
} from '@/types/model';
import type { TaskReferenceImage } from '@/types/task';
import { useModelStore } from '@/stores/modelStore';
import { UiSelect, UiSizeInput, UiStepper } from '@/components/ui';

const props = defineProps<{
  prompt: string;
  resolution: ResolutionTier;
  aspectRatio: string;
  sizeWidth: number | null;
  sizeHeight: number | null;
  quality: ModelQuality;
  format: ModelFormat;
  transparent: boolean;
  count: number;
  referenceImages: TaskReferenceImage[];
  isGenerating: boolean;
  elapsedTime: string;
  progress?: number;
}>();

const emit = defineEmits<{
  (e: 'update:prompt', val: string): void;
  (e: 'update:resolution', val: ResolutionTier): void;
  (e: 'update:aspectRatio', val: string): void;
  (e: 'update:sizeWidth', val: number | null): void;
  (e: 'update:sizeHeight', val: number | null): void;
  (e: 'sizeAuto'): void;
  (e: 'sizeMaterialize'): void;
  (e: 'update:quality', val: ModelQuality): void;
  (e: 'update:format', val: ModelFormat): void;
  (e: 'update:transparent', val: boolean): void;
  (e: 'update:count', val: number): void;
  (e: 'addImages', files: FileList | File[]): void;
  (e: 'removeImage', id: string): void;
  (e: 'clearImages'): void;
  (e: 'generate'): void;
  (e: 'cancel'): void;
}>();

const modelStore = useModelStore();
const activeModel = computed(() => modelStore.activeModel);

const transparentOptions = [
  { label: '关闭', value: false },
  { label: '开启', value: true }
];

const formatOptions = computed(() => {
  const options = activeModel.value.formatOptions;
  if (!props.transparent) return options;
  return options.filter((item) => supportsAlphaChannel(item.value));
});

function handleTransparentChange(val: unknown) {
  const enabled = Boolean(val);
  emit('update:transparent', enabled);
  if (enabled) {
    emit('update:format', TRANSPARENT_DEFAULT_FORMAT);
  }
}

const TEXTAREA_MIN_ROWS = 3;
const TEXTAREA_MAX_ROWS = 10;

const fileInputRef = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isDragging = ref(false);

function syncTextareaHeight() {
  const el = textareaRef.value;
  if (!el) return;

  const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;

  const minHeight = lineHeight * TEXTAREA_MIN_ROWS;
  const maxHeight = lineHeight * TEXTAREA_MAX_ROWS;

  el.style.height = 'auto';
  el.style.height = `${Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)}px`;
}

function handlePromptInput(e: Event) {
  emit('update:prompt', (e.target as HTMLTextAreaElement).value);
  syncTextareaHeight();
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    emit('addImages', target.files);
    target.value = '';
  }
}

function handlePaste(e: ClipboardEvent) {
  if (e.clipboardData && e.clipboardData.files.length > 0) {
    const imageFiles: File[] = [];
    for (let i = 0; i < e.clipboardData.files.length; i++) {
      const file = e.clipboardData.files[i];
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      emit('addImages', imageFiles);
    }
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragging.value = true;
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    const imageFiles: File[] = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      if (file.type.startsWith('image/')) {
        imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      emit('addImages', imageFiles);
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (props.prompt.trim()) {
      emit('generate');
    }
  }
}

watch(
  () => props.prompt,
  async () => {
    await nextTick();
    syncTextareaHeight();
  }
);

onMounted(() => {
  window.addEventListener('paste', handlePaste);
  window.addEventListener('resize', syncTextareaHeight);
  syncTextareaHeight();
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  window.removeEventListener('resize', syncTextareaHeight);
});
</script>

<template>
  <div class="prompt-bar-container">
    <div 
      class="prompt-card" 
      :class="{ 'is-dragging': isDragging, 'is-generating': isGenerating }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 拖拽提示遮罩 -->
      <div v-if="isDragging" class="drag-drop-overlay">
        <UploadCloud :size="28" />
        <span>释放图片以添加为参考图</span>
      </div>

      <!-- 顶部参考图片预览列表 -->
      <div v-if="referenceImages.length > 0" class="ref-images-bar">
        <div 
          v-for="(img, idx) in referenceImages" 
          :key="img.id" 
          class="ref-thumbnail"
        >
          <img :src="img.previewUrl" :alt="'Ref ' + (idx + 1)" />
          <span class="ref-index">{{ idx + 1 }}</span>
          <button class="ref-delete-btn" data-tip="移除此图" @click="emit('removeImage', img.id)">
            <X :size="10" />
          </button>
        </div>

        <button class="ref-clear-all" data-tip="清空全部参考图" @click="emit('clearImages')">
          <Trash2 :size="13" />
          <span>清空</span>
        </button>
      </div>

      <!-- 提示词输入区 -->
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          :value="prompt"
          :rows="TEXTAREA_MIN_ROWS"
          placeholder="输入画面描述或图生图指令... (支持直接粘贴或拖入参考图，Ctrl + Enter 快速生成)"
          @input="handlePromptInput"
          @keydown="handleKeyDown"
        ></textarea>
        
        <button 
          v-if="prompt" 
          class="clear-text-btn" 
          data-tip="清空文字"
          @click="emit('update:prompt', '')"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- 底部参数与操作栏 -->
      <div class="toolbar">
        <div class="params-group">
          <!-- 分辨率 -->
          <UiSelect
            :model-value="resolution"
            label="分辨率"
            :options="activeModel.resolutionOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:resolution', $event as ResolutionTier)"
          />

          <!-- 比例 -->
          <UiSelect
            :model-value="aspectRatio"
            label="比例"
            :options="activeModel.aspectRatioOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:aspectRatio', String($event))"
          />

          <!-- 具体宽高 -->
          <UiSizeInput
            :width="sizeWidth"
            :height="sizeHeight"
            @update:width="emit('update:sizeWidth', $event)"
            @update:height="emit('update:sizeHeight', $event)"
            @clear="emit('sizeAuto')"
            @materialize="emit('sizeMaterialize')"
          />

          <!-- 质量选择 -->
          <UiSelect
            :model-value="quality"
            label="质量"
            :options="activeModel.qualityOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:quality', $event as ModelQuality)"
          />

          <!-- 格式选择 -->
          <UiSelect
            :model-value="format"
            label="格式"
            :options="formatOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:format', $event as ModelFormat)"
          />

          <!-- 透明背景 (按模型能力条件渲染) -->
          <UiSelect
            v-if="activeModel.supportsTransparent"
            :model-value="transparent"
            label="透明背景"
            :options="transparentOptions"
            placement="top"
            variant="pill"
            @update:model-value="handleTransparentChange"
          />

          <!-- 数量步进器 -->
          <UiStepper
            :model-value="count"
            label="数量"
            :min="1"
            :max="activeModel.maxBatchCount || 4"
            variant="pill"
            @update:model-value="emit('update:count', $event)"
          />
        </div>

        <!-- 右侧动作按钮 -->
        <div class="actions-group">
          <input 
            ref="fileInputRef" 
            type="file" 
            multiple 
            accept="image/*" 
            class="hidden-file-input" 
            @change="handleFileChange"
          />

          <button 
            type="button" 
            class="btn-clip" 
            :class="{ 'has-images': referenceImages.length > 0 }"
            data-tip="添加参考图片 (支持多图拖拽/剪贴板粘贴)"
            @click="triggerFileInput"
          >
            <Paperclip :size="15" />
          </button>

          <!-- 生成/发送按钮 -->
          <button 
            class="btn-send" 
            :disabled="!prompt.trim()" 
            :data-tip="isGenerating ? `发起新生成 (当前有 ${elapsedTime} 绘制中)` : '立即生成 (Ctrl+Enter)'"
            @click="emit('generate')"
          >
            <ArrowRight :size="17" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.prompt-bar-container {
  width: 100%;
  position: sticky;
  bottom: 20px;
  z-index: 100;
  display: flex;
  justify-content: center;
}

.prompt-card {
  position: relative;
  width: 100%;
  max-width: 1120px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.1), 0 2px 8px -2px rgba(15, 23, 42, 0.04);
  padding: 14px 16px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus-within {
    border-color: #93c5fd;
    box-shadow: 0 24px 60px -12px rgba(37, 99, 235, 0.14), 0 0 0 1px rgba(37, 99, 235, 0.2);
  }

  &.is-dragging {
    border-color: $accent-primary;
    border-style: dashed;
    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
  }
}

.drag-drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(239, 246, 255, 0.95);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  z-index: 10;
  color: $accent-primary;
  font-weight: 600;
  font-size: 0.9rem;
  pointer-events: none;
}

.ref-images-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed rgba(226, 232, 240, 0.9);
  overflow-x: auto;
}

.ref-thumbnail {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: $shadow-xs;
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ref-index {
    position: absolute;
    bottom: 2px;
    left: 2px;
    background: $accent-primary;
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 4px;
  }

  .ref-delete-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.9);
    border: none;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 1;
    }
  }
}

.ref-clear-all {
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
  color: $text-muted;
  padding: 4px 10px;
  border-radius: $radius-sm;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  height: 32px;
  transition: all 0.15s ease;

  &:hover {
    background: $danger-subtle;
    color: $danger;
    border-color: #fca5a5;
  }
}

.input-wrapper {
  position: relative;
  display: flex;

  textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-family: $font-main;
    font-size: 0.92rem;
    color: $text-main;
    line-height: 1.55;
    min-height: calc(0.92rem * 1.55 * 3);
    max-height: calc(0.92rem * 1.55 * 10);
    overflow-y: auto;
    resize: none;
    padding-right: 28px;

    &::placeholder {
      color: $text-dim;
      font-size: 0.875rem;
    }
  }

  .clear-text-btn {
    position: absolute;
    top: 0;
    right: 0;
    background: none;
    border: none;
    color: $text-dim;
    cursor: pointer;
    padding: 4px;
    border-radius: 50%;

    &:hover {
      background: #f1f5f9;
      color: $text-main;
    }
  }
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px solid rgba(241, 245, 249, 0.9);
}

.params-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.hidden-file-input {
  display: none;
}

.btn-clip {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: #ffffff;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: #93c5fd;
    color: $accent-primary;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.1);
    transform: translateY(-0.5px);
  }

  &.has-images {
    background: $accent-subtle;
    border-color: #93c5fd;
    color: $accent-primary;
  }
}

.btn-cancel {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid #fecaca;
  background: $danger-subtle;
  color: $danger;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #fee2e2;
    transform: scale(1.05);
  }
}

.btn-send {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: $accent-gradient;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-glow;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
    transform: translateY(-1px) scale(1.04);
    box-shadow: 0 6px 18px rgba(37, 99, 235, 0.4);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }
}

.spin-icon {
  animation: spin 1s infinite linear;
}
</style>
