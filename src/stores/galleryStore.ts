import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
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

  // 将扁平的 MediaAsset 列表聚合为 ArtworkBatch 列表 (按 batchId 聚合，无 batchId 的按单图独立成组)
  const batches = computed<ArtworkBatch[]>(() => {
    const map = new Map<string, ArtworkBatch>();
    const result: ArtworkBatch[] = [];

    for (const item of items.value) {
      const groupKey = item.batchId ? `batch_${item.batchId}` : `single_${item.id || item.timestamp}_${Math.random()}`;

      if (item.batchId && map.has(groupKey)) {
        const batch = map.get(groupKey)!;
        batch.assets.push(item);
        if (item.isFavorite) {
          batch.isFavorite = true;
        }
      } else {
        const newBatch: ArtworkBatch = {
          id: groupKey,
          batchId: item.batchId,
          prompt: item.prompt,
          revisedPrompt: item.revisedPrompt,
          model: item.model,
          size: item.size,
          targetResolution: item.targetResolution,
          targetRatio: item.targetRatio,
          targetSize: item.targetSize,
          ratio: item.ratio,
          width: item.width,
          height: item.height,
          quality: item.quality,
          format: item.format,
          transparent: item.transparent,
          duration: item.duration,
          timestamp: item.timestamp,
          isFavorite: Boolean(item.isFavorite),
          type: item.type,
          referenceImages: item.referenceImages,
          assets: [item]
        };
        map.set(groupKey, newBatch);
        result.push(newBatch);
      }
    }

    return result;
  });

  // 筛选后的批次列表
  const filteredBatches = computed<ArtworkBatch[]>(() => {
    return batches.value.filter((batch) => {
      if (filterFavoriteOnly.value) {
        const hasFav = batch.assets.some((a) => a.isFavorite);
        if (!hasFav) return false;
      }
      const isI2I = batch.type === 'i2i' || (batch.referenceImages && batch.referenceImages.length > 0);
      if (filterType.value === 'i2i' && !isI2I) {
        return false;
      }
      if (filterType.value === 't2i' && isI2I) {
        return false;
      }
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.toLowerCase().trim();
        const matchPrompt = batch.prompt?.toLowerCase().includes(q);
        const matchRevised = batch.revisedPrompt?.toLowerCase().includes(q);
        const matchQuality = batch.quality?.toLowerCase().includes(q);
        const matchSize = batch.size?.toLowerCase().includes(q);
        const matchFormat = batch.format?.toLowerCase().includes(q);
        const matchAnyAsset = batch.assets.some((a) =>
          a.prompt?.toLowerCase().includes(q) ||
          a.revisedPrompt?.toLowerCase().includes(q) ||
          a.quality?.toLowerCase().includes(q) ||
          a.size?.toLowerCase().includes(q) ||
          a.format?.toLowerCase().includes(q)
        );
        return matchPrompt || matchRevised || matchQuality || matchSize || matchFormat || matchAnyAsset;
      }
      return true;
    });
  });

  // 兼容旧的 filteredItems
  const filteredItems = computed<MediaAsset[]>(() => {
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

  // 总数与总页数基于聚合后的 Batches（若没有批次则使用 items 长度）
  const totalBatches = computed(() => filteredBatches.value.length);
  const totalItems = computed(() => filteredBatches.value.length > 0 ? filteredBatches.value.length : filteredItems.value.length);
  const totalPages = computed(() => Math.max(1, Math.ceil(totalBatches.value / pageSize.value)));

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

  // 当前页的 Batches
  const paginatedBatches = computed<ArtworkBatch[]>(() => {
    const page = Math.min(Math.max(1, currentPage.value), totalPages.value);
    const start = (page - 1) * pageSize.value;
    const end = start + pageSize.value;
    return filteredBatches.value.slice(start, end);
  });

  // 兼容旧的 paginatedItems (用于单元测试和旧调用)
  const paginatedItems = computed<MediaAsset[]>(() => {
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

  async function removeBatch(batch: ArtworkBatch) {
    for (const asset of batch.assets) {
      if (asset.id) {
        await assetRepository.delete(asset.id);
      }
    }
    const assetIds = new Set(batch.assets.map((a) => a.id).filter(Boolean));
    items.value = items.value.filter((i) => !assetIds.has(i.id));
    if (activeItem.value && assetIds.has(activeItem.value.id)) {
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
    batches,
    filteredBatches,
    paginatedBatches,
    filteredItems,
    paginatedItems,
    activeItem,
    isLoading,
    searchQuery,
    filterFavoriteOnly,
    filterType,
    pageSize,
    currentPage,
    totalBatches,
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
    removeBatch,
    clearAll,
    setActiveItem
  };
});


