<script setup lang="ts">
import { computed } from 'vue';
import type { GenerationTask } from '@/types/task';
import { 
  RotateCw, 
  Trash2, 
  Loader2, 
  Square, 
  AlertCircle,
  Layers,
  Clock
} from 'lucide-vue-next';
import { formatQualityLabel, getResolutionDisplay } from '@/utils/imageSize';

const props = defineProps<{
  task: GenerationTask;
}>();

const emit = defineEmits<{
  (e: 'cancelTask', taskId: string): void;
  (e: 'retryTask', task: GenerationTask): void;
  (e: 'removeTask', taskId: string): void;
}>();

// 生成时间计算与展示
const itemTimestamp = computed<number>(() => {
  return props.task.createdAt || props.task.updatedAt || Date.now();
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
  return props.task.params.size || '自动尺寸';
});

// 比例文字 (如 1:1, 16:9)
const ratioText = computed(() => {
  if (props.task.params.aspectRatio && props.task.params.aspectRatio !== 'auto') {
    return props.task.params.aspectRatio.replace(/^#/, '');
  }
  return '1:1';
});

// 分辨率文字 (1K/2K/4K)
const resolutionText = computed(() => {
  return getResolutionDisplay({
    size: props.task.params.size,
    resolution: props.task.params.resolution
  });
});

// 质量中文标签
const qualityChineseText = computed(() => {
  return formatQualityLabel(props.task.params.quality);
});

// 是否为图生图模式
const isI2I = computed(() => {
  return props.task.type === 'i2i' || (props.task.params.referenceImages && props.task.params.referenceImages.length > 0);
});
</script>

<template>
  <div 
    class="gallery-card task-card"
    :class="`status-${task.status}`"
  >
    <!-- 左侧极简流光加载区 -->
    <div class="card-image-wrapper task-visual-wrapper">
      <!-- 极简流光骨架背景与居中指示 -->
      <div v-if="task.status === 'processing' || task.status === 'queued'" class="task-generating-stage">
        <div class="shimmer-background"></div>
        <div class="minimal-loader-box">
          <Loader2 :size="20" class="spin-icon" />
          <span class="task-timer">{{ task.durationFormatted || '0.0s' }}</span>
        </div>
      </div>

      <!-- 失败/已取消状态 -->
      <div v-else class="task-failed-stage">
        <AlertCircle :size="22" class="fail-icon" />
        <span class="fail-status-text">{{ task.status === 'cancelled' ? '已取消' : '生成失败' }}</span>
      </div>

      <!-- 尺寸与数量角标 (左上角仅显示尺寸与多图数量) -->
      <div class="image-badge-overlay">
        <span class="size-pill">{{ dimensionText }}</span>
        <span v-if="task.params.count > 1" class="count-pill">共 {{ task.params.count }} 张</span>
      </div>
    </div>

    <!-- 右侧内容与操作区 -->
    <div class="card-content">
      <!-- 提示词 -->
      <p class="card-prompt" :data-tip="task.params.prompt">
        {{ task.params.prompt }}
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
        <span v-if="task.params.count > 1" class="tag-badge batch-tag">
          <Layers :size="11" />
          <span>批量 {{ task.params.count }} 张</span>
        </span>
        <span class="tag-badge time-tag" :title="`创建时间：${fullTimeText}`">
          <Clock :size="11" />
          <span>{{ simpleTimeText }}</span>
        </span>
      </div>

      <!-- 底部工具与状态栏 (高度与作品卡片 actions 保持严格一致 28px，避免高度抖动) -->
      <div class="card-actions task-card-actions">
        <!-- 正在生成中: 左侧极简进度条 + 右侧取消按钮 -->
        <template v-if="task.status === 'processing' || task.status === 'queued'">
          <div class="task-progress-inline">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: `${Math.max(5, task.progress)}%` }"></div>
            </div>
            <span class="progress-text">{{ task.progress }}%</span>
          </div>

          <button 
            class="task-action-btn btn-cancel-task"
            data-tip="取消任务"
            @click.stop="emit('cancelTask', task.id)"
          >
            <Square :size="12" />
            <span>取消</span>
          </button>
        </template>

        <!-- 失败/已取消: 左侧错误信息 + 右侧重试与移除按钮 -->
        <template v-else>
          <span class="task-error-inline" :data-tip="task.errorMessage">
            {{ task.errorMessage || '任务已中止' }}
          </span>

          <div class="task-btn-group">
            <button 
              class="task-action-btn btn-retry-task"
              data-tip="重试生成"
              @click.stop="emit('retryTask', task)"
            >
              <RotateCw :size="12" />
              <span>重试</span>
            </button>

            <button 
              class="task-action-btn btn-remove-task"
              data-tip="移除此记录"
              @click.stop="emit('removeTask', task.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </template>
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

.task-card {
  border: 1px dashed rgba(147, 197, 253, 0.9);
  background: #ffffff;

  &.status-processing {
    border-color: #60a5fa;
    box-shadow: 0 4px 16px -2px rgba(37, 99, 235, 0.08);
  }

  &.status-failed {
    border-color: #fca5a5;
    background: #ffffff;
  }
}

.task-visual-wrapper {
  background: #f8fafc;
  position: relative;
  width: 140px;
  min-width: 140px;
  height: 100%;
  overflow: hidden;
}

.task-generating-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;

  .shimmer-background {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%);
    background-size: 200% 100%;
    animation: shimmerEffect 1.8s infinite linear;
  }

  .minimal-loader-box {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: $accent-primary;

    .task-timer {
      font-family: $font-mono;
      font-size: 0.72rem;
      font-weight: 600;
      color: $text-secondary;
      background: rgba(255, 255, 255, 0.85);
      padding: 1px 6px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }
  }
}

.task-failed-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  color: $danger;
  background: #fff5f5;

  .fail-status-text {
    font-size: 0.72rem;
    font-weight: 600;
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
    background: rgba(15, 23, 42, 0.75);
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    backdrop-filter: blur(8px);
    font-family: $font-mono;
  }

  .count-pill {
    background: rgba(37, 99, 235, 0.85);
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
  word-break: break-word;
  margin: 0;
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

  &.time-tag {
    font-family: $font-mono;
    font-size: 0.67rem;
    color: $text-secondary;
  }
}

.task-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  box-sizing: border-box;
}

.task-progress-inline {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;

  .progress-track {
    flex: 1;
    height: 4px;
    background: #e2e8f0;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: $accent-gradient;
    border-radius: 2px;
    transition: width 0.25s ease-out;
  }

  .progress-text {
    font-family: $font-mono;
    font-size: 0.68rem;
    color: $text-muted;
    font-weight: 600;
    min-width: 28px;
    text-align: right;
  }
}

.task-error-inline {
  flex: 1;
  font-size: 0.72rem;
  color: $danger;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 500;
  padding: 3px 8px;
  height: 26px;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  &.btn-cancel-task {
    background: $bg-surface-subtle;
    border-color: $border-color;
    color: $text-muted;

    &:hover {
      background: $danger-subtle;
      border-color: #fca5a5;
      color: $danger;
    }
  }

  &.btn-retry-task {
    background: $accent-subtle;
    border-color: #bfdbfe;
    color: $accent-primary;

    &:hover {
      background: #dbeafe;
    }
  }

  &.btn-remove-task {
    background: transparent;
    border: none;
    color: $text-dim;
    width: 26px;
    height: 26px;
    min-width: 26px;
    min-height: 26px;
    max-width: 26px;
    max-height: 26px;
    aspect-ratio: 1 / 1;
    flex-shrink: 0;
    padding: 0;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: $radius-sm;

    &:hover {
      background: $danger-subtle;
      color: $danger;
    }
  }
}

.spin-icon {
  animation: spin 1s infinite linear;
}

@keyframes shimmerEffect {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
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
