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
import { useConfigStore } from '@/stores/configStore';
import { useTaskStore } from '@/stores/taskStore';
import AppHeader from '@/components/layout/AppHeader.vue';
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

describe('GalleryGrid 首次使用引导', () => {
  let container: HTMLDivElement;
  let pinia: ReturnType<typeof createPinia>;
  let app: ReturnType<typeof createApp> | null;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    container = document.createElement('div');
    document.body.appendChild(container);
    app = null;
  });

  afterEach(() => {
    app?.unmount();
    container.remove();
  });

  async function mountGallery(onOpenConfig?: () => void) {
    app = createApp({
      render() {
        return h(GalleryGrid, { onOpenConfig });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();
  }

  it('未配置且没有作品时提供配置入口并发出打开设置事件', async () => {
    let opened = 0;
    await mountGallery(() => { opened++; });

    expect(container.querySelector('.gallery-empty p')?.textContent).toContain('先连接生图服务，再输入描述开始创作');
    const button = container.querySelector('.gallery-empty button') as HTMLButtonElement;
    expect(button?.textContent).toContain('配置生图服务');
    button.click();
    expect(opened).toBe(1);
  });

  it('配置完成后恢复正常创作提示并隐藏配置入口', async () => {
    await mountGallery();
    useConfigStore().updateConfig({ baseUrl: 'https://images.example.com', apiKey: 'test-key' });
    await nextTick();

    expect(container.querySelector('.gallery-empty p')?.textContent).toContain('在下方输入提示词并点击生成');
    expect(container.querySelector('.gallery-empty button')).toBeNull();
  });

  it.each([
    { label: '搜索', searchQuery: '不存在的作品', filterFavoriteOnly: false, filterType: 'all' as const },
    { label: '收藏', searchQuery: '', filterFavoriteOnly: true, filterType: 'all' as const },
    { label: '文生图分类', searchQuery: '', filterFavoriteOnly: false, filterType: 't2i' as const },
    { label: '图生图分类', searchQuery: '', filterFavoriteOnly: false, filterType: 'i2i' as const }
  ])('$label 筛选无结果时不显示首次配置引导', async ({ searchQuery, filterFavoriteOnly, filterType }) => {
    const galleryStore = useGalleryStore();
    galleryStore.searchQuery = searchQuery;
    galleryStore.filterFavoriteOnly = filterFavoriteOnly;
    galleryStore.filterType = filterType;
    await mountGallery();

    expect(container.querySelector('.gallery-empty')).not.toBeNull();
    expect(container.textContent).not.toContain('先连接生图服务');
    expect(container.querySelector('.gallery-empty button')).toBeNull();
  });

  it('已有作品时不因接口未配置而展示首次引导', async () => {
    useGalleryStore().items = [createMockAsset(1, '历史作品')];
    await mountGallery();

    expect(container.querySelector('.gallery-empty')).toBeNull();
    expect(container.querySelector('.cards-grid')).not.toBeNull();
  });

  it('已有生成任务时保留任务卡片，不展示首次引导', async () => {
    useTaskStore().addTask({
      id: 'task_onboarding',
      type: 't2i',
      params: {
        model: 'gpt-image-2',
        prompt: '进行中的创作',
        type: 't2i',
        size: 'auto',
        resolution: '1k',
        aspectRatio: 'auto',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      },
      status: 'processing',
      progress: 10,
      currentIndex: 1,
      elapsedSeconds: 1,
      durationFormatted: '1.0s',
      resultAssetIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await mountGallery();

    expect(container.querySelector('.gallery-empty')).toBeNull();
    expect(container.querySelector('.cards-grid')).not.toBeNull();
  });

  it('加载历史作品时不提前展示首次引导', async () => {
    useGalleryStore().isLoading = true;
    await mountGallery();

    expect(container.querySelector('.gallery-loading')).not.toBeNull();
    expect(container.querySelector('.gallery-empty')).toBeNull();
  });

  it('设置与收藏图标按钮具有明确名称并同步收藏状态', async () => {
    let opened = 0;
    app = createApp({
      render() {
        return h(AppHeader, { onOpenConfig: () => { opened++; } });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const settingsButton = container.querySelector('.config-btn') as HTMLButtonElement;
    expect(settingsButton.type).toBe('button');
    expect(settingsButton.getAttribute('aria-label')).toBe('设置');
    expect(settingsButton.getAttribute('data-tip')).toBe('设置');
    settingsButton.click();
    expect(opened).toBe(1);

    const favoriteButton = container.querySelector('.filter-btn') as HTMLButtonElement;
    expect(favoriteButton.type).toBe('button');
    expect(favoriteButton.getAttribute('aria-label')).toBe('仅查看收藏');
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    favoriteButton.click();
    await nextTick();
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
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

  it('生成进行中：当尺寸、分辨率、比例为自动时，左上角不显示尺寸且参数标签不包含「自动」', async () => {
    const task: GenerationTask = {
      id: 'task_auto_1',
      type: 'i2i',
      params: {
        model: 'gpt-image-2',
        prompt: '测试自动项隐藏',
        type: 'i2i',
        size: 'auto',
        resolution: 'auto',
        aspectRatio: 'auto',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 1
      },
      status: 'processing',
      progress: 30,
      currentIndex: 1,
      elapsedSeconds: 4,
      durationFormatted: '4.0s',
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

    // 1. 左上角尺寸 pill 应该隐藏
    const sizePill = container.querySelector('.image-badge-overlay .size-pill');
    expect(sizePill).toBeNull();

    // 2. 参数标签中不应含有「自动」字样
    const tags = Array.from(container.querySelectorAll('.card-tags .tag-badge')).map(
      (el) => el.textContent?.trim()
    );
    expect(tags.some((t) => t === '自动')).toBe(false);

    // 3. 图生图与质量等明确项应正常展示
    expect(container.querySelector('.card-tags .ref-tag')?.textContent).toContain('图生图');
    expect(tags.some((t) => t?.includes('质量 中'))).toBe(true);

    app.unmount();
  });

  it('生成进行中：当设定了具体的自定义尺寸与比例时，左上角与参数标签正常展示', async () => {
    const task: GenerationTask = {
      id: 'task_concrete_1',
      type: 't2i',
      params: {
        model: 'gpt-image-2',
        prompt: '测试具体参数',
        type: 't2i',
        size: '1920x1080',
        resolution: '2k',
        aspectRatio: '16:9',
        quality: 'high',
        format: 'png',
        transparent: false,
        count: 1
      },
      status: 'processing',
      progress: 50,
      currentIndex: 1,
      elapsedSeconds: 2,
      durationFormatted: '2.0s',
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

    // 1. 左上角展示具体尺寸
    const sizePill = container.querySelector('.image-badge-overlay .size-pill');
    expect(sizePill?.textContent).toBe('1920×1080');

    // 2. 参数标签中展示 2K, 16:9, 质量 高
    const tags = Array.from(container.querySelectorAll('.card-tags .tag-badge')).map(
      (el) => el.textContent?.trim()
    );
    expect(tags).toContain('2K');
    expect(tags).toContain('16:9');
    expect(tags.some((t) => t?.includes('质量 高'))).toBe(true);

    app.unmount();
  });

  it('生成进行中：多图批量任务且尺寸为自动时，左上角保留张数角标但不展示尺寸', async () => {
    const task: GenerationTask = {
      id: 'task_batch_auto',
      type: 't2i',
      params: {
        model: 'gpt-image-2',
        prompt: '多图自动尺寸',
        type: 't2i',
        size: 'auto',
        resolution: 'auto',
        aspectRatio: 'auto',
        quality: 'medium',
        format: 'png',
        transparent: false,
        count: 4
      },
      status: 'processing',
      progress: 25,
      currentIndex: 2,
      elapsedSeconds: 5,
      durationFormatted: '5.0s',
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

    // 尺寸 pill 不存在，但张数 pill 存在且为 2/4
    expect(container.querySelector('.image-badge-overlay .size-pill')).toBeNull();
    const countPill = container.querySelector('.image-badge-overlay .count-pill');
    expect(countPill?.textContent).toBe('2/4');

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

  it('灯箱详情面板将内容放入独立滚动区，视口支持 pointer 拖拽', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useGalleryStore();
    store.items = [createMockAsset(1, '可拖拽作品')];

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

    expect(container.querySelector('.info-scroll')).not.toBeNull();
    expect(container.querySelector('.modal-image-panel')).not.toBeNull();
    expect(container.querySelector('.modal-actions')).not.toBeNull();

    app.unmount();
  });

  it('ArtworkCard 和 TaskCard 不在 card-tags 中显示批量 tag，而在 image-badge-overlay 显示共 N 张', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const asset1 = createMockAsset(1, '第一张');
    const asset2 = createMockAsset(2, '第二张');
    const batch = {
      id: 'batch_test_1',
      prompt: '多张测试',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'medium',
      duration: '2.0s',
      timestamp: Date.now(),
      assets: [asset1, asset2]
    };

    const app = createApp({
      render() {
        return h(ArtworkCard, { batch });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    // 验证 card-tags 里没有 batch-tag
    expect(container.querySelector('.card-tags .batch-tag')).toBeNull();
    // 验证 image-badge-overlay 里有 count-pill
    const countPill = container.querySelector('.image-badge-overlay .count-pill');
    expect(countPill).not.toBeNull();
    expect(countPill?.textContent).toBe('共 2 张');

    // 验证右上角小圆点切换菜单已移除，只保留底部精简切换条
    expect(container.querySelector('.carousel-dots-wrap')).toBeNull();
    const carouselNav = container.querySelector('.carousel-nav-overlay');
    expect(carouselNav).not.toBeNull();
    expect(container.querySelector('.carousel-counter')?.textContent).toBe('1 / 2');

    // 点击下一张切换图片
    const nextBtn = container.querySelector('.carousel-arrow.right-arrow') as HTMLButtonElement;
    nextBtn.click();
    await nextTick();
    expect(container.querySelector('.carousel-counter')?.textContent).toBe('2 / 2');

    app.unmount();
  });

  it('Lightbox 切换到失败资产时大图区域展示失败提示信息且下载按钮禁用', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const failedAsset: MediaAsset = {
      id: 999,
      url: '',
      blob: new Blob([]),
      prompt: '触发拦截的提示词',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'medium',
      duration: '1.5s',
      timestamp: Date.now(),
      status: 'failed',
      errorMessage: '生图失败: [内容安全审核拦截] 您的请求无法用于生成图像。'
    };

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: failedAsset,
          allAssets: [failedAsset]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    // 大图区域应显示失败标题和详细信息
    expect(container.querySelector('.viewport-failed-stage')).not.toBeNull();
    expect(container.querySelector('.failed-title')?.textContent).toBe('安全拦截');
    expect(container.querySelector('.failed-message')?.textContent).toContain('内容安全审核拦截');

    // 详情面板应显示失败提示条
    expect(container.querySelector('.failed-alert-banner')).not.toBeNull();
    expect(container.querySelector('.alert-headline')?.textContent).toBe('安全拦截');

    // 下载按钮应处于 disabled 状态
    const downloadBtn = container.querySelector('.modal-actions .btn-primary') as HTMLButtonElement;
    expect(downloadBtn.disabled).toBe(true);
    expect(downloadBtn.textContent).toContain('未生成成功');

    app.unmount();
  });

  it('灯箱详情只展示输入框发送的原始提示词，不展示模型优化后的生图提示词', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const asset = createMockAsset(1, '一只坐在窗边的橘猫');
    asset.revisedPrompt = 'A highly detailed orange tabby cat sitting by a sunlit window, cinematic lighting';

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: asset,
          allAssets: [asset]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const promptText = container.querySelector('.prompt-box')?.textContent ?? '';
    expect(promptText).toContain('一只坐在窗边的橘猫');
    expect(promptText).not.toContain('highly detailed orange tabby');
    expect(container.textContent).not.toContain('模型优化提示词');
    expect(container.textContent).not.toContain(asset.revisedPrompt);

    app.unmount();
  });

  it('工具栏应单独包含左转、右转、重置视图和全屏切换按钮，支持分别向左/向右旋转', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const asset = createMockAsset(1, '测试旋转图片');

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: asset,
          allAssets: [asset]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const toolbar = container.querySelector('.image-floating-toolbar');
    expect(toolbar).not.toBeNull();

    // 检查按钮工具提示与存在性
    const rotateCcwBtn = toolbar?.querySelector('[data-tip*="向左旋转"]') as HTMLButtonElement;
    const rotateCwBtn = toolbar?.querySelector('[data-tip*="向右旋转"]') as HTMLButtonElement;
    const resetViewBtn = toolbar?.querySelector('[data-tip*="重置视图"]') as HTMLButtonElement;
    const fullscreenBtn = toolbar?.querySelector('[data-tip*="全屏"]') as HTMLButtonElement;

    expect(rotateCcwBtn).not.toBeNull();
    expect(rotateCwBtn).not.toBeNull();
    expect(resetViewBtn).not.toBeNull();
    expect(fullscreenBtn).not.toBeNull();
    expect(fullscreenBtn.getAttribute('data-tip')).toBe('全屏显示');

    const img = container.querySelector('.image-stage img') as HTMLImageElement;
    expect(img.style.transform).toContain('rotate(0deg)');

    // 点击向左旋转 90° -> 270°
    rotateCcwBtn.click();
    await nextTick();
    expect(img.style.transform).toContain('rotate(270deg)');

    // 点击向右旋转 90° -> 0°
    rotateCwBtn.click();
    await nextTick();
    expect(img.style.transform).toContain('rotate(0deg)');

    // 再次向右旋转 90° -> 90°
    rotateCwBtn.click();
    await nextTick();
    expect(img.style.transform).toContain('rotate(90deg)');

    app.unmount();
  });

  it('点击全屏按钮后进入全屏模式，右上角显示关闭X按钮且右侧面板隐藏，点击X或按Esc退出全屏', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const asset = createMockAsset(1, '测试全屏模式图片');
    let closed = false;

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: asset,
          allAssets: [asset],
          onClose: () => {
            closed = true;
          }
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const backdrop = container.querySelector('.modal-backdrop') as HTMLDivElement;
    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;
    const fullscreenBtn = toolbar.querySelector('[data-tip*="全屏"]') as HTMLButtonElement;

    expect(backdrop.classList.contains('is-fullscreen')).toBe(false);
    expect(container.querySelector('.fullscreen-close-btn')).toBeNull();

    // 点击进入全屏
    fullscreenBtn.click();
    await nextTick();

    expect(backdrop.classList.contains('is-fullscreen')).toBe(true);
    const fullscreenCloseBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(fullscreenCloseBtn).not.toBeNull();
    expect(fullscreenCloseBtn.getAttribute('data-tip')).toContain('退出全屏');
    // 全屏模式下原弹窗关闭按钮应隐藏，确保右上角仅有一个 X 按钮，不会出现两个 X 挨着
    expect(container.querySelector('.modal-close-btn')).toBeNull();

    // 全屏模式下右侧面板不可见
    const detailPanel = container.querySelector('.modal-info-panel') as HTMLElement;
    expect(detailPanel.style.display).toBe('none');

    // 按 Escape 键应当退出全屏，而不应直接关闭整个灯箱弹窗
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escEvent);
    await nextTick();

    expect(backdrop.classList.contains('is-fullscreen')).toBe(false);
    expect(container.querySelector('.fullscreen-close-btn')).toBeNull();
    expect(closed).toBe(false);

    // 再次点击进入全屏，然后通过右上角 X 按钮退出
    fullscreenBtn.click();
    await nextTick();
    expect(backdrop.classList.contains('is-fullscreen')).toBe(true);

    const closeXBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    closeXBtn.click();
    await nextTick();
    expect(backdrop.classList.contains('is-fullscreen')).toBe(false);
    expect(container.querySelector('.modal-close-btn')).not.toBeNull();

    // 非全屏状态下按 Escape 键应当关闭灯箱弹窗
    const closeEscEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(closeEscEvent);
    await nextTick();
    expect(closed).toBe(true);

    app.unmount();
  });

  it('全屏模式下支持滚轮对鼠标位置进行缩放', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const asset = createMockAsset(1, '测试鼠标缩放图片');

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: asset,
          allAssets: [asset]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const imagePanel = container.querySelector('.modal-image-panel') as HTMLDivElement;
    const fullscreenBtn = container.querySelector('.image-floating-toolbar [data-tip*="全屏"]') as HTMLButtonElement;

    // 进入全屏模式
    fullscreenBtn.click();
    await nextTick();

    // 模拟 getBoundingClientRect
    imagePanel.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    const imageStage = container.querySelector('.image-stage') as HTMLDivElement;
    expect(imageStage.style.transform).toContain('scale(1)');

    // 针对偏右上的鼠标坐标 (clientX: 800, clientY: 200) 触发向下/向上滚动
    const wheelEvent = new WheelEvent('wheel', {
      clientX: 800,
      clientY: 200,
      deltaY: -100, // 放大
      bubbles: true,
      cancelable: true
    });
    imagePanel.dispatchEvent(wheelEvent);
    await nextTick();

    // 缩放后 scale 大于 1，且 translateX/translateY 产生了以 (800, 200) 为锚点的偏移
    expect(imageStage.style.transform).not.toContain('scale(1)');
    const transformStr = imageStage.style.transform;
    const matchScale = transformStr.match(/scale\(([^)]+)\)/);
    expect(matchScale).not.toBeNull();
    const newScale = parseFloat(matchScale![1]);
    expect(newScale).toBeGreaterThan(1);

    // 验证 translateX 和 translateY 不是 0 (鼠标在偏离中心处，因此平移向量发生移动)
    const matchTranslate = transformStr.match(/translate\(([^p]+)px,\s*([^p]+)px\)/);
    expect(matchTranslate).not.toBeNull();
    const transX = parseFloat(matchTranslate![1]);
    const transY = parseFloat(matchTranslate![2]);
    expect(transX).not.toBe(0);
    expect(transY).not.toBe(0);

    app.unmount();
  });

  it('当通用设置中配置为整个电脑屏幕全屏(native)时，点击全屏触发原生 requestFullscreen', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const configStore = useConfigStore();
    configStore.updateGeneralConfig({
      previewFullscreenMode: 'native'
    });

    let requestFullscreenCalled = false;
    let exitFullscreenCalled = false;

    // 模拟 document 原生全屏 API
    const originalRequestFullscreen = document.documentElement.requestFullscreen;
    const originalExitFullscreen = document.exitFullscreen;
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });

    document.documentElement.requestFullscreen = async () => {
      requestFullscreenCalled = true;
      Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
    };
    document.exitFullscreen = async () => {
      exitFullscreenCalled = true;
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    };

    const asset = createMockAsset(1, '测试原生全屏图片');

    const app = createApp({
      render() {
        return h(LightboxModal, {
          item: asset,
          allAssets: [asset]
        });
      }
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const toolbar = container.querySelector('.image-floating-toolbar') as HTMLDivElement;
    const fullscreenBtn = toolbar.querySelector('[data-tip*="全屏"]') as HTMLButtonElement;

    // 点击进入全屏
    fullscreenBtn.click();
    await nextTick();

    expect(requestFullscreenCalled).toBe(true);
    const closeXBtn = container.querySelector('.fullscreen-close-btn') as HTMLButtonElement;
    expect(closeXBtn).not.toBeNull();

    // 点击退出全屏
    closeXBtn.click();
    await nextTick();
    expect(exitFullscreenCalled).toBe(true);

    // 恢复原型
    if (originalRequestFullscreen) {
      document.documentElement.requestFullscreen = originalRequestFullscreen;
    }
    if (originalExitFullscreen) {
      document.exitFullscreen = originalExitFullscreen;
    }
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

    app.unmount();
  });
});
