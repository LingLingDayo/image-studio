import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ArtworkCard from './card/ArtworkCard.vue';
import { useGalleryStore } from '@/stores/galleryStore';
import { assetRepository } from '@/core/storage/AssetRepository';
import { dataUrlToBlob } from '@/core/storage/imageBlob';
import type { MediaAsset } from '@/types/asset';

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BLOB = dataUrlToBlob(`data:image/png;base64,${PNG_B64}`);

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: (entries: Array<{ isIntersecting: boolean }>) => void;
  observed: Element[] = [];

  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

function createSeed(overrides: Partial<Omit<MediaAsset, 'id'>> = {}): Omit<MediaAsset, 'id'> {
  return {
    url: '',
    blob: PNG_BLOB,
    prompt: '懒加载作品',
    model: 'gpt-image-2',
    size: '1024x1024',
    quality: 'medium',
    format: 'png',
    duration: '1.0s',
    timestamp: Date.now(),
    isFavorite: false,
    type: 't2i',
    ...overrides
  };
}

describe('作品卡片图片视口懒加载', () => {
  let pinia: ReturnType<typeof createPinia>;
  let container: HTMLDivElement;

  beforeEach(async () => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    await assetRepository.clearAll();
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 140, height: 148, top: 0, left: 0, right: 140, bottom: 148, x: 0, y: 0,
      toJSON: () => ({})
    } as DOMRect);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    container.remove();
  });

  it('未接近视口时只显示占位骨架，进入预取区后才读取并渲染图片', async () => {
    const store = useGalleryStore();
    await store.addItem(createSeed());
    await store.loadGallery();
    const asset = store.items[0];
    expect(asset.url).toBe('');

    const loadSpy = vi.spyOn(assetRepository, 'loadImage');
    const app = createApp({ render: () => h(ArtworkCard, { item: asset }) });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    expect(container.querySelector('.card-image-placeholder')).not.toBeNull();
    expect(container.querySelector('.card-image-wrapper img')).toBeNull();

    const observer = FakeIntersectionObserver.instances.at(-1);
    expect(observer).toBeDefined();
    observer!.callback([{ isIntersecting: false }]);
    await nextTick();
    expect(loadSpy).not.toHaveBeenCalled();

    observer!.callback([{ isIntersecting: true }]);
    await vi.waitFor(() => {
      expect(container.querySelector('.card-image-wrapper img')?.getAttribute('src')).toMatch(/^blob:/);
    });
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.card-image-placeholder')).toBeNull();
    expect(container.querySelector('.card-image-wrapper img')?.getAttribute('loading')).toBe('lazy');

    app.unmount();
  });

  it('同一卡片轮播切换到另一张图后重新预取新图', async () => {
    const store = useGalleryStore();
    await store.addItem(createSeed({ batchId: 'batch_lazy', prompt: '第一张', timestamp: 2000 }));
    await store.addItem(createSeed({ batchId: 'batch_lazy', prompt: '第二张', timestamp: 2000 }));
    await store.loadGallery();
    const batch = store.paginatedBatches[0];
    expect(batch.assets).toHaveLength(2);

    const loadSpy = vi.spyOn(assetRepository, 'loadImage');
    const app = createApp({ render: () => h(ArtworkCard, { batch }) });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    FakeIntersectionObserver.instances.at(-1)!.callback([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(loadSpy).toHaveBeenCalledTimes(1));

    (container.querySelector('.carousel-arrow.right-arrow') as HTMLButtonElement).click();
    await nextTick();
    await nextTick();

    const nextObserver = FakeIntersectionObserver.instances.at(-1)!;
    expect(nextObserver).not.toBe(FakeIntersectionObserver.instances[0]);
    nextObserver.callback([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(loadSpy).toHaveBeenCalledTimes(2));

    expect(container.querySelector('.carousel-counter')?.textContent).toBe('2 / 2');
    await vi.waitFor(() => {
      expect(container.querySelector('.card-image-wrapper img')?.getAttribute('src')).toMatch(/^blob:/);
    });

    app.unmount();
  });
});
