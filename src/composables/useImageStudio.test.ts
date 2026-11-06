import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, effectScope, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useImageStudio } from './useImageStudio';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';
import { useConfigStore } from '@/stores/configStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useModelStore } from '@/stores/modelStore';
import App from '@/App.vue';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import type { GenerationTask, TaskGenerationParams } from '@/types/task';

vi.spyOn(defaultTaskScheduler, 'execute').mockResolvedValue([]);

describe('useImageStudio - reuseItem (统一生图设定复用)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('初始化时 format 默认应为 jpeg，审核 moderation 默认应为 low', () => {
    const studio = useImageStudio();
    expect(studio.format.value).toBe('jpeg');
    expect(studio.moderation.value).toBe('low');
  });

  it('应该正确从 MediaAsset 中恢复生图设定参数，而非实际结果尺寸', async () => {
    const studio = useImageStudio();

    const mockAsset: MediaAsset = {
      id: 1,
      batchId: 'batch-1',
      url: 'blob:http://localhost/test',
      blob: new Blob(['test'], { type: 'image/png' }),
      prompt: '原始用户提示词：赛博朋克猫咪',
      revisedPrompt: '模型扩写提示词：A highly detailed cyberpunk neon cat in Tokyo...',
      model: 'gpt-image-2',
      // 生图设定: 2K, 16:9, auto
      targetResolution: '2k',
      targetRatio: '16:9',
      targetSize: 'auto',
      // 实际结果: 2048x1152, 16:9
      size: '2048×1152',
      ratio: '16:9',
      width: 2048,
      height: 1152,
      quality: 'hd',
      format: 'png',
      transparent: true,
      moderation: 'auto',
      duration: '3.2s',
      timestamp: Date.now(),
      type: 't2i'
    };

    await studio.reuseItem(mockAsset);

    // 1. 提示词必须恢复为用户输入的原始提示词，绝非 revisedPrompt
    expect(studio.prompt.value).toBe('原始用户提示词：赛博朋克猫咪');

    // 2. 尺寸状态必须精准恢复为生图设定的 2K + 16:9 (width/height 保持为 null)
    expect(studio.resolution.value).toBe('2k');
    expect(studio.aspectRatio.value).toBe('16:9');
    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();

    // 3. 画质、透明度、审核与格式
    expect(studio.quality.value).toBe('hd');
    expect(studio.transparent.value).toBe(true);
    expect(studio.moderation.value).toBe('auto');
    expect(studio.format.value).toBe('png');
  });

  it('应该正确从 GenerationTask 与 TaskGenerationParams 中恢复生图设定', async () => {
    const studio = useImageStudio();

    const mockTask: GenerationTask = {
      id: 'task-123',
      type: 't2i',
      status: 'failed',
      progress: 0,
      currentIndex: 1,
      elapsedSeconds: 0,
      durationFormatted: '0.0s',
      resultAssetIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      params: {
        model: 'gpt-image-2',
        prompt: '测试任务提示词',
        type: 't2i',
        size: 'auto',
        resolution: '4k',
        aspectRatio: '9:16',
        quality: 'medium',
        format: 'jpeg',
        transparent: false,
        count: 2
      }
    };

    await studio.reuseItem(mockTask);

    expect(studio.prompt.value).toBe('测试任务提示词');
    expect(studio.resolution.value).toBe('4k');
    expect(studio.aspectRatio.value).toBe('9:16');
    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();
    expect(studio.quality.value).toBe('medium');
    expect(studio.format.value).toBe('jpeg');
    expect(studio.transparent.value).toBe(false);
    expect(studio.count.value).toBe(2);
  });

  it('复用未注册的生图模型时应切换到该模型', async () => {
    const studio = useImageStudio();
    const { useModelStore } = await import('@/stores/modelStore');
    const modelStore = useModelStore();

    const mockAsset: MediaAsset = {
      id: 1,
      batchId: 'batch-1',
      url: 'blob:http://localhost/test',
      blob: new Blob(['test'], { type: 'image/png' }),
      prompt: 'flare 模型作品',
      model: 'gpt-image-2.5-flare',
      targetResolution: '1k',
      targetRatio: '1:1',
      targetSize: 'auto',
      size: '1024×1024',
      ratio: '1:1',
      width: 1024,
      height: 1024,
      quality: 'high',
      format: 'png',
      transparent: false,
      duration: '2.0s',
      timestamp: Date.now(),
      type: 't2i'
    };

    await studio.reuseItem(mockAsset);

    expect(modelStore.activeModelId).toBe('gpt-image-2.5-flare');
  });

  it('应该正确从 ArtworkBatch 恢复参数并还原张数', async () => {
    const studio = useImageStudio();

    const mockBatch: ArtworkBatch = {
      id: 'batch-999',
      batchId: 'batch-999',
      prompt: '多图批次提示词',
      model: 'gpt-image-2',
      targetResolution: 'auto',
      targetRatio: 'auto',
      targetSize: 'auto',
      size: '1024×1024',
      ratio: '1:1',
      width: 1024,
      height: 1024,
      quality: 'high',
      format: 'webp',
      transparent: false,
      duration: '5.1s',
      timestamp: Date.now(),
      type: 't2i',
      assets: [
        {
          id: 101,
          url: '',
          blob: new Blob(),
          prompt: '多图批次提示词',
          model: 'gpt-image-2',
          size: '1024×1024',
          quality: 'high',
          duration: '5.1s',
          timestamp: Date.now()
        },
        {
          id: 102,
          url: '',
          blob: new Blob(),
          prompt: '多图批次提示词',
          model: 'gpt-image-2',
          size: '1024×1024',
          quality: 'high',
          duration: '5.1s',
          timestamp: Date.now()
        }
      ]
    };

    await studio.reuseItem(mockBatch);

    expect(studio.prompt.value).toBe('多图批次提示词');
    expect(studio.resolution.value).toBe('auto');
    expect(studio.aspectRatio.value).toBe('auto');
    expect(studio.quality.value).toBe('high');
    expect(studio.format.value).toBe('webp');
    expect(studio.count.value).toBe(2);
  });

  it('复用文生图任务时应该清空原有的参考图', async () => {
    const studio = useImageStudio();

    // 预先添加一张参考图
    const dummyFile = new File(['dummy'], 'test.png', { type: 'image/png' });
    studio.addReferenceImages([dummyFile]);
    expect(studio.referenceImages.value.length).toBe(1);

    const t2iParams: TaskGenerationParams = {
      model: 'gpt-image-2',
      prompt: '纯文生图',
      type: 't2i',
      size: 'auto',
      resolution: '1k',
      aspectRatio: '1:1',
      quality: 'medium',
      format: 'png',
      transparent: false,
      count: 1
    };

    await studio.reuseItem(t2iParams);

    // 参考图应当被自动清空，完全还原文生图设定
    expect(studio.referenceImages.value.length).toBe(0);
    expect(studio.prompt.value).toBe('纯文生图');
  });
});

describe('useImageStudio - prompt batches', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(defaultTaskScheduler.execute).mockClear();
  });

  async function configuredStudio() {
    const { useConfigStore } = await import('@/stores/configStore');
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test'
    });
    return useImageStudio();
  }

  it('连续两个空行分隔的多段提示词应分别创建任务，数量作为每批张数', async () => {
    const studio = await configuredStudio();
    studio.prompt.value = '一只猫\n\n\n一只狗';
    studio.count.value = 2;

    const tasks = await studio.generate();

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.params.prompt)).toEqual(['一只猫', '一只狗']);
    expect(tasks.every((t) => t.params.count === 2)).toBe(true);
    expect(defaultTaskScheduler.execute).toHaveBeenCalledTimes(2);
  });

  it('单换行或单个空行的提示词仍作为单个任务', async () => {
    const studio = await configuredStudio();
    studio.prompt.value = '一只猫\n\n站在屋顶';
    studio.count.value = 3;

    const tasks = await studio.generate();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].params.prompt).toBe('一只猫\n\n站在屋顶');
    expect(tasks[0].params.count).toBe(3);
    expect(defaultTaskScheduler.execute).toHaveBeenCalledTimes(1);
  });

  it('三段提示词应创建三个独立任务并共享其余参数', async () => {
    const studio = await configuredStudio();
    studio.prompt.value = '日出\n\n\n海边\n\n\n城市夜景';
    studio.count.value = 1;
    studio.quality.value = 'high';

    const tasks = await studio.generate();

    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.params.prompt)).toEqual(['日出', '海边', '城市夜景']);
    expect(tasks.every((t) => t.params.quality === 'high')).toBe(true);
    expect(tasks.every((t) => t.params.count === 1)).toBe(true);
  });
});

describe('useImageStudio - clearPromptOnGenerate', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('默认不清空输入框，当开启设置项后生成时清空输入框', async () => {
    const { useConfigStore } = await import('@/stores/configStore');
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test'
    });

    const studio = useImageStudio();

    // 1. 默认情况下：clearPromptOnGenerate 为 false，生成后提示词应当保留
    expect(configStore.clearPromptOnGenerate).toBe(false);
    studio.prompt.value = '赛博朋克霓虹猫咪';
    await studio.generate();
    expect(studio.prompt.value).toBe('赛博朋克霓虹猫咪');

    // 2. 开启 clearPromptOnGenerate 开关：生成后应当自动清空提示词
    configStore.updateGeneralConfig({ clearPromptOnGenerate: true });
    expect(configStore.clearPromptOnGenerate).toBe(true);

    studio.prompt.value = '下一只赛博猫咪';
    await studio.generate();
    expect(studio.prompt.value).toBe('');
  });
});

describe('useImageStudio - reference aspect ratio option', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('没有上传参考图时选择同参考图，效果与 auto 保持一致', () => {
    const studio = useImageStudio();
    studio.resolution.value = '1k';
    studio.aspectRatio.value = 'reference';

    expect(studio.aspectRatio.value).toBe('reference');
    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();
  });

  it('已上传参考图且具备比例时，选择同参考图会按参考图比例计算尺寸', async () => {
    const studio = useImageStudio();
    studio.resolution.value = '1k';

    // 模拟添加一张 16:9 的参考图
    const dummyFile = new File(['dummy'], 'ref.png', { type: 'image/png' });
    studio.addReferenceImages([dummyFile]);
    expect(studio.referenceImages.value.length).toBe(1);

    // 人工赋予解析出的比例
    studio.referenceImages.value[0].ratio = '16:9';

    studio.aspectRatio.value = 'reference';
    expect(studio.aspectRatio.value).toBe('reference');
    expect(studio.sizeWidth.value).toBe(1024);
    expect(studio.sizeHeight.value).toBe(576);

    // 移除参考图后，自动重置尺寸锁定
    studio.clearReferenceImages();
    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();
  });

  it('多张参考图时同参考图严格采用第一张参考图的比例，删除首张后切换至新的第一张', async () => {
    const studio = useImageStudio();
    studio.resolution.value = '1k';

    const file1 = new File(['dummy1'], 'ref1.png', { type: 'image/png' });
    const file2 = new File(['dummy2'], 'ref2.png', { type: 'image/png' });
    studio.addReferenceImages([file1, file2]);
    expect(studio.referenceImages.value.length).toBe(2);

    // 第一张 16:9，第二张 4:3
    studio.referenceImages.value[0].ratio = '16:9';
    studio.referenceImages.value[1].ratio = '4:3';

    studio.aspectRatio.value = 'reference';
    // 必须与第一张 16:9 相同 (1024x576)
    expect(studio.sizeWidth.value).toBe(1024);
    expect(studio.sizeHeight.value).toBe(576);

    // 删除第一张参考图
    studio.removeReferenceImage(studio.referenceImages.value[0].id);
    expect(studio.referenceImages.value.length).toBe(1);

    // 现在第二张晋升为第一张 (4:3)，尺寸应自动同步为 1024x768
    expect(studio.sizeWidth.value).toBe(1024);
    expect(studio.sizeHeight.value).toBe(768);
  });

  it('未设置尺寸时，点开尺寸(materialize)或直接生成，均自动使用满足分辨率上限的最大尺寸', async () => {
    const { useConfigStore } = await import('@/stores/configStore');
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-test'
    });

    const studio = useImageStudio();
    studio.resolution.value = '2k';
    studio.aspectRatio.value = 'reference';
    studio.setSizeAuto(); // 确保此时未设置尺寸 (auto)

    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();

    // 上传 1920x1080 (16:9) 参考图
    const refFile = new File(['dummy'], 'ref.png', { type: 'image/png' });
    studio.addReferenceImages([refFile]);
    studio.referenceImages.value[0].width = 1920;
    studio.referenceImages.value[0].height = 1080;
    studio.referenceImages.value[0].ratio = '16:9';

    // 重新置为 auto 状态以模拟未设置尺寸直接点击生成的场景
    studio.setSizeAuto();
    expect(studio.sizeWidth.value).toBeNull();
    expect(studio.sizeHeight.value).toBeNull();

    // 1. 测试直接生成: 自动使用 2K 上限下的最大尺寸 2048x1152
    studio.prompt.value = '测试画面描述';
    const tasks = await studio.generate();
    expect(tasks.length).toBe(1);
    expect(tasks[0].params.size).toBe('2048x1152');
    expect(tasks[0].params.resolution).toBe('2k');

    // 2. 测试点开尺寸 (materializeImageSize): 自动填充 2048 与 1152
    await studio.materializeImageSize();
    expect(studio.sizeWidth.value).toBe(2048);
    expect(studio.sizeHeight.value).toBe(1152);
  });
});

describe('useImageStudio - 参考图资源与错误反馈', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    useConfigStore().updateConfig({ baseUrl: 'https://api.example.com', apiKey: 'test-key' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createReferenceAsset(referenceImages: string[]): MediaAsset {
    return {
      id: 1,
      url: 'https://images.example.com/result.png',
      blob: new Blob(['image'], { type: 'image/png' }),
      prompt: '复用的提示词',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'medium',
      duration: '1.0s',
      timestamp: Date.now(),
      referenceImages
    };
  }

  it('生成任务在首张尺寸补齐后克隆参考图元数据，避免与输入区共享对象', async () => {
    const studio = useImageStudio();
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    studio.addReferenceImages([file]);
    studio.prompt.value = '参考图创作';
    const [task] = await studio.generate();
    const snapshot = task.params.referenceImages?.[0];

    expect(snapshot).not.toBe(studio.referenceImages.value[0]);
    expect(snapshot?.file).toBe(file);
    expect(snapshot?.width).toBe(1024);
    expect(snapshot?.height).toBe(1024);
    expect(snapshot?.ratio).toBe('1:1');
    studio.referenceImages.value[0].ratio = '16:9';
    expect(snapshot?.ratio).toBe('1:1');
    studio.clearReferenceImages();
  });

  it('从输入区移除参考图后，复用任务依据 File 重建可用预览地址', async () => {
    const studio = useImageStudio();
    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    studio.addReferenceImages([file]);
    studio.prompt.value = '参考图创作';
    const [task] = await studio.generate();
    const snapshot = task.params.referenceImages?.[0];
    const oldUrl = snapshot?.previewUrl;
    studio.removeReferenceImage(studio.referenceImages.value[0].id);

    await studio.reuseItem(task);

    expect(studio.referenceImages.value).toHaveLength(1);
    expect(studio.referenceImages.value[0].file).toBe(file);
    expect(studio.referenceImages.value[0].previewUrl).not.toBe(oldUrl);
    expect(studio.referenceImages.value[0]).not.toBe(snapshot);
    studio.clearReferenceImages();
  });

  it('连续复用同一任务时每次创建独立预览并释放旧输入区地址', async () => {
    const studio = useImageStudio();
    studio.addReferenceImages([new File(['image'], 'reference.png', { type: 'image/png' })]);
    studio.prompt.value = '参考图创作';
    const [task] = await studio.generate();
    const originalUrl = studio.referenceImages.value[0].previewUrl;
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    try {
      await studio.reuseItem(task);
      const firstUrl = studio.referenceImages.value[0].previewUrl;
      await studio.reuseItem(task);
      const secondUrl = studio.referenceImages.value[0].previewUrl;

      expect(new Set([originalUrl, firstUrl, secondUrl]).size).toBe(3);
      expect(revoke).toHaveBeenCalledWith(originalUrl);
      expect(revoke).toHaveBeenCalledWith(firstUrl);
      expect(revoke).not.toHaveBeenCalledWith(secondUrl);
      studio.clearReferenceImages();
      expect(revoke).toHaveBeenCalledWith(secondUrl);
    } finally {
      revoke.mockRestore();
    }
  });

  it('工作台作用域销毁时释放输入区持有的预览地址', () => {
    const scope = effectScope();
    const studio = scope.run(() => useImageStudio())!;
    studio.addReferenceImages([new File(['image'], 'reference.png', { type: 'image/png' })]);
    const url = studio.referenceImages.value[0].previewUrl;
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    try {
      scope.stop();
      expect(revoke).toHaveBeenCalledWith(url);
    } finally {
      revoke.mockRestore();
    }
  });

  it('参考图请求失败时向调用方抛出 HTTP 状态且不加入输入区', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    const studio = useImageStudio();

    await expect(studio.useImageAsReference('https://images.example.com/ref.png')).rejects.toThrow('HTTP 503');
    expect(studio.referenceImages.value).toHaveLength(0);
  });

  it('参考图网络失败时给出可理解的读取失败信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const studio = useImageStudio();

    await expect(studio.useImageAsReference('https://images.example.com/ref.png')).rejects.toThrow('无法读取参考图');
    expect(studio.referenceImages.value).toHaveLength(0);
  });

  it('图片响应体读取失败时给出中文错误，不加入参考图', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: vi.fn().mockRejectedValue(new TypeError('terminated'))
    }));
    const studio = useImageStudio();

    await expect(studio.useImageAsReference('https://images.example.com/ref.png')).rejects.toThrow('图片内容读取失败');
    expect(studio.referenceImages.value).toHaveLength(0);
  });

  it('作用域销毁后才完成的参考图读取会释放预览而非写回已关闭工作台', async () => {
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));
    const scope = effectScope();
    const studio = scope.run(() => useImageStudio())!;
    const pending = studio.useImageAsReference('https://images.example.com/ref.png');
    scope.stop();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    try {
      resolveResponse(new Response(new Blob(['image'], { type: 'image/png' })));
      await expect(pending).rejects.toThrow('工作台已关闭');
      expect(studio.referenceImages.value).toHaveLength(0);
      expect(revoke).toHaveBeenCalledOnce();
    } finally {
      revoke.mockRestore();
    }
  });

  it.each([
    new Blob(['not an image'], { type: 'application/json' }),
    new Blob([], { type: 'image/png' })
  ])('非图片响应和空图片不能作为参考图加入', async (blob) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(blob)));
    const studio = useImageStudio();

    await expect(studio.useImageAsReference('https://images.example.com/ref.png')).rejects.toThrow('不是有效的图片');
    expect(studio.referenceImages.value).toHaveLength(0);
  });

  it('声明为图片但无法解码时抛错并释放临时预览地址', async () => {
    class InvalidImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', InvalidImage);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['broken'], { type: 'image/png' }))));
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const studio = useImageStudio();

    try {
      await expect(studio.useImageAsReference('https://images.example.com/ref.png')).rejects.toThrow('无法解码');
      expect(studio.referenceImages.value).toHaveLength(0);
      expect(revoke).toHaveBeenCalledOnce();
    } finally {
      revoke.mockRestore();
    }
  });

  it('成功读取参考图后加入已解析尺寸的独立预览', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }))));
    const studio = useImageStudio();

    await studio.useImageAsReference('https://images.example.com/ref.png');

    expect(studio.referenceImages.value).toHaveLength(1);
    expect(studio.referenceImages.value[0].width).toBe(1024);
    expect(studio.referenceImages.value[0].ratio).toBe('1:1');
    studio.clearReferenceImages();
  });

  it('复用作品恢复参考图失败时保留原输入并释放已准备的预览', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/png' })))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 })));
    const studio = useImageStudio();
    studio.prompt.value = '原输入';
    studio.addReferenceImages([new File(['original'], 'original.png', { type: 'image/png' })]);
    const originalUrl = studio.referenceImages.value[0].previewUrl;
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    try {
      await expect(studio.reuseItem(createReferenceAsset([
        'https://images.example.com/first.png',
        'https://images.example.com/second.png'
      ]))).rejects.toThrow('HTTP 503');
      expect(studio.prompt.value).toBe('原输入');
      expect(studio.referenceImages.value[0].previewUrl).toBe(originalUrl);
      expect(revoke).toHaveBeenCalledOnce();
      expect(revoke).not.toHaveBeenCalledWith(originalUrl);
      studio.clearReferenceImages();
    } finally {
      revoke.mockRestore();
    }
  });

  it('复用作品可恢复本地 Data URL 参考图，并释放旧输入区预览', async () => {
    const studio = useImageStudio();
    studio.addReferenceImages([new File(['original'], 'original.png', { type: 'image/png' })]);
    const originalUrl = studio.referenceImages.value[0].previewUrl;

    await studio.reuseItem(createReferenceAsset(['data:image/png;base64,aW1hZ2U=']));

    expect(studio.prompt.value).toBe('复用的提示词');
    expect(studio.referenceImages.value).toHaveLength(1);
    expect(studio.referenceImages.value[0].previewUrl).not.toBe(originalUrl);
    expect(studio.referenceImages.value[0].file.type).toBe('image/png');
    studio.clearReferenceImages();
  });
});

describe('App - 参考图操作反馈', () => {
  let pinia: ReturnType<typeof createPinia>;
  let app: ReturnType<typeof createApp> | null;
  let container: HTMLDivElement;
  let loadGallery: ReturnType<typeof vi.spyOn>;
  let refreshModels: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    app = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    const galleryStore = useGalleryStore();
    loadGallery = vi.spyOn(galleryStore, 'loadGallery').mockResolvedValue();
    refreshModels = vi.spyOn(useModelStore(), 'refreshAvailableModels').mockResolvedValue();
    galleryStore.items = [{
      id: 1,
      url: 'https://images.example.com/result.png',
      blob: new Blob(['image'], { type: 'image/png' }),
      prompt: '测试作品',
      model: 'gpt-image-2',
      size: '1024x1024',
      quality: 'medium',
      duration: '1.0s',
      timestamp: Date.now()
    }];
  });

  afterEach(() => {
    app?.unmount();
    container.remove();
    loadGallery.mockRestore();
    refreshModels.mockRestore();
    vi.unstubAllGlobals();
  });

  it('未配置时发起生成直接打开设置，并保留已经输入的描述', async () => {
    app = createApp(App);
    app.use(pinia);
    app.mount(container);
    await nextTick();
    const textarea = container.querySelector('textarea')!;
    textarea.value = '准备生成的画面';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    (container.querySelector('.btn-send') as HTMLButtonElement).click();
    await nextTick();

    expect(container.querySelector('#settings-title')?.textContent).toBe('设置');
    expect(container.textContent).not.toContain('未配置生图 API Key');
    expect(textarea.value).toBe('准备生成的画面');
  });
  it('复用作品的参考图恢复失败时只提示错误，不提示复用成功', async () => {
    useGalleryStore().items[0].referenceImages = ['https://images.example.com/reference.png'];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    app = createApp(App);
    app.use(pinia);
    app.mount(container);
    await nextTick();
    const button = container.querySelector('[data-tip="复用提示词与参数"]') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => {
      expect(container.querySelector('.toast.error')?.textContent).toContain('HTTP 503');
      expect(container.textContent).not.toContain('已复用提示词与全部参数设置');
    });
  });

  it.each([503, 200])('以作品为参考图时按 HTTP %s 结果展示错误或成功反馈', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), { status })));
    app = createApp(App);
    app.use(pinia);
    app.mount(container);
    await nextTick();
    const button = container.querySelector('[data-tip="以此图为参考进行图生图编辑"]') as HTMLButtonElement;
    expect(button).not.toBeNull();
    button.click();
    await vi.waitFor(() => {
      if (status === 503) {
        expect(container.querySelector('.toast.error')?.textContent).toContain('HTTP 503');
        expect(container.textContent).not.toContain('已将选定图片加入参考图栏');
      } else {
        expect(container.querySelector('.toast.info')?.textContent).toContain('已将选定图片加入参考图栏');
        expect(container.querySelector('.toast.error')).toBeNull();
      }
    }, { timeout: 3000 });
  });
});
