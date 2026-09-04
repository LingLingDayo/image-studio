import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useArtworkSwitcher } from './useArtworkSwitcher';
import { useGalleryStore } from '@/stores/galleryStore';
import type { MediaAsset } from '@/types/asset';

function createMockAsset(id: number, extras: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    url: `blob:mock-${id}`,
    blob: new Blob([`mock_${id}`], { type: 'image/png' }),
    prompt: extras.prompt || `prompt-${id}`,
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'standard',
    duration: '1.2s',
    timestamp: Date.now() - id * 1000,
    isFavorite: false,
    type: 't2i',
    ...extras
  };
}

describe('useArtworkSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('只有一件作品时不能切换', () => {
    const store = useGalleryStore();
    store.items = [createMockAsset(1)];
    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { canSwitchWork, prevWork, nextWork } = useArtworkSwitcher(currentItem);

    expect(canSwitchWork.value).toBe(false);
    expect(prevWork()).toBe(false);
    expect(nextWork()).toBe(false);
    expect(currentItem.value?.id).toBe(1);
  });

  it('点击下一件/上一件按作品批次循环切换', () => {
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, { prompt: 'A' }),
      createMockAsset(2, { prompt: 'B' }),
      createMockAsset(3, { prompt: 'C' })
    ];
    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { canSwitchWork, currentWorkIndex, nextWork, prevWork } = useArtworkSwitcher(currentItem);

    expect(canSwitchWork.value).toBe(true);
    expect(currentWorkIndex.value).toBe(0);

    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(2);
    expect(currentWorkIndex.value).toBe(1);

    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(3);

    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(1);

    expect(prevWork()).toBe(true);
    expect(currentItem.value?.id).toBe(3);
  });

  it('多图批次视为一件作品，切换后落到目标批次的第一张', () => {
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, { batchId: 'batch-a', prompt: 'A1' }),
      createMockAsset(2, { batchId: 'batch-a', prompt: 'A2' }),
      createMockAsset(3, { batchId: 'batch-b', prompt: 'B1' })
    ];
    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { currentBatchAssets, currentWorkIndex, nextWork } = useArtworkSwitcher(currentItem);

    expect(currentWorkIndex.value).toBe(0);
    expect(currentBatchAssets.value.map((a) => a.id)).toEqual([1, 2]);

    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(3);
    expect(currentWorkIndex.value).toBe(1);
    expect(currentBatchAssets.value.map((a) => a.id)).toEqual([3]);
  });

  it('收藏筛选时只在可见作品之间切换', () => {
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, { isFavorite: true }),
      createMockAsset(2, { isFavorite: false }),
      createMockAsset(3, { isFavorite: true })
    ];
    store.filterFavoriteOnly = true;

    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { works, nextWork } = useArtworkSwitcher(currentItem);

    expect(works.value.map((w) => w.assets[0].id)).toEqual([1, 3]);
    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(3);
    expect(nextWork()).toBe(true);
    expect(currentItem.value?.id).toBe(1);
  });
});
