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
  Layers,
  Clock
} from 'lucide-vue-next';
import { downloadImage, generateAssetFilename } from '@/utils/download';
import { formatQualityLabel, getResolutionDisplay } from '@/utils/imageSize';

const props = defineProps<{
  item?: MediaAsset;
  batch?: ArtworkBatch;
}>();

const emit = defineEmits<{
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

// 当 assets 列表变化时重置或修正 index
watch(
  () => assetsList.value.length,
  (len) => {
    if (currentAssetIndex.value >= len) {
      currentAssetIndex.value = Math.max(0, len - 1);
    }
  }
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
    return currentAsset.value.size || '1024×1024';
  }
  return '1024×1024';
});

// 比例文字 (如 1:1, 16:9)
const ratioText = computed(() => {
  if (currentAsset.value?.ratio) {
    return currentAsset.value.ratio.replace(/^#/, '');
  }
  if (props.batch?.ratio) {
    return props.batch.ratio.replace(/^#/, '');
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

function handleSelectImage(idx: number, e: Event) {
  e.stopPropagation();
  currentAssetIndex.value = idx;
}

function handleCardClick() {
  if (currentAsset.value) {
    emit('view', currentAsset.value, assetsList.value);
  }
}

// 下载单张或批量多张原图
async function handleDownload() {
  if (assetsList.value.length > 1) {
    const list = assetsList.value;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const filename = generateAssetFilename(a, i);
      await downloadImage(a.url, filename);
      if (i < list.length - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    emit('showToast', `已开始批量下载全部 ${list.length} 张原图`, 'success');
  } else if (currentAsset.value) {
    const a = currentAsset.value;
    const filename = generateAssetFilename(a);
    await downloadImage(a.url, filename);
    emit('showToast', '已开始下载原图', 'success');
  }
}
</script>

<template>
  <div v-if="currentAsset" class="gallery-card artwork-card">
    <!-- 左侧图片缩略图区 -->
    <div class="card-image-wrapper" @click="handleCardClick">
      <img :src="currentAsset.url" :alt="currentAsset.prompt" loading="lazy" />
      
      <!-- 尺寸悬浮标签 (仅左上角显示尺寸) -->
      <div class="image-badge-overlay">
        <span class="size-pill">{{ dimensionText }}</span>
      </div>

      <!-- 多图轮播切换左右按钮 (当多于 1 张时展示) -->
      <div v-if="assetsList.length > 1" class="carousel-nav-overlay" @click.stop>
        <button 
          class="carousel-arrow left-arrow" 
          data-tip="上一张"
          @click="handlePrevImage"
        >
          <ChevronLeft :size="14" />
        </button>

        <span class="carousel-counter">{{ currentAssetIndex + 1 }} / {{ assetsList.length }}</span>

        <button 
          class="carousel-arrow right-arrow" 
          data-tip="下一张"
          @click="handleNextImage"
        >
          <ChevronRight :size="14" />
        </button>
      </div>

      <!-- 底部图片小圆点指示器 -->
      <div v-if="assetsList.length > 1" class="carousel-dots-wrap" @click.stop>
        <span 
          v-for="(_, idx) in assetsList" 
          :key="idx" 
          class="carousel-dot"
          :class="{ active: idx === currentAssetIndex }"
          @click="handleSelectImage(idx, $event)"
        ></span>
      </div>
    </div>

    <!-- 右侧内容与操作区 -->
    <div class="card-content">
      <!-- 提示词 -->
      <p class="card-prompt" :data-tip="promptText" @click="handleCardClick">
        {{ promptText }}
      </p>

      <!-- 参数标签 (展示比例、分辨率、中文质量、生成时间) -->
      <div class="card-tags">
        <span class="tag-badge">
          {{ ratioText }}
        </span>
        <span class="tag-badge">
          {{ resolutionText }}
        </span>
        <span class="tag-badge">
          质量 {{ qualityChineseText }}
        </span>
        <span v-if="isI2I" class="tag-badge ref-tag">
          图生图
        </span>
        <span v-if="assetsList.length > 1" class="tag-badge batch-tag">
          <Layers :size="11" />
          <span>共 {{ assetsList.length }} 张</span>
        </span>
        <span class="tag-badge time-tag" :title="`生成时间：${fullTimeText}`">
          <Clock :size="11" />
          <span>{{ simpleTimeText }}</span>
        </span>
        <span v-if="currentAsset.duration" class="tag-badge duration-tag">
          {{ currentAsset.duration }}
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
          data-tip="收藏此图"
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
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: $radius-xl;
  overflow: hidden;
  display: flex;
  height: 148px;
  min-height: 148px;
  max-height: 148px;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08);
    transform: translateY(-2px);
  }
}

/* ================= 作品展示卡片 ================= */
.card-image-wrapper {
  position: relative;
  width: 140px;
  min-width: 140px;
  height: 100%;
  background: #f8fafc;
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
}

.image-badge-overlay {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
  z-index: 2;

  .size-pill {
    background: rgba(15, 23, 42, 0.75);
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    backdrop-filter: blur(8px);
    font-family: $font-mono;
  }
}

/* 多图轮播浮动控制器 */
.carousel-nav-overlay {
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  padding: 2px 4px;
  border-radius: 9999px;
  z-index: 3;
  opacity: 0.9;
  transition: opacity 0.2s ease;

  .carousel-arrow {
    background: transparent;
    border: none;
    color: #ffffff;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: scale(1.15);
    }
  }

  .carousel-counter {
    color: #ffffff;
    font-family: $font-mono;
    font-size: 0.65rem;
    font-weight: 600;
  }
}

.carousel-dots-wrap {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  z-index: 3;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
  padding: 2px 4px;
  border-radius: 9999px;

  .carousel-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.45);
    cursor: pointer;
    transition: all 0.15s ease;

    &.active {
      background: #60a5fa;
      width: 8px;
      border-radius: 9999px;
    }
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
  font-size: 0.70rem;
  color: $text-muted;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 1.5px 5px;
  border-radius: 4px;
  font-weight: 500;
  flex-shrink: 0;

  &.ref-tag {
    background: $accent-subtle;
    border-color: #bfdbfe;
    color: $accent-primary;
  }

  &.batch-tag {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #16a34a;
    font-weight: 600;
  }

  &.duration-tag {
    font-family: $font-mono;
    font-size: 0.68rem;
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
    background: #f1f5f9;
    color: $text-main;
  }

  &.is-favorite {
    color: $favorite;

    &:hover {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 2px rgba(245, 158, 11, 0.25));
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
