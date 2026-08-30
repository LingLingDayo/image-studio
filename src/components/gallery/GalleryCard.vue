<script setup lang="ts">
import { computed } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { RotateCw, Star, CornerUpLeft, Edit3, Trash2, Code } from 'lucide-vue-next';

const props = defineProps<{
  item: MediaAsset;
}>();

const emit = defineEmits<{
  (e: 'view', item: MediaAsset): void;
  (e: 'regenerate', item: MediaAsset): void;
  (e: 'toggleFavorite', id: number): void;
  (e: 'reuse', item: MediaAsset): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'delete', id: number): void;
}>();

const dimensionText = computed(() => {
  if (props.item.width && props.item.height) {
    return `${props.item.width}×${props.item.height}`;
  }
  return props.item.size || '1024×1024';
});

const ratioTag = computed(() => {
  if (props.item.ratio) {
    return props.item.ratio.startsWith('≈') ? props.item.ratio : `#${props.item.ratio}`;
  }
  return '#1:1';
});
</script>

<template>
  <div class="gallery-card">
    <!-- 左侧图片缩略图区 -->
    <div class="card-image-wrapper" @click="emit('view', item)">
      <img :src="item.url" :alt="item.prompt" loading="lazy" />
      
      <!-- 比例与分辨率悬浮标签 -->
      <div class="image-badge-overlay">
        <span class="ratio-pill">{{ ratioTag }}</span>
        <span class="size-pill">{{ dimensionText }}</span>
      </div>
    </div>

    <!-- 右侧内容与操作区 -->
    <div class="card-content">
      <!-- 提示词 -->
      <p class="card-prompt" :data-tip="item.prompt" @click="emit('view', item)">
        {{ item.prompt }}
      </p>

      <!-- 参数标签 -->
      <div class="card-tags">
        <span class="tag-badge">
          <Code :size="12" />
          <span>{{ item.model === 'gpt-image-2' ? 'GPT-Image-2' : item.model }}</span>
        </span>
        <span v-if="item.quality" class="tag-badge">
          质量 {{ item.quality }}
        </span>
        <span v-if="item.referenceImages && item.referenceImages.length > 0" class="tag-badge ref-tag">
          图生图
        </span>
      </div>

      <!-- 底部工具栏 -->
      <div class="card-actions">
        <!-- 重新生成 -->
        <button 
          class="card-action-btn" 
          data-tip="重新生成"
          @click.stop="emit('regenerate', item)"
        >
          <RotateCw :size="15" />
        </button>

        <!-- 收藏 -->
        <button 
          class="card-action-btn" 
          :class="{ 'is-favorite': item.isFavorite }"
          data-tip="收藏"
          @click.stop="item.id && emit('toggleFavorite', item.id)"
        >
          <Star :size="15" :class="{ 'star-filled': item.isFavorite }" />
        </button>

        <!-- 复用提示词与参数 -->
        <button 
          class="card-action-btn" 
          data-tip="复用提示词与参数"
          @click.stop="emit('reuse', item)"
        >
          <CornerUpLeft :size="15" />
        </button>

        <!-- 以此图为参考进行编辑/图生图 -->
        <button 
          class="card-action-btn" 
          data-tip="以此图为参考进行图生图编辑"
          @click.stop="emit('editAsReference', item)"
        >
          <Edit3 :size="15" />
        </button>

        <!-- 删除 -->
        <button 
          class="card-action-btn btn-delete" 
          data-tip="删除"
          @click.stop="item.id && emit('delete', item.id)"
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
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    border-color: #93c5fd;
    box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.08);
    transform: translateY(-2px);
  }
}

.card-image-wrapper {
  position: relative;
  width: 140px;
  min-width: 140px;
  background: #f8fafc;
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s ease;
  }

  &:hover img {
    transform: scale(1.04);
  }
}

.image-badge-overlay {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  gap: 4px;
  z-index: 2;

  .ratio-pill, .size-pill {
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

.card-content {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.card-prompt {
  font-size: 0.85rem;
  font-weight: 600;
  color: $text-main;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  word-break: break-word;

  &:hover {
    color: $accent-primary;
  }
}

.card-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: $text-muted;
  background: #f8fafc;
  border: 1px solid rgba(226, 232, 240, 0.8);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;

  &.ref-tag {
    background: $accent-subtle;
    border-color: #bfdbfe;
    color: $accent-primary;
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 4px;
}

.card-action-btn {
  background: transparent;
  border: none;
  color: $text-dim;
  width: 28px;
  height: 28px;
  border-radius: $radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
    color: $text-main;
  }

  &.is-favorite {
    color: #ca8a04;
  }

  .star-filled {
    fill: #eab308;
    color: #ca8a04;
  }

  &.btn-delete:hover {
    background: $danger-subtle;
    color: $danger;
  }
}

@media (max-width: 640px) {
  .gallery-card {
    flex-direction: column;
  }

  .card-image-wrapper {
    width: 100%;
    height: 180px;
  }
}
</style>
