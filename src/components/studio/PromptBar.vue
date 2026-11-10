<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import {
  Paperclip,
  ArrowRight,
  X,
  UploadCloud,
  Sparkles,
  Cpu,
  Scan,
  Ratio,
  Gem,
  FileImage,
  Blend,
  Scaling,
  Images,
  ShieldCheck,
  Brain,
  Film,
  Timer,
  FileArchive
} from '@lucide/vue';
import {
  DEFAULT_IMAGE_MODEL_ID,
  type ModelComplexity,
  type ModelFormat,
  type ModelModeration,
  type ModelQuality,
  type ResolutionTier
} from '@/types/model';
import { getModelFormatOptions } from '@/core/models/settings';
import { parseSizeString } from '@/utils/imageSize';
import type { TaskReferenceImage } from '@/types/task';
import { useModelStore } from '@/stores/modelStore';
import { useConfigStore } from '@/stores/configStore';
import { usePromptOptimizer } from '@/composables/usePromptOptimizer';
import { UiSelect, UiSizeInput, UiStepper } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import {
  formatPromptBatchCountTip,
  splitPromptBatches
} from '@/utils/promptBatches';

const props = defineProps<{
  prompt: string;
  resolution: ResolutionTier;
  aspectRatio: string;
  sizeWidth: number | null;
  sizeHeight: number | null;
  quality: ModelQuality;
  format: ModelFormat;
  transparent: boolean;
  moderation?: ModelModeration;
  complexity?: ModelComplexity;
  outputCompression?: number;
  frameCount?: number;
  frameDurationMs?: number;
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
  (e: 'update:moderation', val: ModelModeration): void;
  (e: 'update:complexity', val: ModelComplexity): void;
  (e: 'update:outputCompression', val: number | undefined): void;
  (e: 'update:frameCount', val: number): void;
  (e: 'update:frameDurationMs', val: number): void;
  (e: 'update:count', val: number): void;
  (e: 'addImages', files: FileList | File[]): void;
  (e: 'removeImage', id: string): void;
  (e: 'clearImages'): void;
  (e: 'previewImage', img: TaskReferenceImage, all: TaskReferenceImage[]): void;
  (e: 'generate'): void;
  (e: 'cancel'): void;
  (e: 'openConfigOptimizer'): void;
  (e: 'showToast', message: string, type?: 'success' | 'error' | 'info'): void;
}>();

const modelStore = useModelStore();
const configStore = useConfigStore();
const activeModel = computed(() => modelStore.activeModel);

const modelSelectOptions = computed<SelectOption[]>(() => {
  const ids = [...modelStore.availableModels];
  const current = modelStore.activeModelId || DEFAULT_IMAGE_MODEL_ID;
  if (!ids.includes(current)) {
    ids.unshift(current);
  }
  if (ids.length === 0) {
    ids.push(DEFAULT_IMAGE_MODEL_ID);
  }

  const options: SelectOption[] = ids.map((id) => {
    const profile = modelStore.getModelProfile(id);
    const verification = profile.verification;
    return {
      label: profile.name,
      value: id,
      tip: verification ? [`核实日期：${verification.checkedAt}`, ...verification.notes].join('\n') : profile.description
    };
  });

  if (modelStore.isFetchingModels && modelStore.availableModels.length <= 1) {
    options.push({ label: '正在获取模型...', value: '__loading', disabled: true });
  }

  return options;
});

function handleModelChange(val: unknown) {
  const id = String(val ?? '').trim();
  if (!id || id === '__loading') return;
  modelStore.setActiveModel(id);
}

function handleModelSelectOpen() {
  if (!configStore.isConfigured) return;
  void modelStore.refreshAvailableModels({ adjustSelection: false });
}

const {
  isOptimizing,
  tooltip: optimizerTooltip,
  optimize: handleOptimizePrompt,
  undo: handleUndoOptimization,
  redo: handleRedoOptimization,
  reset: resetOptimization
} = usePromptOptimizer({
  getPrompt: () => props.prompt,
  setPrompt: (prompt) => emit('update:prompt', prompt),
  getConfig: () => configStore.optimizerConfig,
  isConfigured: () => configStore.isOptimizerConfigured,
  onMessage: (message, type) => emit('showToast', message, type),
  onRestored: () => {
    void nextTick(() => {
      syncTextareaHeight();
      textareaRef.value?.focus();
    });
  }
});

const promptBatches = computed(() => splitPromptBatches(props.prompt));
const isBatchPromptMode = computed(() => promptBatches.value.length > 1);
const countLabel = computed(() => (isBatchPromptMode.value ? '批量' : '数量'));
const countTip = computed(() => {
  if (!isBatchPromptMode.value) return '';
  return formatPromptBatchCountTip(promptBatches.value.length, props.count);
});

function handleGenerateClick() {
  if (!props.prompt.trim()) return;
  resetOptimization();
  emit('generate');
}

const backgroundOptions = [
  { label: '默认', value: false },
  { label: '透明', value: true }
];

const formatOptions = computed(() => getModelFormatOptions(
  activeModel.value, props.referenceImages.length > 0 ? 'i2i' : 't2i', props.transparent
));
const sizeOptions = computed(() => [
  ...(activeModel.value.defaultParams.size === 'auto' ? [{ label: '自动', value: 'auto' }] : []),
  ...activeModel.value.recommendedSizes.map((value) => ({ label: value.replace('x', '×'), value }))
]);

function handleTransparentChange(val: unknown) {
  const enabled = Boolean(val);
  emit('update:transparent', enabled);
  if (enabled) {
    const firstFormat = getModelFormatOptions(activeModel.value, props.referenceImages.length > 0 ? 'i2i' : 't2i', true)[0];
    if (firstFormat) emit('update:format', firstFormat.value);
  }
}

function handlePresetSizeChange(val: unknown) {
  const size = parseSizeString(String(val));
  emit('update:sizeWidth', size?.width ?? null);
  emit('update:sizeHeight', size?.height ?? null);
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

function addImageFiles(files: FileList | File[]) {
  if (!activeModel.value.supportedModes.includes('i2i')) {
    emit('showToast', '当前模型不支持参考图编辑', 'info');
    return;
  }
  emit('addImages', files);
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    addImageFiles(target.files);
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
      addImageFiles(imageFiles);
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
      addImageFiles(imageFiles);
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.isComposing) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleGenerateClick();
    return;
  }

  const isZ = e.key === 'z' || e.key === 'Z';
  const isY = e.key === 'y' || e.key === 'Y';

  // Ctrl+Z 撤销优化恢复原词
  if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) {
    if (handleUndoOptimization()) {
      e.preventDefault();
      return;
    }
  }

  // Ctrl+Shift+Z 或 Ctrl+Y 重做优化
  if (((e.ctrlKey || e.metaKey) && isZ && e.shiftKey) || ((e.ctrlKey || e.metaKey) && isY && !e.shiftKey)) {
    if (handleRedoOptimization()) {
      e.preventDefault();
      return;
    }
  }
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.isComposing) return;

  const activeEl = document.activeElement;
  if (
    activeEl &&
    activeEl !== textareaRef.value &&
    (activeEl instanceof HTMLElement && activeEl.isContentEditable || activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'SELECT' ||
      (activeEl.tagName === 'TEXTAREA' && activeEl !== textareaRef.value))
  ) {
    return;
  }

  const isZ = e.key === 'z' || e.key === 'Z';
  const isY = e.key === 'y' || e.key === 'Y';

  // 全局 Ctrl+Z 支持优化后立即回退
  if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) {
    if (handleUndoOptimization()) {
      e.preventDefault();
    }
  } else if (((e.ctrlKey || e.metaKey) && isZ && e.shiftKey) || ((e.ctrlKey || e.metaKey) && isY && !e.shiftKey)) {
    if (handleRedoOptimization()) {
      e.preventDefault();
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

watch(
  () => props.isGenerating,
  (generating) => {
    if (generating) resetOptimization();
  }
);

watch(
  () => [configStore.effectiveBaseUrl, configStore.effectiveApiKey] as const,
  ([url, key]) => {
    if (url && key) {
      void modelStore.refreshAvailableModels({ adjustSelection: true });
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('paste', handlePaste);
  window.addEventListener('resize', syncTextareaHeight);
  window.addEventListener('keydown', handleGlobalKeyDown);
  syncTextareaHeight();
});

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste);
  window.removeEventListener('resize', syncTextareaHeight);
  window.removeEventListener('keydown', handleGlobalKeyDown);
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
          data-tip="点击预览大图"
          @click="emit('previewImage', img, referenceImages)"
        >
          <img :src="img.previewUrl" :alt="'Ref ' + (idx + 1)" />
          <button class="ref-delete-btn" data-tip="移除此图" @click.stop="emit('removeImage', img.id)">
            <X :size="10" />
          </button>
        </div>
      </div>

      <!-- 提示词输入区 -->
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          :value="prompt"
          :rows="TEXTAREA_MIN_ROWS"
          placeholder="描述想生成的画面，或拖入参考图…（两个空行可分批生成）"
          aria-label="画面描述"
          aria-description="支持粘贴或拖入参考图；Ctrl+Enter 生成；连续两个空行分隔可分批生成。"
          @input="handlePromptInput"
          @keydown="handleKeyDown"
        ></textarea>
        
        <button 
          v-if="prompt" 
          class="clear-text-btn" 
          data-tip="清空文字"
          type="button"
          aria-label="清空提示词"
          @click="emit('update:prompt', '')"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- 底部参数与操作栏 -->
      <div class="toolbar">
        <div class="params-group">
          <!-- 生图模型 -->
          <UiSelect
            :model-value="modelStore.activeModelId"
            label="模型"
            :icon="Cpu"
            :options="modelSelectOptions"
            :max-width="150"
            placement="top"
            variant="pill"
            @update:model-value="handleModelChange"
            @open="handleModelSelectOpen"
          />

          <!-- 分辨率 -->
          <UiSelect
            v-if="activeModel.resolutionOptions.length > 0"
            :model-value="resolution"
            label="分辨率"
            :icon="Scan"
            :options="activeModel.resolutionOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:resolution', $event as ResolutionTier)"
          />

          <!-- 比例 -->
          <UiSelect
            v-if="activeModel.aspectRatioOptions.length > 0"
            :model-value="aspectRatio"
            label="比例"
            :icon="Ratio"
            :options="activeModel.aspectRatioOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:aspectRatio', String($event))"
          />

          <!-- 具体宽高 -->
          <UiSizeInput
            v-if="activeModel.supportsCustomSize"
            :width="sizeWidth"
            :height="sizeHeight"
            :icon="Scaling"
            @update:width="emit('update:sizeWidth', $event)"
            @update:height="emit('update:sizeHeight', $event)"
            @clear="emit('sizeAuto')"
            @materialize="emit('sizeMaterialize')"
          />

          <UiSelect
            v-else-if="sizeOptions.length > 0"
            :model-value="sizeWidth && sizeHeight ? `${sizeWidth}x${sizeHeight}` : 'auto'"
            label="尺寸"
            :icon="Scaling"
            :options="sizeOptions"
            placement="top"
            variant="pill"
            @update:model-value="handlePresetSizeChange"
          />

          <!-- 质量选择 -->
          <UiSelect
            v-if="activeModel.qualityOptions.length > 0"
            :model-value="quality"
            label="质量"
            :icon="Gem"
            :options="activeModel.qualityOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:quality', $event as ModelQuality)"
          />

          <UiSelect
            v-if="activeModel.complexityOptions.length > 0"
            :model-value="complexity || activeModel.defaultParams.complexity || 'high'"
            label="复杂度"
            :icon="Brain"
            :options="activeModel.complexityOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:complexity', $event as ModelComplexity)"
          />

          <!-- 格式选择 -->
          <UiSelect
            :model-value="format"
            label="格式"
            :icon="FileImage"
            :options="formatOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:format', $event as ModelFormat)"
          />

          <UiSelect
            v-if="activeModel.compression.formats.includes(format)"
            :model-value="outputCompression ?? 'auto'"
            label="压缩质量"
            :icon="FileArchive"
            :options="activeModel.compression.options"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:outputCompression', $event === 'auto' ? undefined : Number($event))"
          />

          <UiStepper
            v-if="format === 'gif' && activeModel.animation"
            :model-value="frameCount ?? activeModel.defaultParams.frameCount ?? activeModel.animation.frameCount.min"
            label="帧数"
            :icon="Film"
            :min="activeModel.animation.frameCount.min"
            :max="activeModel.animation.frameCount.max"
            :step="activeModel.animation.frameCount.step"
            @update:model-value="emit('update:frameCount', $event)"
          />
          <UiStepper
            v-if="format === 'gif' && activeModel.animation"
            :model-value="frameDurationMs ?? activeModel.defaultParams.frameDurationMs ?? activeModel.animation.frameDurationMs.min"
            label="帧时长"
            :tip="`每帧时长（毫秒），滚轮步进 ${activeModel.animation.frameDurationMs.step}ms`"
            :icon="Timer"
            :min="activeModel.animation.frameDurationMs.min"
            :max="activeModel.animation.frameDurationMs.max"
            :step="activeModel.animation.frameDurationMs.step"
            @update:model-value="emit('update:frameDurationMs', $event)"
          />

          <!-- 背景 (按模型能力条件渲染) -->
          <UiSelect
            v-if="activeModel.supportsTransparent"
            :model-value="transparent"
            label="背景"
            :icon="Blend"
            :options="backgroundOptions"
            placement="top"
            variant="pill"
            @update:model-value="handleTransparentChange"
          />

          <!-- 审核 -->
          <UiSelect
            v-if="activeModel.moderationOptions.length > 0"
            :model-value="moderation || 'low'"
            label="审核"
            :icon="ShieldCheck"
            :options="activeModel.moderationOptions"
            placement="top"
            variant="pill"
            @update:model-value="emit('update:moderation', $event as ModelModeration)"
          />

          <!-- 数量步进器：连续两个空行分隔多段提示词时切换为每批张数 -->
          <UiStepper
            :model-value="count"
            :label="countLabel"
            :tip="countTip"
            :icon="Images"
            :min="1"
            :max="activeModel.maxBatchCount"
            variant="pill"
            @update:model-value="emit('update:count', $event)"
          />
        </div>

        <!-- 右侧动作按钮 -->
        <div class="actions-group">
          <!-- AI 提示词智能优化按钮 (默认展示，未配置或输入为空时禁用) -->
          <button 
            type="button" 
            class="btn-magic" 
            :class="{ 'is-optimizing': isOptimizing }"
            :disabled="isOptimizing || !configStore.isOptimizerConfigured || !prompt.trim()"
            :data-tip="optimizerTooltip"
            :aria-label="isOptimizing ? '优化中...' : 'AI 优化'"
            @click="handleOptimizePrompt"
          >
            <Sparkles :size="15" :class="{ 'magic-sparkle-active': isOptimizing }" />
          </button>

          <input 
            ref="fileInputRef" 
            type="file" 
            multiple 
            :accept="activeModel.referenceImageConstraints?.mimeTypes.join(',') || 'image/*'"
            class="hidden-file-input" 
            @change="handleFileChange"
          />

          <button 
            type="button" 
            class="btn-clip" 
            :class="{ 'has-images': referenceImages.length > 0 }"
            :disabled="!activeModel.supportedModes.includes('i2i')"
            :data-tip="activeModel.supportedModes.includes('i2i') ? '添加参考图片 (支持多图拖拽/剪贴板粘贴)' : '当前模型不支持参考图编辑'"
            aria-label="添加参考图"
            @click="triggerFileInput"
          >
            <Paperclip :size="15" />
          </button>

          <!-- 生成/发送按钮 -->
          <button 
            class="btn-send"
            type="button"
            aria-label="生成图片"
            :disabled="!prompt.trim()" 
            :data-tip="isGenerating ? `发起新生成 (当前有 ${elapsedTime} 绘制中)` : '立即生成 (Ctrl+Enter)'"
            @click="handleGenerateClick"
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
  background: $bg-glass;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid $border-color;
  border-radius: 20px;
  box-shadow: $shadow-float;
  padding: 14px 16px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:focus-within {
    border-color: $accent-border;
    box-shadow: 0 24px 60px -12px $accent-glow, 0 0 0 1px $accent-soft;
  }

  &.is-dragging {
    border-color: $accent-primary;
    border-style: dashed;
    box-shadow: 0 0 0 4px $accent-soft;
  }
}

.drag-drop-overlay {
  position: absolute;
  inset: 0;
  background: $accent-subtle;
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
  border-bottom: 1px dashed $border-color;
  overflow-x: auto;
}

.ref-thumbnail {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: $radius-md;
  overflow: hidden;
  border: 1px solid $border-color;
  box-shadow: $shadow-xs;
  flex-shrink: 0;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: $shadow-sm;

    .ref-delete-btn {
      transform: scale(calc(1 / 1.05));
    }
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ref-delete-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: $danger;
    border: none;
    color: $text-on-fill;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.8;
    transform-origin: center;
    transition: opacity 0.15s ease, transform 0.15s ease;

    &:hover {
      opacity: 1;
    }
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
      color: $text-placeholder;
      font-size: 0.875rem;
    }
  }

  .clear-text-btn {
    position: absolute;
    top: 0;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    background: none;
    border: none;
    color: $text-dim;
    cursor: pointer;
    border-radius: 50%;
    line-height: 0;
    flex-shrink: 0;

    &:hover {
      background: $bg-surface-hover;
      color: $text-main;
    }

    :deep(svg) {
      display: block;
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
  border-top: 1px solid $border-light;
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

.btn-magic {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid $accent-border;
  background: $accent-subtle;
  color: $accent-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  flex-shrink: 0;
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;

  &:hover:not(:disabled) {
    border-color: $accent-primary;
    background: $accent-soft;
    color: $accent-primary;
    box-shadow: 0 2px 10px $accent-glow;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.is-optimizing {
    background: $accent-subtle;
    color: $accent-primary;
    border-color: $accent-border;
    animation: magic-btn-glow 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    transform-origin: center center;
    will-change: transform, box-shadow;
    cursor: wait;
  }
}

.magic-sparkle-active {
  animation: magic-sparkle-glow 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  transform-origin: center center;
  will-change: transform, filter, opacity;
}

@keyframes magic-sparkle-glow {
  0%, 100% {
    transform: scale(0.9);
    opacity: 0.65;
    filter: drop-shadow(0 0 2px $accent-glow);
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
    filter: drop-shadow(0 0 6px $accent-glow) drop-shadow(0 0 12px $accent-glow);
  }
}

@keyframes magic-btn-glow {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 6px $accent-glow;
  }
  50% {
    transform: scale(1.06);
    box-shadow: 0 4px 12px $accent-glow;
  }
}

.hidden-file-input {
  display: none;
}

.btn-clip {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid $border-color;
  background: $bg-surface;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: $accent-border;
    color: $accent-primary;
    box-shadow: 0 2px 6px $accent-soft;
  }

  &.has-images {
    background: $accent-subtle;
    border-color: $accent-border;
    color: $accent-primary;
  }
}

.btn-cancel {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid $danger-border;
  background: $danger-subtle;
  color: $danger;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: $danger-soft;
    transform: scale(1.05);
  }
}

.btn-send {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: $accent-gradient;
  color: $text-on-fill;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-glow;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, $accent-hover 0%, $accent-primary 100%);
    transform: scale(1.04);
    box-shadow: $shadow-glow;
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
