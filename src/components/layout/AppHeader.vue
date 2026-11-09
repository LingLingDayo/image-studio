<script setup lang="ts">
import { ref } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { Star, Search, Settings, Layers } from '@lucide/vue';
import { UiSelect, UiInput } from '@/components/ui';

defineEmits<{
  (e: 'openConfig'): void;
}>();

const configStore = useConfigStore();
const galleryStore = useGalleryStore();

const searchInput = ref('');

const categoryOptions = [
  { label: '全部作品', value: 'all' },
  { label: '文生图', value: 't2i' },
  { label: '图生图/编辑', value: 'i2i' }
];

function handleSearch(val: string) {
  galleryStore.searchQuery = val;
}

function clearSearch() {
  searchInput.value = '';
  galleryStore.searchQuery = '';
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <!-- 收藏快速筛选 -->
      <button 
        type="button"
        class="filter-btn" 
        :class="{ active: galleryStore.filterFavoriteOnly }"
        data-tip="仅查看收藏"
        aria-label="仅查看收藏"
        :aria-pressed="galleryStore.filterFavoriteOnly"
        @click="galleryStore.filterFavoriteOnly = !galleryStore.filterFavoriteOnly"
      >
        <Star :size="15" :class="{ 'star-active': galleryStore.filterFavoriteOnly }" />
      </button>

      <!-- 类型分类下拉 -->
      <UiSelect
        v-model="galleryStore.filterType"
        :options="categoryOptions"
        variant="default"
        size="sm"
        placement="bottom"
      />

      <!-- 搜索输入框 -->
      <div class="search-box-wrapper">
        <UiInput 
          v-model="searchInput"
          placeholder="搜索提示词、参数..." 
          clearable
          size="sm"
          variant="default"
          @update:model-value="handleSearch"
          @clear="clearSearch"
        >
          <template #prefix>
            <Search :size="14" />
          </template>
        </UiInput>
      </div>
    </div>

    <div class="header-right">
      <!-- 作品总数 -->
      <div class="stat-badge">
        <Layers :size="14" />
        <span>{{ galleryStore.filteredItems.length }} 作品</span>
      </div>

      <!-- 设置按钮 -->
      <button 
        type="button"
        class="config-btn" 
        :class="{ 'needs-config': !configStore.isConfigured }"
        data-tip="设置"
        aria-label="设置"
        @click="$emit('openConfig')"
      >
        <Settings :size="16" />
        <span v-if="!configStore.isConfigured" class="dot-warn"></span>
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: $bg-glass;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  box-shadow: $shadow-md;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.filter-btn {
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  border: 1px solid $border-color;
  background: $bg-surface;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;

  &:hover {
    border-color: $favorite-border;
    color: $favorite;
  }

  &.active {
    background: $favorite-subtle;
    border-color: $favorite-border;
    color: $favorite;
    box-shadow: 0 2px 8px $favorite-glow;
  }

  .star-active {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 2px $favorite-glow);
  }
}

.search-box-wrapper {
  max-width: 380px;
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: $text-secondary;
  background: $bg-surface;
  border: 1px solid $border-color;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: $shadow-xs;
}

.config-btn {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: $radius-sm;
  border: 1px solid $border-color;
  background: $bg-surface;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;

  &:hover {
    border-color: $accent-border;
    color: $accent-primary;
    box-shadow: 0 2px 6px $accent-glow;
  }

  &.needs-config {
    border-color: $danger-border;
    background: $danger-subtle;
    color: $danger;
  }

  .dot-warn {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: $danger;
  }
}

/* 响应式适配：在手机等窄屏宽度下隐藏作品数量信息 */
@media (max-width: 600px) {
  .stat-badge {
    display: none;
  }
}
</style>
