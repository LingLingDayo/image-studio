import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { MediaAsset } from '@/types/asset';
import { assetRepository } from '@/core/storage/AssetRepository';

export const PAGE_SIZE_STORAGE_KEY = 'gpt_image_page_size';
export const DEFAULT_PAGE_SIZE = 24;
export const PAGE_SIZE_OPTIONS = [12, 24, 36, 48, 96];

export const useGalleryStore = defineStore('gallery', () => {
  const items = ref<MediaAsset[]>([]);
  const activeItem = ref<MediaAsset | null>(null);
  const isLoading = ref<boolean>(false);

  // 筛选状态
  const searchQuery = ref<string>('');
  const filterFavoriteOnly = ref<boolean>(false);
  const filterType = ref<'all' | 't2i' | 'i2i'>('all');

  // 分页状态与持久化
  const rawSavedSize = Number(localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  const pageSize = ref<number>(
    rawSavedSize > 0 && !isNaN(rawSavedSize) ? rawSavedSize : DEFAULT_PAGE_SIZE
  );
  const currentPage = ref<number>(1);

  const filteredItems = computed(() => {
    return items.value.filter((item) => {
      if (filterFavoriteOnly.value && !item.isFavorite) {
        return false;
      }
      const isI2I = item.type === 'i2i' || (item.referenceImages && item.referenceImages.length > 0);
      if (filterType.value === 'i2i' && !isI2I) {
        return false;
      }
      if (filterType.value === 't2i' && isI2I) {
        return false;
      }
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        const matchPrompt = item.prompt?.toLowerCase().includes(q);
        const matchRevised = item.revisedPrompt?.toLowerCase().includes(q);
        const matchQuality = item.quality?.toLowerCase().includes(q);
        const matchSize = item.size?.toLowerCase().includes(q);
        const matchFormat = item.format?.toLowerCase().includes(q);
        return matchPrompt || matchRevised || matchQuality || matchSize || matchFormat;
      }
      return true;
    });
  });

  const totalItems = computed(() => filteredItems.value.length);
  const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)));

  // 当筛选或总数改变时，自动将 currentPage 限制在有效范围 [1, totalPages]
  watch(totalPages, (newTotalPages) => {
    if (currentPage.value > newTotalPages) {
      currentPage.value = newTotalPages;
    }
  });

  // 过滤或搜索条件变更时重置回第 1 页
  watch([searchQuery, filterFavoriteOnly, filterType], () => {
    currentPage.value = 1;
  });

  const paginatedItems = computed(() => {
    const page = Math.min(Math.max(1, currentPage.value), totalPages.value);
    const start = (page - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredItems.value.slice(start, end);
  });

  function setPage(page: number) {
    const target = Math.floor(page);
    if (target >= 1 && target <= totalPages.value) {
      currentPage.value = target;
    }
  }

  function setPageSize(size: number) {
    const num = Math.floor(size);
    if (num > 0) {
      pageSize.value = num;
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(num));
      if (currentPage.value > totalPages.value) {
        currentPage.value = totalPages.value;
      }
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  async function loadGallery() {
    isLoading.value = true;
    try {
      items.value = await assetRepository.getAll();
    } catch (e) {
      console.error('加载相册失败:', e);
    } finally {
      isLoading.value = false;
    }
  }

  async function addItem(item: Omit<MediaAsset, 'id'>): Promise<MediaAsset> {
    const saved = await assetRepository.save(item);
    items.value.unshift(saved);
    currentPage.value = 1;
    return saved;
  }

  function addAssets(newAssets: MediaAsset[]) {
    for (const asset of newAssets) {
      const idx = items.value.findIndex((i) => i.id === asset.id);
      if (idx === -1) {
        items.value.unshift(asset);
      } else {
        items.value[idx] = asset;
      }
    }
    currentPage.value = 1;
  }

  async function toggleFavorite(id: number) {
    const item = items.value.find((i) => i.id === id);
    if (item) {
      item.isFavorite = !item.isFavorite;
      await assetRepository.update(item);
    }
  }

  async function updateItem(item: MediaAsset) {
    const idx = items.value.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      items.value[idx] = { ...item };
      await assetRepository.update(item);
    }
  }

  async function removeItem(id: number) {
    await assetRepository.delete(id);
    items.value = items.value.filter((i) => i.id !== id);
    if (activeItem.value?.id === id) {
      activeItem.value = null;
    }
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  }

  async function clearAll() {
    await assetRepository.clearAll();
    items.value = [];
    activeItem.value = null;
    currentPage.value = 1;
  }

  function setActiveItem(item: MediaAsset | null) {
    activeItem.value = item;
  }

  return {
    items,
    filteredItems,
    paginatedItems,
    activeItem,
    isLoading,
    searchQuery,
    filterFavoriteOnly,
    filterType,
    pageSize,
    currentPage,
    totalItems,
    totalPages,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    loadGallery,
    addItem,
    addAssets,
    toggleFavorite,
    updateItem,
    removeItem,
    clearAll,
    setActiveItem
  };
});

