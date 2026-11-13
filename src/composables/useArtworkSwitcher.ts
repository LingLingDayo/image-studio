import { computed, type Ref } from 'vue';
import { useGalleryStore } from '@/stores/galleryStore';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';

function isSameAsset(a: MediaAsset, b: MediaAsset): boolean {
  if (a.id != null && b.id != null) {
    return a.id === b.id;
  }
  // 懒加载下未装载的作品 url 为空，不能把两个空 url 误判为同一张图
  return Boolean(a.url) && a.url === b.url;
}

function findWorkIndex(works: ArtworkBatch[], item: MediaAsset | null): number {
  if (!item) return -1;
  return works.findIndex((batch) => batch.assets.some((asset) => isSameAsset(asset, item)));
}

/**
 * 在筛选后的作品批次之间切换当前查看项。
 * 提供按「作品卡片」粒度切换（prevWork/nextWork）以及「先组内多图、再跨作品」连续切换（prevImage/nextImage）。
 */
export function useArtworkSwitcher(currentItem: Ref<MediaAsset | null>) {
  const galleryStore = useGalleryStore();

  const works = computed<ArtworkBatch[]>(() => galleryStore.filteredBatches);

  const currentWorkIndex = computed(() => findWorkIndex(works.value, currentItem.value));

  const canSwitchWork = computed(() => works.value.length > 1 && currentWorkIndex.value >= 0);

  const currentBatchAssets = computed<MediaAsset[]>(() => {
    const idx = currentWorkIndex.value;
    if (idx >= 0) {
      return works.value[idx].assets;
    }
    return currentItem.value ? [currentItem.value] : [];
  });

  const currentAssetIndex = computed(() => {
    const item = currentItem.value;
    if (!item || currentWorkIndex.value < 0) return 0;
    const idx = currentBatchAssets.value.findIndex((asset) => isSameAsset(asset, item));
    return idx >= 0 ? idx : 0;
  });

  const totalImageCount = computed(() =>
    works.value.reduce((sum, batch) => sum + batch.assets.length, 0)
  );

  const canSwitchImage = computed(() =>
    currentWorkIndex.value >= 0 && totalImageCount.value > 1
  );

  function goToWork(index: number) {
    const batch = works.value[index];
    if (!batch?.assets.length) return;
    currentItem.value = batch.assets[0];
  }

  function findAdjacentWork(step: 1 | -1): ArtworkBatch | null {
    const totalWorks = works.value.length;
    if (totalWorks === 0 || currentWorkIndex.value < 0) return null;
    for (let offset = 1; offset <= totalWorks; offset++) {
      const targetIndex = (currentWorkIndex.value + step * offset + totalWorks) % totalWorks;
      const batch = works.value[targetIndex];
      if (batch?.assets.length) {
        return batch;
      }
    }
    return null;
  }

  function prevWork() {
    if (!canSwitchWork.value) return false;
    const total = works.value.length;
    goToWork((currentWorkIndex.value - 1 + total) % total);
    return true;
  }

  function nextWork() {
    if (!canSwitchWork.value) return false;
    const total = works.value.length;
    goToWork((currentWorkIndex.value + 1) % total);
    return true;
  }

  function prevImage() {
    if (!canSwitchImage.value) return false;
    const assets = currentBatchAssets.value;
    if (currentAssetIndex.value > 0) {
      currentItem.value = assets[currentAssetIndex.value - 1];
      return true;
    }
    const targetBatch = findAdjacentWork(-1);
    if (!targetBatch?.assets.length) return false;
    currentItem.value = targetBatch.assets[targetBatch.assets.length - 1];
    return true;
  }

  function nextImage() {
    if (!canSwitchImage.value) return false;
    const assets = currentBatchAssets.value;
    if (currentAssetIndex.value < assets.length - 1) {
      currentItem.value = assets[currentAssetIndex.value + 1];
      return true;
    }
    const targetBatch = findAdjacentWork(1);
    if (!targetBatch?.assets.length) return false;
    currentItem.value = targetBatch.assets[0];
    return true;
  }

  return {
    works,
    currentWorkIndex,
    currentAssetIndex,
    totalImageCount,
    canSwitchWork,
    canSwitchImage,
    currentBatchAssets,
    prevWork,
    nextWork,
    prevImage,
    nextImage
  };
}
