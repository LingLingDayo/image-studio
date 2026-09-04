import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useImageStudio } from './useImageStudio';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import type { GenerationTask, TaskGenerationParams } from '@/types/task';

vi.spyOn(defaultTaskScheduler, 'execute').mockResolvedValue(undefined as any);

describe('useImageStudio - reuseItem (统一生图设定复用)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

    // 3. 画质、透明度与格式
    expect(studio.quality.value).toBe('hd');
    expect(studio.transparent.value).toBe(true);
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

