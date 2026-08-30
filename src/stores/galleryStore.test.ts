import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useGalleryStore, PAGE_SIZE_STORAGE_KEY, DEFAULT_PAGE_SIZE } from './galleryStore';
import type { MediaAsset } from '@/types/asset';

function createMockAsset(id: number, prompt: string = 'test prompt'): MediaAsset {
  return {
    id,
    url: `blob:mock-${id}`,
    blob: new Blob([`mock_${id}`], { type: 'image/png' }),
    prompt,
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'standard',
    duration: '1.2s',
    timestamp: Date.now() - id * 1000,
    isFavorite: false,
    type: 't2i'
  };
}

describe('useGalleryStore Pagination', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('should initialize with default page size and page 1', () => {
    const store = useGalleryStore();
    expect(store.currentPage).toBe(1);
    expect(store.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(store.totalPages).toBe(1);
    expect(store.totalItems).toBe(0);
    expect(store.paginatedItems).toEqual([]);
  });

  it('should load custom page size from localStorage if valid', () => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '12');
    const store = useGalleryStore();
    expect(store.pageSize).toBe(12);
  });

  it('should correctly calculate totalPages and paginated items', () => {
    const store = useGalleryStore();
    store.setPageSize(10);

    const mockItems = Array.from({ length: 25 }, (_, i) => createMockAsset(i + 1, `Prompt ${i + 1}`));
    store.items = mockItems;

    expect(store.totalItems).toBe(25);
    expect(store.totalPages).toBe(3);

    // Page 1: 10 items
    expect(store.currentPage).toBe(1);
    expect(store.paginatedItems.length).toBe(10);
    expect(store.paginatedItems[0].id).toBe(1);
    expect(store.paginatedItems[9].id).toBe(10);

    // Navigate to Page 2: 10 items
    store.setPage(2);
    expect(store.currentPage).toBe(2);
    expect(store.paginatedItems.length).toBe(10);
    expect(store.paginatedItems[0].id).toBe(11);

    // Navigate to Page 3: 5 items
    store.nextPage();
    expect(store.currentPage).toBe(3);
    expect(store.paginatedItems.length).toBe(5);
    expect(store.paginatedItems[0].id).toBe(21);
    expect(store.paginatedItems[4].id).toBe(25);

    // Next page should not exceed totalPages
    store.nextPage();
    expect(store.currentPage).toBe(3);

    // Prev page
    store.prevPage();
    expect(store.currentPage).toBe(2);
  });

  it('should update pageSize and persist to localStorage', () => {
    const store = useGalleryStore();
    store.setPageSize(10);
    store.items = Array.from({ length: 50 }, (_, i) => createMockAsset(i + 1));
    expect(store.totalPages).toBe(5);

    store.setPage(5);
    expect(store.currentPage).toBe(5);

    store.setPageSize(36);
    expect(store.pageSize).toBe(36);
    expect(localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBe('36');
    // Total pages is now 2 (ceil(50/36)), current page 5 should adjust to 2
    expect(store.currentPage).toBe(2);
  });

  it('should reset currentPage to 1 when search or filter query changes', async () => {
    const store = useGalleryStore();
    store.setPageSize(5);
    store.items = [
      createMockAsset(1, 'Cyberpunk neon city'),
      createMockAsset(2, 'Cyberpunk robot cat'),
      createMockAsset(3, 'Forest landscape'),
      createMockAsset(4, 'Ocean sunset'),
      createMockAsset(5, 'Mountain peak'),
      createMockAsset(6, 'Cyberpunk street')
    ];

    store.setPage(2);
    expect(store.currentPage).toBe(2);

    store.searchQuery = 'Cyberpunk';
    // wait for watch trigger
    await new Promise((r) => setTimeout(r, 0));
    expect(store.currentPage).toBe(1);
    expect(store.totalItems).toBe(3);
    expect(store.paginatedItems.length).toBe(3);
  });

  it('should search by prompt and params but not by model', () => {
    const store = useGalleryStore();
    store.items = [
      { ...createMockAsset(1, 'Cyberpunk neon city'), quality: 'high', size: '1024x1024', format: 'png' },
      { ...createMockAsset(2, 'Forest landscape'), quality: 'low', size: '512x512', format: 'jpeg' }
    ];

    store.searchQuery = 'gpt-image';
    expect(store.filteredItems).toHaveLength(0);

    store.searchQuery = 'Cyberpunk';
    expect(store.filteredItems).toHaveLength(1);
    expect(store.filteredItems[0].id).toBe(1);

    store.searchQuery = 'high';
    expect(store.filteredItems).toHaveLength(1);
    expect(store.filteredItems[0].id).toBe(1);

    store.searchQuery = 'jpeg';
    expect(store.filteredItems).toHaveLength(1);
    expect(store.filteredItems[0].id).toBe(2);
  });

  it('should group multiple assets with same batchId into a single ArtworkBatch', () => {
    const store = useGalleryStore();
    const batchId1 = 'batch_task_1';
    const batchId2 = 'batch_task_2';

    store.items = [
      { ...createMockAsset(1, 'Cyberpunk city 1'), batchId: batchId1 },
      { ...createMockAsset(2, 'Cyberpunk city 2'), batchId: batchId1 },
      { ...createMockAsset(3, 'Cyberpunk city 3'), batchId: batchId1 },
      { ...createMockAsset(4, 'Forest scene 1'), batchId: batchId2 },
      { ...createMockAsset(5, 'Forest scene 2'), batchId: batchId2 },
      createMockAsset(6, 'Single legacy asset')
    ];

    expect(store.batches).toHaveLength(3);
    // 第一组包含 3 张图
    expect(store.batches[0].batchId).toBe(batchId1);
    expect(store.batches[0].assets).toHaveLength(3);
    // 第二组包含 2 张图
    expect(store.batches[1].batchId).toBe(batchId2);
    expect(store.batches[1].assets).toHaveLength(2);
    // 第三组单图独立
    expect(store.batches[2].assets).toHaveLength(1);

    expect(store.totalBatches).toBe(3);
    expect(store.paginatedBatches).toHaveLength(3);
  });
});


