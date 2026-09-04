import { computed, type Ref } from 'vue';
import { useGalleryStore } from '@/stores/galleryStore';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';

function isSameAsset(a: MediaAsset, b: MediaAsset): boolean {
  if (a.id != null && b.id != null) {
    return a.id === b.id;
  }
  return a.url === b.url;
}

function findWorkIndex(works: ArtworkBatch[], item: MediaAsset | null): number {
  if (!item) return -1;
  return works.findIndex((batch) => batch.assets.some((asset) => isSameAsset(asset, item)));
}

/**
 * 在筛选后的作品批次之间切换当前查看项。
 * 多图批次仍由灯箱内部轮播处理，这里按「作品卡片」粒度前进/后退。
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

  function goToWork(index: number) {
    const batch = works.value[index];
    if (!batch?.assets.length) return;
    currentItem.value = batch.assets[0];
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

  return {
    works,
    currentWorkIndex,
    canSwitchWork,
    currentBatchAssets,
    prevWork,
    nextWork
  };
}
