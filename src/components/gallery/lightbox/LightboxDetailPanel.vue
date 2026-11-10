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
  Sliders,
  Image as ImageIcon,
  Timer,
  Clock,
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
    <!-- 纯装饰层：与左侧画布呼应的点阵 + 柔和光晕，不承载任何信息 -->
    <div class="panel-ambient" aria-hidden="true"></div>

    <div class="info-header">
      <div class="header-title-wrap">
        <span class="title-mark" aria-hidden="true"></span>
        <div class="title-stack">
          <h3>作品详情</h3>
          <span class="title-underline" aria-hidden="true"></span>
        </div>
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
    </div>

    <div class="info-scroll">
      <!-- 失败状态提示横幅 -->
      <div v-if="isFailed" class="failed-alert-banner">
        <AlertCircle :size="16" class="alert-icon" />
        <div class="alert-text-wrap">
          <span class="alert-headline">{{ failHeadline }}</span>
          <span class="alert-detail">{{ item.errorMessage || '生图失败' }}</span>
        </div>
      </div>

      <!-- 提示词 -->
      <section class="info-block">
        <div class="section-head">
          <span class="section-diamond" aria-hidden="true"></span>
          <span class="section-name">提示词</span>
          <span class="section-line" aria-hidden="true"></span>
          <button type="button" class="btn-text-copy" @click="handleCopyPrompt">
            <Check v-if="isCopied" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ isCopied ? '已复制' : '复制' }}</span>
          </button>
        </div>
        <div class="prompt-card">
          <div class="prompt-box">{{ item.prompt }}</div>
        </div>
      </section>

      <!-- 参数与规格看板：设定 / 结果双栏对照 -->
      <div class="params-dashboard">
        <div class="specs-grid">
          <!-- 左栏：生图设定 -->
          <div class="spec-column preset-column">
            <div class="spec-column-header">
              <div class="header-title">
                <span class="column-icon"><Sliders :size="11" /></span>
                <span>生图设定</span>
              </div>
              <span class="mode-mini-tag" :class="presetTypeLabel === '图生图' ? 'is-i2i' : 'is-t2i'">
                {{ presetTypeLabel }}
              </span>
            </div>
            <div class="spec-item">
              <span class="spec-k">设定分辨率</span>
              <span class="spec-v">{{ presetResolution }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">设定比例</span>
              <span class="spec-v">{{ presetRatio }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">设定尺寸</span>
              <span class="spec-v">{{ presetSize }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">设定画质</span>
              <span class="spec-v">{{ presetQuality }}</span>
            </div>
            <div v-if="item.moderation" class="spec-item">
              <span class="spec-k">设定审核</span>
              <span class="spec-v">{{ item.moderation === 'low' ? '低' : '默认' }}</span>
            </div>
          </div>

          <!-- 右栏：实际结果 -->
          <div class="spec-column output-column">
            <div class="spec-column-header">
              <div class="header-title">
                <span class="column-icon"><ImageIcon :size="11" /></span>
                <span>实际结果</span>
              </div>
              <span v-if="item.transparent" class="mode-mini-tag is-transparent">
                透明底
              </span>
            </div>
            <div class="spec-item">
              <span class="spec-k">实际分辨率</span>
              <span class="spec-v">{{ actualResolution }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">实际比例</span>
              <span class="spec-v">{{ actualRatio }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">真实尺寸</span>
              <span class="spec-v highlight-mono">{{ actualDimension }}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">图像格式</span>
              <span class="spec-v">{{ actualFormat }}</span>
            </div>
          </div>
        </div>

        <!-- 底部元数据栏 -->
        <div class="meta-footer">
          <div class="meta-stat-item" :data-tip="`生成耗时: ${item.duration || '-'}`">
            <Timer :size="12" class="stat-icon" />
            <span class="stat-k">耗时</span>
            <span class="stat-v">{{ item.duration || '-' }}</span>
          </div>
          <div class="meta-stat-divider"></div>
          <div class="meta-stat-item" :data-tip="`创建时间: ${formatFullTime(item.timestamp)}`">
            <Clock :size="12" class="stat-icon" />
            <span class="stat-k">时间</span>
            <span class="stat-v">{{ formatFullTime(item.timestamp) }}</span>
          </div>
        </div>
      </div>
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
  position: relative;
  isolation: isolate;
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

// 背景装饰：点阵呼应左侧画布，光晕让留白区域不再空洞
.panel-ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 300px 230px at 100% -8%, $accent-soft, transparent 72%),
    radial-gradient(ellipse 320px 260px at -18% 92%, $accent-subtle, transparent 76%);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, $border-strong 1px, transparent 1px);
    background-size: 18px 18px;
    opacity: 0.22;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 16%, #000 72%, transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0%, #000 16%, #000 72%, transparent 100%);
  }
}

.info-header,
.info-scroll,
.modal-actions {
  position: relative;
  z-index: 1;
}

.info-header {
  flex-shrink: 0;
  padding: 20px 52px 14px 26px; // 右侧留出关闭按钮的位置
  border-bottom: 1px solid $border-light;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  @media (max-width: 860px) {
    padding: 16px 50px 12px 18px;
  }
}

.title-mark {
  width: 4px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 3px;
  background: $accent-gradient;
  box-shadow: 0 0 12px $accent-glow;
}

.title-stack {
  display: flex;
  flex-direction: column;
  gap: 5px;

  h3 {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    line-height: 1.2;
    color: $text-main;
  }
}

.title-underline {
  width: 26px;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, $accent-primary, transparent);
}

.btn-fav {
  margin-left: auto;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  border: 1px solid $border-color;
  border-radius: 50%;
  background: $bg-surface-raised;
  box-shadow: $shadow-xs;
  color: $text-dim;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    color: $favorite;
    border-color: $favorite-border;
    background: $favorite-subtle;
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.94);
  }

  &.is-fav {
    color: $favorite;
    border-color: $favorite-border;
    background: $favorite-subtle;

    &:hover {
      box-shadow: 0 3px 12px $favorite-glow;
    }
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 3px $favorite-glow);
  }
}

.info-scroll {
  flex: 1;
  min-height: 0;
  padding: 16px 24px 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: 860px) {
    padding: 14px 18px 16px;
    gap: 14px;
  }
}

.is-disabled {
  opacity: 0.55;
  cursor: not-allowed !important;
  pointer-events: none;
}

.failed-alert-banner {
  position: relative;
  overflow: hidden;
  background: $danger-subtle;
  border: 1px solid $danger-border;
  border-radius: $radius-lg;
  padding: 12px 14px 12px 17px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  box-shadow: $shadow-sm;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: $danger;
  }

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
    font-weight: 700;
    color: $danger;
  }

  .alert-detail {
    font-size: 0.76rem;
    color: $danger;
    line-height: 1.45;
    word-break: break-word;
  }
}

.info-block {
  display: flex;
  flex-direction: column;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 24px;
}

.section-diamond {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  transform: rotate(45deg);
  border-radius: 1.5px;
  background: $accent-primary;
  box-shadow: 0 0 0 3px $accent-subtle;
}

.section-name {
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: $text-secondary;
  white-space: nowrap;
}

.section-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, $border-color, transparent);
}

.btn-text-copy {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid $accent-border;
  border-radius: 999px;
  background: $accent-subtle;
  color: $accent-primary;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: normal;
  cursor: pointer;
  transition: all 0.16s ease;

  &:hover {
    background: $accent-soft;
    box-shadow: $shadow-sm;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.prompt-card {
  position: relative;
  overflow: hidden;
  margin-top: 10px;
  padding: 12px 15px 12px 19px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-surface-subtle;
  box-shadow: $shadow-sm;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 13px;
    bottom: 13px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: $accent-gradient;
  }

  &::after {
    content: '\201C';
    position: absolute;
    right: 10px;
    top: -14px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 4.6rem;
    line-height: 1;
    color: $accent-primary;
    opacity: 0.08;
    pointer-events: none;
  }
}

.prompt-box {
  position: relative;
  z-index: 1;
  max-height: 118px;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: 0.84rem;
  line-height: 1.7;
  color: $text-secondary;
  word-break: break-word;
  white-space: pre-wrap;
}

.params-dashboard {
  position: relative;
  overflow: hidden;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-surface;
  box-shadow: $shadow-md;
  display: flex;
  flex-direction: column;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, $accent-primary 0%, $accent-light 45%, $success 78%, transparent 100%);
    opacity: 0.8;
  }
}

.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
  }
}

.spec-column {
  display: flex;
  flex-direction: column;
  padding: 12px 14px 8px;

  &:first-child {
    border-right: 1px solid $border-color;

    @media (max-width: 360px) {
      border-right: none;
      border-bottom: 1px solid $border-color;
    }
  }

  .spec-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    margin-bottom: 6px;
    padding-bottom: 8px;
    border-bottom: 1px dashed $border-color;
  }

  .header-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 700;
    line-height: normal;
    color: $text-main;
    white-space: nowrap;
  }

  .column-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &.preset-column .column-icon {
    background: $accent-subtle;
    color: $accent-primary;
  }

  &.output-column .column-icon {
    background: $success-subtle;
    color: $success;
  }
}

.mode-mini-tag {
  flex-shrink: 0;
  font-size: 0.66rem;
  padding: 2px 6px;
  border-radius: 999px;
  font-weight: 600;
  line-height: 1.2;
  border: 1px solid transparent;

  &.is-t2i,
  &.is-i2i {
    background: $accent-subtle;
    border-color: $accent-border;
    color: $accent-primary;
  }

  &.is-transparent {
    background: $success-subtle;
    border-color: $success-border;
    color: $success;
  }
}

.spec-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 5px 0;
  border-bottom: 1px solid $border-light;

  &:last-child {
    border-bottom: none;
    padding-bottom: 2px;
  }

  .spec-k {
    font-size: 0.68rem;
    line-height: 1.3;
    color: $text-muted;
    white-space: nowrap;
  }

  .spec-v {
    font-size: 0.84rem;
    font-weight: 650;
    line-height: 1.3;
    color: $text-main;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    &.highlight-mono {
      font-family: $font-mono;
      font-size: 0.8rem;
      letter-spacing: -0.02em;
      color: $accent-primary;
    }
  }
}

.meta-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid $border-color;
  background: $bg-surface-subtle;
}

.meta-stat-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 4px 9px 4px 6px;
  border: 1px solid $border-light;
  border-radius: 999px;
  background: $bg-surface;
  box-shadow: $shadow-xs;
  line-height: normal;

  .stat-icon {
    box-sizing: content-box;
    flex-shrink: 0;
    padding: 3px;
    border-radius: 50%;
    background: $accent-subtle;
    color: $accent-primary;
  }

  .stat-k {
    font-size: 0.68rem;
    color: $text-muted;
    white-space: nowrap;
  }

  .stat-v {
    font-size: 0.7rem;
    font-family: $font-mono;
    font-weight: 600;
    color: $text-main;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:last-child .stat-icon {
    background: $success-subtle;
    color: $success;
  }
}

.meta-stat-divider {
  flex: 1;
  min-width: 4px;
  height: 1px;
  background: repeating-linear-gradient(90deg, $border-color 0 3px, transparent 3px 6px);
}

.modal-actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px 24px 16px;
  border-top: 1px solid $border-color;
  background: $bg-surface;

  &::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 26px;
    right: 26px;
    height: 1px;
    background: linear-gradient(90deg, transparent, $accent-border 50%, transparent);
    opacity: 0.65;
  }

  .btn-primary {
    position: relative;
    min-height: 42px;
    border-radius: $radius-md;
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    gap: 8px;
    box-shadow: $shadow-glow, inset 0 1px 0 rgba(255, 255, 255, 0.18);
    transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: $shadow-lg, inset 0 1px 0 rgba(255, 255, 255, 0.22);
    }

    &:active:not(:disabled) {
      transform: translateY(0) scale(0.995);
    }
  }

  .btn-secondary {
    min-height: 36px;
    border-radius: $radius-md;
    font-size: 0.8rem;
  }

  .btn-danger-outline.btn-icon {
    width: 36px;
    height: 36px;
    min-width: 36px;
    max-width: 36px;
    border-radius: $radius-md;
  }

  @media (max-width: 860px) {
    padding: 12px 18px 14px;

    &::before {
      left: 18px;
      right: 18px;
    }
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
