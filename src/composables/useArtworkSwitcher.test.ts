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

  it('连续切图优先切换当前作品的多张图片，切完后再跳到下一件或上一件作品', () => {
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, { batchId: 'batch-a', prompt: 'A1' }),
      createMockAsset(2, { batchId: 'batch-a', prompt: 'A2' }),
      createMockAsset(3, { batchId: 'batch-b', prompt: 'B1' }),
      createMockAsset(4, { batchId: 'batch-c', prompt: 'C1' }),
      createMockAsset(5, { batchId: 'batch-c', prompt: 'C2' })
    ];
    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { canSwitchImage, currentAssetIndex, nextImage, prevImage } = useArtworkSwitcher(currentItem);

    expect(canSwitchImage.value).toBe(true);
    expect(currentAssetIndex.value).toBe(0);

    // 同一作品内：A1 -> A2
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(2);
    expect(currentAssetIndex.value).toBe(1);

    // 切完作品 A 后跳到作品 B 第一张：A2 -> B1
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(3);
    expect(currentAssetIndex.value).toBe(0);

    // 继续跳到作品 C：B1 -> C1 -> C2
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(4);
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(5);

    // 全部切完后循环回到第一件作品第一张：C2 -> A1
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(1);

    // 反向切图：从 A1 回退应落到上一件作品 C 的最后一张 C2 -> C1 -> B1 -> A2 -> A1
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(5);
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(4);
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(3);
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(2);
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(1);
  });

  it('仅有单件多图作品时也能循环切换组内所有图片', () => {
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, { batchId: 'only-batch', prompt: 'A1' }),
      createMockAsset(2, { batchId: 'only-batch', prompt: 'A2' })
    ];
    const currentItem = ref<MediaAsset | null>(store.items[0]);
    const { canSwitchWork, canSwitchImage, nextImage, prevImage } = useArtworkSwitcher(currentItem);

    expect(canSwitchWork.value).toBe(false);
    expect(canSwitchImage.value).toBe(true);

    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(2);
    expect(nextImage()).toBe(true);
    expect(currentItem.value?.id).toBe(1);
    expect(prevImage()).toBe(true);
    expect(currentItem.value?.id).toBe(2);
  });
});
