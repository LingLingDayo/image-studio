<script setup lang="ts">
import { ref } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { Star, Search, Settings, Layers } from 'lucide-vue-next';
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
        class="filter-btn" 
        :class="{ active: galleryStore.filterFavoriteOnly }"
        data-tip="仅查看收藏"
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
        class="config-btn" 
        :class="{ 'needs-config': !configStore.isConfigured }"
        data-tip="接口配置"
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: $radius-lg;
  box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
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
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: #ffffff;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;

  &:hover {
    border-color: rgba(245, 158, 11, 0.45);
    color: $favorite;
    transform: translateY(-0.5px);
  }

  &.active {
    background: $favorite-subtle;
    border-color: rgba(245, 158, 11, 0.45);
    color: $favorite;
    box-shadow: 0 2px 8px $favorite-glow;
  }

  .star-active {
    fill: $favorite;
    color: $favorite;
    filter: drop-shadow(0 1px 2px rgba(245, 158, 11, 0.25));
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
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.9);
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
  border: 1px solid rgba(226, 232, 240, 0.95);
  background: #ffffff;
  color: $text-muted;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;

  &:hover {
    border-color: #93c5fd;
    color: $accent-primary;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.1);
    transform: translateY(-0.5px);
  }

  &.needs-config {
    border-color: #fca5a5;
    background: #fef2f2;
    color: #ef4444;
  }

  .dot-warn {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #ef4444;
  }
}

/* 响应式适配：在手机等窄屏宽度下隐藏作品数量信息 */
@media (max-width: 600px) {
  .stat-badge {
    display: none;
  }
}
</style>
