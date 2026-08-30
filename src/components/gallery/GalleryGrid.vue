<script setup lang="ts">
import { useGalleryStore } from '@/stores/galleryStore';
import type { MediaAsset } from '@/types/asset';
import GalleryCard from './GalleryCard.vue';
import { UiPagination } from '@/components/ui';
import { ImageOff, Loader2 } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'view', item: MediaAsset): void;
  (e: 'regenerate', item: MediaAsset): void;
  (e: 'reuse', item: MediaAsset): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();

const galleryStore = useGalleryStore();

async function handleToggleFavorite(id: number) {
  await galleryStore.toggleFavorite(id);
}

async function handleDelete(id: number) {
  await galleryStore.removeItem(id);
  emit('showToast', '图片已删除', 'info');
}

function handlePageChange(page: number) {
  galleryStore.setPage(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handlePageSizeChange(size: number) {
  galleryStore.setPageSize(size);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <section class="gallery-container">
    <div v-if="galleryStore.isLoading" class="gallery-loading">
      <Loader2 :size="28" class="spin-icon" />
      <span>加载历史相册中...</span>
    </div>

    <div v-else-if="galleryStore.filteredItems.length === 0" class="gallery-empty">
      <div class="empty-icon-wrap">
        <ImageOff :size="36" />
      </div>
      <h3>{{ galleryStore.searchQuery ? '没有找到匹配的作品' : '暂无生成作品' }}</h3>
      <p>{{ galleryStore.searchQuery ? '请尝试更换搜索关键词或清除筛选' : '在下方输入提示词并点击生成，你的作品将呈现于此' }}</p>
    </div>

    <div v-else class="gallery-content-wrap">
      <div class="cards-grid">
        <GalleryCard
          v-for="item in galleryStore.paginatedItems"
          :key="item.id || item.timestamp"
          :item="item"
          @view="emit('view', item)"
          @regenerate="emit('regenerate', item)"
          @toggle-favorite="handleToggleFavorite"
          @reuse="emit('reuse', item)"
          @edit-as-reference="emit('editAsReference', item)"
          @delete="handleDelete"
        />
      </div>

      <!-- 分页导航栏 -->
      <div class="pagination-wrapper">
        <UiPagination
          :current-page="galleryStore.currentPage"
          :total-items="galleryStore.totalItems"
          :page-size="galleryStore.pageSize"
          :page-size-options="galleryStore.pageSizeOptions"
          @update:current-page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.gallery-container {
  width: 100%;
  min-height: 200px;
}

.gallery-content-wrap {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.pagination-wrapper {
  margin-top: 8px;
  width: 100%;
}

.gallery-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: $text-muted;
  gap: 12px;
  font-size: 0.9rem;
}

.spin-icon {
  animation: spin 1s infinite linear;
  color: $accent-primary;
}

.gallery-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  background: $bg-surface;
  border: 1px dashed $border-color;
  border-radius: $radius-xl;

  .empty-icon-wrap {
    color: $text-dim;
    margin-bottom: 12px;
  }

  h3 {
    font-size: 1rem;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 6px;
  }

  p {
    font-size: 0.85rem;
    color: $text-dim;
    max-width: 320px;
  }
}
</style>

