import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import GalleryCard from './GalleryCard.vue';
import GalleryGrid from './GalleryGrid.vue';
import LightboxModal from './LightboxModal.vue';
import TaskCard from './card/TaskCard.vue';
import ArtworkCard from './card/ArtworkCard.vue';
import LightboxViewport from './lightbox/LightboxViewport.vue';
import LightboxDetailPanel from './lightbox/LightboxDetailPanel.vue';
import { useGalleryStore } from '@/stores/galleryStore';
import type { MediaAsset } from '@/types/asset';
import type { GenerationTask } from '@/types/task';

function createMockAsset(id: number, prompt: string): MediaAsset {
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

describe('Gallery Components (src/components/gallery)', () => {
  it('should export all gallery components properly', () => {
    expect(GalleryCard).toBeDefined();
    expect(GalleryGrid).toBeDefined();
    expect(LightboxModal).toBeDefined();
  });

  it('should export card subcomponents properly', () => {
    expect(TaskCard).toBeDefined();
    expect(ArtworkCard).toBeDefined();
  });

  it('should export lightbox subcomponents properly', () => {
    expect(LightboxViewport).toBeDefined();
    expect(LightboxDetailPanel).toBeDefined();
  });
});

describe('TaskCard 失败原因展示', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('失败任务应展示分类短标题和接口返回的具体原因', async () => {
    const task: GenerationTask = {
      id: 'task_fail_1',
      type: 't2i',
      params: {
        model: 'gpt-image-2',
        prompt: '测试提示词',
        type: 't2i',
        size: '1024x1024',
        resolution: '1k',
        aspectRatio: '1:1',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      },
      status: 'failed',
      progress: 40,
      currentIndex: 1,
      elapsedSeconds: 3,
      durationFormatted: '3.0s',
      errorMessage: '生图失败: [内容安全审核拦截] content_policy_violation: prompt was flagged',
      resultAssetIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const app = createApp({
      render() {
        return h(TaskCard, { task });
      }
    });
    app.mount(container);
    await nextTick();

    expect(container.querySelector('.fail-status-text')?.textContent).toBe('安全拦截');
    expect(container.querySelector('.task-error-inline')?.textContent).toContain('content_policy_violation');
    expect(container.querySelector('.task-error-inline')?.textContent).not.toContain('<html');

    app.unmount();
  });
});

describe('LightboxModal 作品切换箭头', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('多件作品时在页面两侧渲染切换箭头，点击后切换当前作品', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, '第一件作品'),
      createMockAsset(2, '第二件作品')
    ];

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: store.items[0],
          allAssets: [store.items[0]]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const prevBtn = container.querySelector('.lightbox-side-nav.is-prev') as HTMLButtonElement;
    const nextBtn = container.querySelector('.lightbox-side-nav.is-next') as HTMLButtonElement;
    expect(prevBtn).not.toBeNull();
    expect(nextBtn).not.toBeNull();
    expect(container.querySelector('.prompt-box')?.textContent).toContain('第一件作品');

    nextBtn.click();
    await nextTick();
    expect(container.querySelector('.prompt-box')?.textContent).toContain('第二件作品');

    prevBtn.click();
    await nextTick();
    expect(container.querySelector('.prompt-box')?.textContent).toContain('第一件作品');

    app.unmount();
  });

  it('只有一件作品时不显示两侧切换箭头', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useGalleryStore();
    store.items = [createMockAsset(1, '唯一作品')];

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: store.items[0],
          allAssets: [store.items[0]]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    expect(container.querySelector('.lightbox-side-nav')).toBeNull();
    app.unmount();
  });

  it('灯箱关闭时不拦截左右方向键，避免挡住输入框光标移动', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useGalleryStore();
    store.items = [createMockAsset(1, '作品')];

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: null,
          allAssets: []
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(leftEvent);
    window.dispatchEvent(rightEvent);

    expect(leftEvent.defaultPrevented).toBe(false);
    expect(rightEvent.defaultPrevented).toBe(false);

    app.unmount();
  });

  it('灯箱打开时左右方向键仍用于切换作品', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useGalleryStore();
    store.items = [
      createMockAsset(1, '第一件作品'),
      createMockAsset(2, '第二件作品')
    ];

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: store.items[0],
          allAssets: [store.items[0]]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    expect(container.querySelector('.prompt-box')?.textContent).toContain('第一件作品');

    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(rightEvent);
    await nextTick();

    expect(rightEvent.defaultPrevented).toBe(true);
    expect(container.querySelector('.prompt-box')?.textContent).toContain('第二件作品');

    app.unmount();
  });
});
