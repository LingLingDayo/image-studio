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
  Clock
} from 'lucide-vue-next';

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

// 模型优化提示词有效性判定（存在且不等于原提示词）
const hasRevisedPrompt = computed(() => {
  if (!props.item.revisedPrompt) return false;
  const revised = props.item.revisedPrompt.trim();
  const origin = (props.item.prompt || '').trim();
  return revised !== '' && revised !== origin;
});

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
          class="btn-fav" 
          :class="{ 'is-fav': item.isFavorite }" 
          :data-tip="item.isFavorite ? '取消收藏' : '收藏此图'"
          @click="item.id && emit('toggleFavorite', item.id)"
        >
          <Star :size="17" :class="{ 'star-filled': item.isFavorite }" />
        </button>
      </div>
    </div>

    <!-- 提示词 -->
    <div class="info-block">
      <div class="block-label">
        <span>提示词</span>
        <button class="btn-text-copy" @click="handleCopyPrompt">
          <Check v-if="isCopied" :size="13" />
          <Copy v-else :size="13" />
          <span>{{ isCopied ? '已复制' : '复制' }}</span>
        </button>
      </div>
      <div class="prompt-box">
        {{ item.prompt }}
      </div>
    </div>

    <!-- 模型优化提示词 (如有且与原提示词不同) -->
    <div v-if="hasRevisedPrompt" class="info-block">
      <span class="block-label">模型优化提示词</span>
      <div class="prompt-box revised">
        {{ item.revisedPrompt }}
      </div>
    </div>

    <!-- 参数与规格看板 (单层一体化布局) -->
    <div class="params-dashboard">
      <!-- 核心规格双栏对比区 -->
      <div class="specs-grid">
        <!-- 左栏：生图设定 (4项核心维度) -->
        <div class="spec-column preset-column">
          <div class="spec-column-header">
            <div class="header-title">
              <Sliders :size="12" />
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
        </div>

        <!-- 右栏：实际结果 (4项核心维度) -->
        <div class="spec-column output-column">
          <div class="spec-column-header">
            <div class="header-title">
              <ImageIcon :size="12" />
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

      <!-- 底部一体化元数据栏 -->
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

    <!-- 底部操作按钮 -->
    <div class="modal-actions">
      <button class="btn-primary full-width" @click="emit('download')">
        <Download :size="16" />
        <span>{{ rotation % 360 !== 0 ? `下载旋转 (${((rotation % 360) + 360) % 360}°) 原图` : '下载原图' }}</span>
      </button>

      <div class="action-btn-row">
        <button class="btn-secondary flex-1" @click="emit('reuse', item)">
          <CornerUpLeft :size="15" />
          <span>复用参数</span>
        </button>

        <button class="btn-secondary flex-1" @click="emit('editAsReference', item)">
          <Edit3 :size="15" />
          <span>以此图编辑</span>
        </button>

        <button class="btn-danger-outline btn-icon" data-tip="删除此图片" @click="item.id && emit('delete', item.id)">
          <Trash2 :size="15" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-info-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  border-left: 1px solid $border-color;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 36px; // 避开右上角关闭按钮区域
  min-height: 32px;

  .header-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;

    h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: $text-main;
      margin: 0;
    }
  }
}

.btn-fav {
  background: transparent;
  border: none;
  color: $text-dim;
  cursor: pointer;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: $radius-sm;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    color: $favorite;
    background: rgba(245, 158, 11, 0.1);
    transform: scale(1.08);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-fav {
    color: $favorite;

    &:hover {
      background: rgba(245, 158, 11, 0.14);
    }
  }

  .star-filled {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 3px rgba(245, 158, 11, 0.28));
  }
}

.info-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: $text-muted;
}

.btn-text-copy {
  background: none;
  border: none;
  color: $accent-primary;
  font-size: 0.75rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.prompt-box {
  font-size: 0.85rem;
  color: $text-main;
  background: $bg-surface-subtle;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  padding: 10px 12px;
  line-height: 1.5;
  max-height: 140px;
  overflow-y: auto;
  word-break: break-word;

  &.revised {
    color: $text-secondary;
    font-style: italic;
  }
}

.params-dashboard {
  background: $bg-surface-subtle;
  padding: 12px 14px;
  border-radius: $radius-lg;
  border: 1px solid $border-color;
  display: flex;
  flex-direction: column;
}

.specs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @media (max-width: 360px) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.spec-column {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &:first-child {
    padding-right: 4px;
    border-right: 1px solid $border-color;

    @media (max-width: 360px) {
      padding-right: 0;
      border-right: none;
      padding-bottom: 8px;
      border-bottom: 1px solid $border-color;
    }
  }

  .spec-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.73rem;
    font-weight: 600;
    padding-bottom: 5px;
    margin-bottom: 2px;
    border-bottom: 1px solid $border-light;

    .header-title {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
  }

  &.preset-column .spec-column-header .header-title {
    color: $accent-primary;
  }

  &.output-column .spec-column-header .header-title {
    color: #059669;
  }
}

.mode-mini-tag {
  font-size: 0.68rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 500;
  line-height: 1.2;

  &.is-t2i {
    background: $accent-subtle;
    color: $accent-primary;
  }

  &.is-i2i {
    background: rgba(168, 85, 247, 0.1);
    color: #9333ea;
  }

  &.is-transparent {
    background: rgba(16, 185, 129, 0.1);
    color: #059669;
  }
}

.spec-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.74rem;
  gap: 8px;

  .spec-k {
    color: $text-muted;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .spec-v {
    color: $text-main;
    font-weight: 500;
    white-space: nowrap;
    text-align: right;

    &.highlight-mono {
      font-family: $font-mono;
      font-size: 0.72rem;
    }
  }
}

.meta-footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
}

.meta-stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: $text-muted;

  .stat-icon {
    color: $text-dim;
    flex-shrink: 0;
  }

  .stat-k {
    color: $text-muted;
  }

  .stat-v {
    color: $text-main;
    font-weight: 500;
    font-family: $font-mono;
  }
}

.meta-stat-divider {
  width: 1px;
  height: 12px;
  background: $border-color;
}

.modal-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.action-btn-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .btn-danger-outline {
    width: 36px;
    height: 36px;
    padding: 0;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
  }
}

.flex-1 {
  flex: 1;
}

.full-width {
  width: 100%;
}
</style>
