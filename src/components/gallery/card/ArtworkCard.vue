<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import { 
  RotateCw, 
  Star, 
  CornerUpLeft, 
  Edit3, 
  Trash2, 
  Download,
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Clock
} from '@lucide/vue';
import { downloadRotatedImage, generateAssetFilename } from '@/utils/download';
import { formatQualityLabel, getResolutionDisplay, formatDisplayRatio } from '@/utils/imageSize';
import { getErrorHeadline } from '@/utils/apiError';
import { useConfigStore } from '@/stores/configStore';

const props = defineProps<{
  item?: MediaAsset;
  batch?: ArtworkBatch;
}>();

const emit = defineEmits<{
  (e: 'preview', item: MediaAsset, allAssets: MediaAsset[]): void;
  (e: 'view', item: MediaAsset, allAssets: MediaAsset[]): void;
  (e: 'regenerate', item: MediaAsset): void;
  (e: 'toggleFavorite', id: number): void;
  (e: 'reuse', item: MediaAsset): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'delete', id: number): void;
  (e: 'deleteBatch', batch: ArtworkBatch): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();

// 当前卡片内的图片列表
const assetsList = computed<MediaAsset[]>(() => {
  if (props.batch && props.batch.assets?.length > 0) {
    return props.batch.assets;
  }
  if (props.item) {
    return [props.item];
  }
  return [];
});

const currentAssetIndex = ref(0);

// 当 assets 列表变化时，优先选择首张成功的图片，避免卡片封面展示失败占位
watch(
  () => assetsList.value,
  (list) => {
    if (!list || list.length === 0) {
      currentAssetIndex.value = 0;
      return;
    }
    const current = list[currentAssetIndex.value];
    if (!current || current.status === 'failed') {
      const firstValid = list.findIndex((a) => a.status !== 'failed');
      currentAssetIndex.value = firstValid >= 0 ? firstValid : 0;
    }
  },
  { immediate: true }
);

// 当前正在展示的图片资产
const currentAsset = computed<MediaAsset | null>(() => {
  if (assetsList.value.length === 0) return null;
  return assetsList.value[currentAssetIndex.value] || assetsList.value[0];
});

// 生成时间计算与展示
const itemTimestamp = computed<number>(() => {
  if (props.batch) {
    return props.batch.timestamp || props.batch.assets?.[0]?.timestamp || Date.now();
  }
  if (props.item) {
    return props.item.timestamp || Date.now();
  }
  return Date.now();
});

const simpleTimeText = computed(() => {
  const ts = itemTimestamp.value;
  if (!ts) return '';
  const date = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${month}-${day} ${hours}:${minutes}`;
});

const fullTimeText = computed(() => {
  const ts = itemTimestamp.value;
  if (!ts) return '';
  const date = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
});

// 图片尺寸文字
const dimensionText = computed(() => {
  if (currentAsset.value) {
    if (currentAsset.value.width && currentAsset.value.height) {
      return `${currentAsset.value.width}×${currentAsset.value.height}`;
    }
    if (currentAsset.value.size && currentAsset.value.size !== 'auto') {
      return currentAsset.value.size.replace(/x/i, '×');
    }
    return '1024×1024';
  }
  return '1024×1024';
});

// 比例文字 (如 1:1, 16:9)
const ratioText = computed(() => {
  if (currentAsset.value?.ratio) {
    return formatDisplayRatio(currentAsset.value.ratio);
  }
  if (props.batch?.ratio) {
    return formatDisplayRatio(props.batch.ratio);
  }
  return '1:1';
});

// 分辨率文字 (1K/2K/4K)
const resolutionText = computed(() => {
  const a = currentAsset.value || props.batch;
  return getResolutionDisplay(a || undefined);
});

// 提示词
const promptText = computed(() => {
  if (currentAsset.value) {
    return currentAsset.value.prompt;
  }
  if (props.batch) {
    return props.batch.prompt;
  }
  return '';
});

// 质量中文标签
const qualityChineseText = computed(() => {
  const q = currentAsset.value?.quality || props.batch?.quality;
  return formatQualityLabel(q);
});

const isI2I = computed(() => {
  if (currentAsset.value) {
    return currentAsset.value.type === 'i2i' || (currentAsset.value.referenceImages && currentAsset.value.referenceImages.length > 0);
  }
  if (props.batch) {
    return props.batch.type === 'i2i' || (props.batch.referenceImages && props.batch.referenceImages.length > 0);
  }
  return false;
});

// 多图切换方法
function handlePrevImage(e: Event) {
  e.stopPropagation();
  const total = assetsList.value.length;
  if (total <= 1) return;
  currentAssetIndex.value = (currentAssetIndex.value - 1 + total) % total;
}

function handleNextImage(e: Event) {
  e.stopPropagation();
  const total = assetsList.value.length;
  if (total <= 1) return;
  currentAssetIndex.value = (currentAssetIndex.value + 1) % total;
}


// 点击缩略图：仅进入图片预览（不含右侧详情面板）
function handleImageClick() {
  if (currentAsset.value) {
    emit('preview', currentAsset.value, assetsList.value);
  }
}

// 点击标题：进入作品详情（预览 + 信息面板）
function handleTitleClick() {
  if (currentAsset.value) {
    emit('view', currentAsset.value, assetsList.value);
  }
}

const configStore = useConfigStore();

// 下载单张或批量多张原图
async function handleDownload() {
  const pattern = configStore.downloadFilenamePattern;
  const targetFormat = configStore.downloadImageFormat;

  try {
    if (assetsList.value.length > 1) {
      const list = assetsList.value;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const filename = generateAssetFilename(a, i, 0, { pattern, targetFormat });
        const origExt = (a.format || 'png').replace(/^\./, '');
        const finalExt = targetFormat && targetFormat !== 'auto' ? targetFormat : origExt;
        await downloadRotatedImage(a.url, filename, 0, finalExt, origExt);
        if (i < list.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      emit('showToast', `已开始批量下载全部 ${list.length} 张原图`, 'success');
    } else if (currentAsset.value) {
      const a = currentAsset.value;
      const filename = generateAssetFilename(a, undefined, 0, { pattern, targetFormat });
      const origExt = (a.format || 'png').replace(/^\./, '');
      const finalExt = targetFormat && targetFormat !== 'auto' ? targetFormat : origExt;
      await downloadRotatedImage(a.url, filename, 0, finalExt, origExt);
      emit('showToast', '已开始下载原图', 'success');
    }
  } catch (error) {
    emit('showToast', error instanceof Error ? error.message : '图片下载失败，请重试', 'error');
  }
}
</script>

<template>
  <div v-if="currentAsset" class="gallery-card artwork-card">
    <!-- 左侧图片缩略图区 -->
    <div class="card-image-wrapper" @click="handleImageClick">
      <img 
        v-if="currentAsset.status !== 'failed' && currentAsset.url"
        :src="currentAsset.url" 
        :alt="currentAsset.prompt" 
        loading="lazy" 
      />
      <!-- 失败项占位展示 -->
      <div v-else class="card-failed-placeholder" :data-tip="currentAsset.errorMessage || '生图失败'">
        <AlertCircle :size="20" class="fail-icon" />
        <span class="fail-status-text">{{ getErrorHeadline(currentAsset.errorMessage) }}</span>
      </div>
      
      <!-- 尺寸与多图数量悬浮角标 (仅左上角显示尺寸与数量) -->
      <div class="image-badge-overlay">
        <span class="size-pill">{{ dimensionText }}</span>
        <span v-if="assetsList.length > 1" class="count-pill">共 {{ assetsList.length }} 张</span>
      </div>

      <!-- 多图轮播切换左右按钮 (当多于 1 张时展示，hover 卡片图片时浮现) -->
      <div v-if="assetsList.length > 1" class="carousel-nav-overlay" @click.stop>
        <button 
          class="carousel-arrow left-arrow" 
          data-tip="上一张"
          aria-label="上一张"
          @click="handlePrevImage"
        >
          <ChevronLeft :size="12" />
        </button>

        <span class="carousel-counter">{{ currentAssetIndex + 1 }} / {{ assetsList.length }}</span>

        <button 
          class="carousel-arrow right-arrow" 
          data-tip="下一张"
          aria-label="下一张"
          @click="handleNextImage"
        >
          <ChevronRight :size="12" />
        </button>
      </div>
    </div>

    <!-- 右侧内容与操作区 -->
    <div class="card-content">
      <!-- 提示词 -->
      <p class="card-prompt" :data-tip="promptText" @click="handleTitleClick">
        {{ promptText }}
      </p>

      <!-- 参数标签 (图生图等特殊标签置顶，其后为真实生成参数) -->
      <div class="card-tags">
        <span v-if="isI2I" class="tag-badge ref-tag">
          图生图
        </span>
        <span class="tag-badge">
          {{ resolutionText }}
        </span>
        <span class="tag-badge">
          {{ ratioText }}
        </span>
        <span class="tag-badge">
          质量 {{ qualityChineseText }}
        </span>
        <span class="tag-badge time-tag" :data-tip="`生成时间：${fullTimeText}`">
          <Clock :size="11" />
          <span>{{ simpleTimeText }}</span>
        </span>
      </div>

      <!-- 底部工具栏 (高度固定 28px) -->
      <div class="card-actions">
        <!-- 重新生成 -->
        <button 
          class="card-action-btn" 
          data-tip="重新生成"
          @click.stop="emit('regenerate', currentAsset)"
        >
          <RotateCw :size="15" />
        </button>

        <!-- 收藏 -->
        <button 
          class="card-action-btn" 
          :class="{ 'is-favorite': currentAsset.isFavorite }"
          :data-tip="currentAsset.isFavorite ? '取消收藏' : '收藏此图'"
          @click.stop="currentAsset.id && emit('toggleFavorite', currentAsset.id)"
        >
          <Star :size="15" :class="{ 'star-filled': currentAsset.isFavorite }" />
        </button>

        <!-- 复用提示词与参数 -->
        <button 
          class="card-action-btn" 
          data-tip="复用提示词与参数"
          @click.stop="emit('reuse', currentAsset)"
        >
          <CornerUpLeft :size="15" />
        </button>

        <!-- 以此图为参考进行编辑/图生图 -->
        <button 
          class="card-action-btn" 
          data-tip="以此图为参考进行图生图编辑"
          @click.stop="emit('editAsReference', currentAsset)"
        >
          <Edit3 :size="15" />
        </button>

        <!-- 下载原图 (单图/多图批量下载) -->
        <button 
          class="card-action-btn" 
          :data-tip="assetsList.length > 1 ? `批量下载全部原图 (${assetsList.length} 张)` : '下载原图'"
          @click.stop="handleDownload"
        >
          <Download :size="15" />
        </button>

        <!-- 删除单张 -->
        <button 
          class="card-action-btn btn-delete" 
          data-tip="删除此图"
          @click.stop="currentAsset.id && emit('delete', currentAsset.id)"
        >
          <Trash2 :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.gallery-card {
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  overflow: hidden;
  display: flex;
  height: 148px;
  min-height: 148px;
  max-height: 148px;
  box-sizing: border-box;
  box-shadow: $shadow-sm;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: $accent-border;
    box-shadow: $shadow-lg;
  }
}

/* ================= 作品展示卡片 ================= */
.card-image-wrapper {
  position: relative;
  width: 140px;
  min-width: 140px;
  height: 100%;
  background: $bg-surface-subtle;
  cursor: pointer;
  overflow: hidden;
  box-sizing: border-box;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  &:hover img {
    transform: scale(1.03);
  }

  &:hover .carousel-nav-overlay,
  &:focus-within .carousel-nav-overlay {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translate(-50%, 0);
  }
}

.card-failed-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: $danger-subtle;
  color: $danger;

  .fail-status-text {
    font-size: 0.72rem;
    font-weight: 600;
    text-align: center;
    padding: 0 8px;
    line-height: 1.3;
  }
}

.image-badge-overlay {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
  z-index: 2;

  .size-pill, .count-pill {
    background: $scrim;
    color: $text-on-scrim;
    font-size: 0.65rem;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    backdrop-filter: blur(8px);
    font-family: $font-mono;
  }
}

/* 多图轮播浮动控制器 (精简紧凑胶囊设计，仅在 hover 图片时浮现) */
.carousel-nav-overlay {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translate(-50%, 4px);
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: $scrim;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 1.5px 5px;
  border-radius: 9999px;
  z-index: 3;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  box-shadow: $shadow-scrim, 0 0 0 1px $media-glass-border;
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), 
              transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), 
              visibility 0.2s ease;

  .carousel-arrow {
    background: transparent;
    border: none;
    color: $text-on-scrim;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: background-color 0.15s ease, transform 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .carousel-counter {
    color: $text-on-scrim;
    font-family: $font-mono;
    font-size: 0.62rem;
    font-weight: 600;
    line-height: 1;
    padding: 0 3px;
    letter-spacing: 0.5px;
    user-select: none;
    white-space: nowrap;
  }
}

.card-content {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  min-width: 0;
}

.card-prompt {
  font-size: 0.85rem;
  font-weight: 600;
  color: $text-main;
  line-height: 1.45;
  height: 2.9em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  word-break: break-word;
  margin: 0;

  &:hover {
    color: $accent-primary;
  }
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  overflow: hidden;
  white-space: nowrap;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 22px;
  font-size: 0.70rem;
  line-height: normal;
  color: $text-muted;
  background: $bg-surface-subtle;
  border: 1px solid $border-color;
  padding: 1.5px 5px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;

  &.ref-tag {
    background: $accent-subtle;
    border-color: $accent-border;
    color: $accent-primary;
  }

  &.batch-tag {
    background: $success-subtle;
    border-color: $success-border;
    color: $success;
    font-weight: 600;
  }

  &.time-tag {
    font-family: $font-mono;
    font-size: 0.67rem;
    color: $text-secondary;
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  box-sizing: border-box;
}

.card-action-btn {
  background: transparent;
  border: none;
  color: $text-dim;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  max-width: 28px;
  max-height: 28px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  padding: 0;
  box-sizing: border-box;
  border-radius: $radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  svg {
    flex-shrink: 0;
    pointer-events: none;
  }

  &:hover {
    background: $bg-surface-hover;
    color: $text-main;
  }

  &.is-favorite {
    color: $favorite;

    &:hover {
      background: $favorite-subtle;
      color: $favorite;
    }
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 2px $favorite-glow);
  }

  &.btn-delete:hover {
    background: $danger-subtle;
    color: $danger;
  }
}

@media (max-width: 640px) {
  .gallery-card {
    flex-direction: column;
    height: auto;
    min-height: 280px;
    max-height: none;
  }

  .card-image-wrapper {
    width: 100%;
    height: 180px;
  }
}
</style>
