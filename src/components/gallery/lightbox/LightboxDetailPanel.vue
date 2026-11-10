<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { formatFullTime } from '@/utils/download';
import { formatQualityLabel, getResolutionDisplay, inferResolutionTier, formatDisplayRatio, formatActualRatio } from '@/utils/imageSize';
import {
  Download,
  CornerUpLeft,
  Trash2,
  Copy,
  Edit3,
  Star,
  Check,
  AlertCircle
} from '@lucide/vue';
import { getErrorHeadline } from '@/utils/apiError';

const props = defineProps<{
  item: MediaAsset;
  rotation: number;
}>();

const emit = defineEmits<{
  (e: 'toggleFavorite', id: number): void;
  (e: 'reuse', item: MediaAsset): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'delete', id: number): void;
  (e: 'download'): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();

const isCopied = ref(false);

const isFailed = computed(() => props.item.status === 'failed');
const failHeadline = computed(() => getErrorHeadline(props.item.errorMessage));

// 生图模式标签
const presetTypeLabel = computed(() => {
  return props.item.type === 'i2i' || (props.item.referenceImages && props.item.referenceImages.length > 0) ? '图生图' : '文生图';
});

// 1. 分辨率：设定分辨率 vs 实际分辨率
const presetResolution = computed(() => {
  if (props.item.targetResolution) {
    return props.item.targetResolution === 'auto' ? '自动' : props.item.targetResolution.toUpperCase();
  }
  return props.item.size === 'auto' ? '自动' : getResolutionDisplay(props.item);
});

const actualResolution = computed(() => {
  if (isFailed.value) return '-';
  if (props.item.width && props.item.height) {
    return inferResolutionTier(Math.max(props.item.width, props.item.height)).toUpperCase();
  }
  return getResolutionDisplay(props.item);
});

// 2. 宽高比：设定比例 vs 实际比例
const presetRatio = computed(() => {
  if (props.item.targetRatio) {
    return props.item.targetRatio === 'auto' ? '自动' : formatDisplayRatio(props.item.targetRatio);
  }
  return props.item.ratio && props.item.ratio !== 'auto' ? formatDisplayRatio(props.item.ratio) : '自动';
});

const actualRatio = computed(() => {
  if (isFailed.value) return '-';
  return formatActualRatio(props.item.ratio, {
    width: props.item.width,
    height: props.item.height
  });
});

// 3. 物理尺寸：设定尺寸 vs 真实尺寸
const presetSize = computed(() => {
  if (props.item.targetSize) {
    return props.item.targetSize === 'auto' ? '自动' : props.item.targetSize.replace(/x/i, '×');
  }
  if (props.item.size && props.item.size !== 'auto') {
    return props.item.size.replace(/x/i, '×');
  }
  return '自动';
});

const actualDimension = computed(() => {
  if (isFailed.value) return '失败';
  if (props.item.width && props.item.height) {
    return `${props.item.width}×${props.item.height}`;
  }
  return props.item.size ? props.item.size.replace(/x/i, '×') : '-';
});

// 4. 质量与格式：设定画质 vs 实际格式
const presetQuality = computed(() => {
  return formatQualityLabel(props.item.quality);
});

const actualFormat = computed(() => {
  if (isFailed.value) return '-';
  return (props.item.format || 'png').toUpperCase();
});

async function handleCopyPrompt() {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.item.prompt);
      isCopied.value = true;
      emit('showToast', '提示词已复制到剪贴板', 'info');
      setTimeout(() => {
        isCopied.value = false;
      }, 2000);
    } else {
      throw new Error('Clipboard API not available');
    }
  } catch {
    emit('showToast', '复制失败，请手动选中文本复制', 'error');
  }
}
</script>

<template>
  <div class="modal-info-panel">
    <div class="info-header">
      <div class="header-title-wrap">
        <h3>作品详情</h3>
        <button
          v-if="!isFailed"
          type="button"
          class="btn-fav"
          :class="{ 'is-fav': item.isFavorite }"
          :data-tip="item.isFavorite ? '取消收藏' : '收藏此图'"
          @click="item.id && emit('toggleFavorite', item.id)"
        >
          <Star :size="16" :class="{ 'star-filled': item.isFavorite }" />
        </button>
      </div>
      <div class="header-meta">
        <span class="meta-entry" :data-tip="`生成耗时: ${item.duration || '-'}`">
          <span class="meta-k">耗时</span>
          <span class="meta-v">{{ item.duration || '-' }}</span>
        </span>
        <span class="meta-separator" aria-hidden="true"></span>
        <span class="meta-entry" :data-tip="`创建时间: ${formatFullTime(item.timestamp)}`">
          <span class="meta-k">时间</span>
          <span class="meta-v">{{ formatFullTime(item.timestamp) }}</span>
        </span>
      </div>
    </div>

    <div class="info-scroll">
      <!-- 失败状态提示 -->
      <div v-if="isFailed" class="failed-alert-banner">
        <AlertCircle :size="15" class="alert-icon" />
        <div class="alert-text-wrap">
          <span class="alert-headline">{{ failHeadline }}</span>
          <span class="alert-detail">{{ item.errorMessage || '生图失败' }}</span>
        </div>
      </div>

      <!-- 提示词 -->
      <section class="info-block">
        <div class="block-label">
          <span>提示词</span>
          <button type="button" class="btn-text-copy" @click="handleCopyPrompt">
            <Check v-if="isCopied" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ isCopied ? '已复制' : '复制' }}</span>
          </button>
        </div>
        <div class="prompt-box">{{ item.prompt }}</div>
      </section>

      <!-- 规格：以单列属性表分段呈现设定与结果 -->
      <section class="specs-section">
        <div class="spec-group">
          <div class="spec-group-head">
            <span class="group-name">生图设定</span>
            <span class="group-tag">{{ presetTypeLabel }}</span>
          </div>
          <dl class="spec-list">
            <div class="spec-item">
              <dt class="spec-k">设定分辨率</dt>
              <dd class="spec-v">{{ presetResolution }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">设定比例</dt>
              <dd class="spec-v">{{ presetRatio }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">设定尺寸</dt>
              <dd class="spec-v">{{ presetSize }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">设定画质</dt>
              <dd class="spec-v">{{ presetQuality }}</dd>
            </div>
            <div v-if="item.moderation" class="spec-item">
              <dt class="spec-k">设定审核</dt>
              <dd class="spec-v">{{ item.moderation === 'low' ? '低' : '默认' }}</dd>
            </div>
          </dl>
        </div>

        <div class="spec-group">
          <div class="spec-group-head">
            <span class="group-name">实际结果</span>
            <span v-if="item.transparent" class="group-tag">透明底</span>
          </div>
          <dl class="spec-list">
            <div class="spec-item">
              <dt class="spec-k">实际分辨率</dt>
              <dd class="spec-v">{{ actualResolution }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">实际比例</dt>
              <dd class="spec-v">{{ actualRatio }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">真实尺寸</dt>
              <dd class="spec-v is-mono">{{ actualDimension }}</dd>
            </div>
            <div class="spec-item">
              <dt class="spec-k">图像格式</dt>
              <dd class="spec-v">{{ actualFormat }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>

    <!-- 底部操作区 -->
    <div class="modal-actions">
      <button
        class="btn-primary full-width"
        :class="{ 'is-disabled': isFailed }"
        :disabled="isFailed"
        :data-tip="isFailed ? '当前图片未生成成功，无法下载' : undefined"
        @click="!isFailed && emit('download')"
      >
        <Download :size="16" />
        <span>{{ isFailed ? '未生成成功' : (rotation % 360 !== 0 ? `下载旋转 (${((rotation % 360) + 360) % 360}°) 原图` : '下载原图') }}</span>
      </button>

      <div class="action-btn-row">
        <button class="btn-secondary flex-1" @click="emit('reuse', item)">
          <CornerUpLeft :size="15" />
          <span>复用参数</span>
        </button>

        <button
          class="btn-secondary flex-1"
          :class="{ 'is-disabled': isFailed }"
          :disabled="isFailed"
          :data-tip="isFailed ? '无可用参考图' : undefined"
          @click="!isFailed && emit('editAsReference', item)"
        >
          <Edit3 :size="15" />
          <span>以此图编辑</span>
        </button>

        <button class="btn-danger-outline btn-icon" data-tip="删除此记录" @click="item.id && emit('delete', item.id)">
          <Trash2 :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-info-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid $border-color;
  background: $bg-surface;

  @media (max-width: 860px) {
    flex: 1 1 auto;
    border-left: none;
    border-top: 1px solid $border-color;
  }
}

.info-header {
  flex-shrink: 0;
  padding: 18px 52px 14px 28px; // 右侧留出关闭按钮的位置
  border-bottom: 1px solid $border-color;

  .header-title-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h3 {
      margin: 0;
      font-size: 1.06rem;
      font-weight: 650;
      line-height: 1.3;
      color: $text-main;
    }
  }

  @media (max-width: 860px) {
    padding: 16px 50px 12px 18px;
  }
}

.btn-fav {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-dim;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;

  &:hover {
    color: $favorite;
    background: $favorite-subtle;
  }

  &.is-fav {
    color: $favorite;
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
  }
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
}

.meta-entry {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;

  .meta-k {
    font-size: 0.72rem;
    color: $text-muted;
    white-space: nowrap;
  }

  .meta-v {
    font-family: $font-mono;
    font-size: 0.7rem;
    color: $text-secondary;
    white-space: nowrap;
  }
}

.meta-separator {
  width: 1px;
  height: 10px;
  flex-shrink: 0;
  background: $border-color;
}

.info-scroll {
  flex: 1;
  min-height: 0;
  padding: 18px 28px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 860px) {
    padding: 16px 18px 18px;
    gap: 18px;
  }
}

.is-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none;
}

.failed-alert-banner {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 2px 0 2px 12px;
  border-left: 2px solid $danger;

  .alert-icon {
    color: $danger;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .alert-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .alert-headline {
    font-size: 0.82rem;
    font-weight: 650;
    color: $danger;
  }

  .alert-detail {
    font-size: 0.76rem;
    line-height: 1.5;
    color: $text-muted;
    word-break: break-word;
  }
}

.info-block {
  display: flex;
  flex-direction: column;
}

.block-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: $text-muted;
}

.btn-text-copy {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: $accent-primary;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0;
  line-height: normal;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.prompt-box {
  margin-top: 12px;
  max-height: 150px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: 0.88rem;
  line-height: 1.8;
  color: $text-main;
  white-space: pre-wrap;
  word-break: break-word;
}

.specs-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.spec-group {
  display: flex;
  flex-direction: column;
}

.spec-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  margin-bottom: 4px;
  border-bottom: 1px solid $border-light;

  .group-name {
    font-size: 0.78rem;
    font-weight: 650;
    letter-spacing: 0.02em;
    color: $text-main;
  }

  .group-tag {
    font-size: 0.72rem;
    color: $text-muted;
    white-space: nowrap;
  }
}

.spec-list {
  display: flex;
  flex-direction: column;
}

.spec-item {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: baseline;
  gap: 12px;
  padding: 4px 0;

  .spec-k {
    font-size: 0.76rem;
    line-height: 1.5;
    color: $text-muted;
  }

  .spec-v {
    font-size: 0.82rem;
    font-weight: 500;
    line-height: 1.5;
    color: $text-main;
    word-break: break-word;

    &.is-mono {
      font-family: $font-mono;
      font-size: 0.78rem;
    }
  }

  @media (max-width: 360px) {
    grid-template-columns: 88px 1fr;
    gap: 8px;
  }
}

.modal-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 28px 16px;
  border-top: 1px solid $border-color;

  @media (max-width: 860px) {
    padding: 12px 18px 14px;
  }
}

.action-btn-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.full-width {
  width: 100%;
}
</style>
