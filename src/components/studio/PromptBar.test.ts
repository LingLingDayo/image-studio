import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import PromptBar from './PromptBar.vue';
import type { ModelFormat } from '@/types/model';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import { WHEEL_ADJUST_TIP } from '@/utils/wheelStep';

describe('PromptBar (src/components/studio/PromptBar.vue)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  const defaultProps = {
    prompt: '',
    resolution: '1k' as const,
    aspectRatio: '1:1',
    sizeWidth: null,
    sizeHeight: null,
    quality: 'standard' as const,
    format: 'jpeg' as const,
    transparent: false,
    moderation: 'low' as const,
    count: 1,
    referenceImages: [],
    isGenerating: false,
    elapsedTime: '0s'
  };

  it('输入区使用简短引导，关键操作保留可访问名称', async () => {
    const app = createApp(() => h(PromptBar, { ...defaultProps, quality: 'medium' }));
    app.mount(container);
    await nextTick();
    const textarea = container.querySelector('textarea')!;
    expect(textarea.placeholder.length).toBeLessThanOrEqual(30);
    expect(textarea.getAttribute('aria-label')).toBe('画面描述');
    expect(container.querySelector('.btn-clip')?.getAttribute('aria-label')).toBe('添加参考图');
    expect(container.querySelector('.btn-send')?.getAttribute('aria-label')).toBe('生成图片');
    app.unmount();
  });
  it('未配置优化模型时默认显示 AI 优化按钮，但处于 disabled 状态且 tooltip 提示配置 key', async () => {
    const configStore = useConfigStore();
    // 确保未配置
    configStore.updateOptimizerConfig({ apiKey: '', baseUrl: '' });

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '测试提示词'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const magicBtn = container.querySelector('.btn-magic') as HTMLButtonElement;
    expect(magicBtn).not.toBeNull();
    expect(magicBtn.disabled).toBe(true);
    expect(magicBtn.getAttribute('data-tip')).toBe('请先在「设置 -> 生图服务」中配置 API Key');

    app.unmount();
  });

  it('已配置优化模型但输入框为空时，AI 优化按钮禁用并提示输入提示词', async () => {
    const configStore = useConfigStore();
    configStore.updateOptimizerConfig({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-4o-mini'
    });

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: ''
        });
      }
    });

    app.mount(container);
    await nextTick();

    const magicBtn = container.querySelector('.btn-magic') as HTMLButtonElement;
    expect(magicBtn).not.toBeNull();
    expect(magicBtn.disabled).toBe(true);
    expect(magicBtn.getAttribute('data-tip')).toBe('请先输入提示词后再进行 AI 优化');

    app.unmount();
  });

  it('已配置优化模型且有输入提示词时，AI 优化按钮可用', async () => {
    const configStore = useConfigStore();
    configStore.updateOptimizerConfig({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-4o-mini'
    });

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只赛博朋克风格的猫咪'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const magicBtn = container.querySelector('.btn-magic') as HTMLButtonElement;
    expect(magicBtn).not.toBeNull();
    expect(magicBtn.disabled).toBe(false);
    expect(magicBtn.getAttribute('data-tip')).toBe('使用大模型智能优化提示词 (精准描写与AI易读)');
    expect(magicBtn.querySelector('span')).toBeNull();
    expect(magicBtn.querySelector('svg')).not.toBeNull();

    app.unmount();
  });

  it('正在进行提示词优化时，图标使用质感微光呼吸动效而不是旋转动效', async () => {
    const configStore = useConfigStore();
    configStore.updateOptimizerConfig({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-4o-mini'
    });

    let resolveOptimizer: (value: string) => void = () => {};
    const pendingPromise = new Promise<string>((resolve) => {
      resolveOptimizer = resolve;
    });
    vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(pendingPromise);

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只可爱的猫咪'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const magicBtn = container.querySelector('.btn-magic') as HTMLButtonElement;
    const svgIconBefore = magicBtn.querySelector('svg');
    expect(svgIconBefore?.classList.contains('magic-sparkle-active')).toBe(false);
    expect(svgIconBefore?.classList.contains('spin-icon')).toBe(false);

    // 触发优化
    magicBtn.click();
    await nextTick();

    expect(magicBtn.classList.contains('is-optimizing')).toBe(true);
    const svgIconDuring = magicBtn.querySelector('svg');
    expect(svgIconDuring?.classList.contains('magic-sparkle-active')).toBe(true);
    expect(svgIconDuring?.classList.contains('spin-icon')).toBe(false);

    // 完成优化
    resolveOptimizer('一只毛茸茸的英短银渐层幼猫，在温暖阳光下安静打盹');
    await pendingPromise;
    await nextTick();

    expect(magicBtn.classList.contains('is-optimizing')).toBe(false);
    const svgIconAfter = magicBtn.querySelector('svg');
    expect(svgIconAfter?.classList.contains('magic-sparkle-active')).toBe(false);

    app.unmount();
  });

  it('模型优化提示词后不展示撤销按钮，但支持按 Ctrl+Z 回退提示词', async () => {
    const configStore = useConfigStore();
    configStore.updateOptimizerConfig({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-key',
      model: 'gpt-4o-mini'
    });

    vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockResolvedValue(
      '一只毛茸茸的英短银渐层幼猫，在温暖阳光下安静打盹'
    );

    const promptRef = ref('一只可爱的猫咪');

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: promptRef.value,
          'onUpdate:prompt': (val: string) => {
            promptRef.value = val;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const magicBtn = container.querySelector('.btn-magic') as HTMLButtonElement;
    magicBtn.click();
    await nextTick();
    await nextTick();

    // 确认优化后的提示词已经更新
    expect(promptRef.value).toBe('一只毛茸茸的英短银渐层幼猫，在温暖阳光下安静打盹');

    // 界面上不展示撤销按钮
    const restoreBtn = container.querySelector('.btn-restore-prompt');
    expect(restoreBtn).toBeNull();

    // 模拟按下 Ctrl+Z 回退
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(undoEvent);
    await nextTick();

    // 验证提示词成功回退为原词
    expect(promptRef.value).toBe('一只可爱的猫咪');
    expect(undoEvent.defaultPrevented).toBe(true);

    // 模拟按下 Ctrl+Y 重做恢复优化词
    const redoEvent = new KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(redoEvent);
    await nextTick();

    expect(promptRef.value).toBe('一只毛茸茸的英短银渐层幼猫，在温暖阳光下安静打盹');
    expect(redoEvent.defaultPrevented).toBe(true);

    app.unmount();
  });

  it('优化中编辑输入会中止请求，迟到结果不覆盖新的描述', async () => {
    useConfigStore().updateOptimizerConfig({ baseUrl: 'https://api.example.com', apiKey: 'test-key', model: 'model-a' });
    let resolveOptimizer!: (prompt: string) => void;
    const pending = new Promise<string>((resolve) => { resolveOptimizer = resolve; });
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(pending);
    service.mockClear();
    const prompt = ref('原始描述');
    const toast = vi.fn();
    const app = createApp(() => h(PromptBar, {
      ...defaultProps, quality: 'medium', prompt: prompt.value,
      'onUpdate:prompt': (value: string) => { prompt.value = value; }, onShowToast: toast
    }));
    app.mount(container);
    try {
      (container.querySelector('.btn-magic') as HTMLButtonElement).click();
      await nextTick();
      prompt.value = '手动编辑后的描述';
      await nextTick();
      expect(service.mock.calls[0][3]?.aborted).toBe(true);
      resolveOptimizer('过期优化结果');
      await pending;
      await nextTick();
      expect(prompt.value).toBe('手动编辑后的描述');
      expect(toast).not.toHaveBeenCalled();
    } finally {
      app.unmount();
      service.mockRestore();
    }
  });

  it('卸载提示词输入区时中止优化，迟到响应不再通知或修改输入', async () => {
    useConfigStore().updateOptimizerConfig({ baseUrl: 'https://api.example.com', apiKey: 'test-key', model: 'model-a' });
    let resolveOptimizer!: (prompt: string) => void;
    const pending = new Promise<string>((resolve) => { resolveOptimizer = resolve; });
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(pending);
    service.mockClear();
    const update = vi.fn();
    const toast = vi.fn();
    const app = createApp(() => h(PromptBar, {
      ...defaultProps, quality: 'medium', prompt: '原始描述', 'onUpdate:prompt': update, onShowToast: toast
    }));
    app.mount(container);
    (container.querySelector('.btn-magic') as HTMLButtonElement).click();
    await nextTick();
    app.unmount();
    try {
      expect(service.mock.calls[0][3]?.aborted).toBe(true);
      resolveOptimizer('迟到响应');
      await pending;
      await nextTick();
      expect(update).not.toHaveBeenCalled();
      expect(toast).not.toHaveBeenCalled();
    } finally {
      service.mockRestore();
    }
  });
  it('应在参数栏展示模型切换且默认选中 gpt-image-2.6-flare', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫'
        });
      }
    });

    app.mount(container);
    await nextTick();

    const labels = Array.from(container.querySelectorAll('.select-label')).map((el) => el.textContent);
    expect(labels[0]).toBe('模型');
    const modelSelect = container.querySelector('.params-group .ui-select') as HTMLElement;
    expect(modelSelect.classList.contains('is-truncated')).toBe(true);
    expect(modelSelect.style.maxWidth).toBe('150px');
    const modelValue = container.querySelector('.select-value')?.textContent;
    expect(modelValue).toBe('GPT-Image-2.6 Flare');
    const iconSelects = container.querySelectorAll('.params-group .ui-select.has-icon');
    expect(iconSelects.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll('.params-group .ui-select .select-arrow').length).toBe(0);
    expect(container.querySelector('.ui-size-input.has-icon')).not.toBeNull();
    expect(container.querySelector('.ui-stepper.has-icon')).not.toBeNull();

    app.unmount();
  });

  it('点击模型下拉时应请求当前 Key 的模型列表', async () => {
    const configStore = useConfigStore();
    configStore.updateConfig({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-test'
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gpt-image-2' }, { id: 'gpt-image-2.5-flare' }]
        })
    });
    globalThis.fetch = fetchMock;

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫'
        });
      }
    });

    app.mount(container);
    await vi.waitFor(() => {
      expect(useModelStore().isFetchingModels).toBe(false);
      expect(fetchMock).toHaveBeenCalled();
    });

    fetchMock.mockClear();

    const trigger = container.querySelector('.select-trigger') as HTMLButtonElement;
    trigger.click();
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(useModelStore().availableModels).toEqual(['gpt-image-2', 'gpt-image-2.5-flare']);

    app.unmount();
  });

  it('输入框通过占位文本与无障碍说明保留快捷生成与分批提示', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, defaultProps);
      }
    });

    app.mount(container);
    await nextTick();

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('描述想生成的画面，或拖入参考图');
    expect(textarea.placeholder).toContain('两个空行可分批生成');
    expect(textarea.placeholder.length).toBeLessThanOrEqual(30);
    expect(textarea.hasAttribute('data-tip')).toBe(false);
    expect(container.querySelector('.prompt-hint')).toBeNull();
    expect(textarea.getAttribute('aria-description')).toContain('连续两个空行分隔');

    app.unmount();
  });

  it('单段提示词或仅单个空行时数量控件文案为数量且展示默认滚轮提示', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫\n\n站在屋顶',
          count: 2
        });
      }
    });

    app.mount(container);
    await nextTick();

    const stepper = container.querySelector('.ui-stepper') as HTMLElement;
    expect(stepper.querySelector('.stepper-label')?.textContent).toBe('数量');
    expect(stepper.querySelector('.stepper-controls')?.getAttribute('data-tip')).toBe(
      WHEEL_ADJUST_TIP
    );

    app.unmount();
  });

  it('连续两个空行分隔多段提示词时数量控件切换为批量并展示批次说明', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫\n\n\n一只狗',
          count: 2
        });
      }
    });

    app.mount(container);
    await nextTick();

    const stepper = container.querySelector('.ui-stepper') as HTMLElement;
    expect(stepper.querySelector('.stepper-label')?.textContent).toBe('批量');
    expect(stepper.querySelector('.stepper-controls')?.getAttribute('data-tip')).toBe(
      '当前 2 个批次，每批生成 2 张，共 4 张'
    );
    expect(stepper.querySelector('.step-input')?.getAttribute('data-tip')).toBe(
      '当前 2 个批次，每批生成 2 张，共 4 张'
    );

    app.unmount();
  });

  it('三段提示词且每批 1 张时应正确反映批次数与总张数', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '日出\n\n\n海边\n\n\n城市',
          count: 1
        });
      }
    });

    app.mount(container);
    await nextTick();

    const stepper = container.querySelector('.ui-stepper') as HTMLElement;
    expect(stepper.querySelector('.stepper-label')?.textContent).toBe('批量');
    expect(stepper.querySelector('.stepper-controls')?.getAttribute('data-tip')).toBe(
      '当前 3 个批次，每批生成 1 张，共 3 张'
    );

    app.unmount();
  });

  it('点击参考图片缩略图时应触发 previewImage 事件，点击移除按钮触发 removeImage', async () => {
    let previewed: any = null;
    let removedId: string | null = null;

    const mockRefImg = {
      id: 'ref-1',
      file: new File([''], 'ref.png', { type: 'image/png' }),
      previewUrl: 'blob:http://localhost/ref-1'
    };

    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          referenceImages: [mockRefImg],
          onPreviewImage: (img: any) => {
            previewed = img;
          },
          onRemoveImage: (id: string) => {
            removedId = id;
          }
        });
      }
    });

    app.mount(container);
    await nextTick();

    const thumbnail = container.querySelector('.ref-thumbnail') as HTMLDivElement;
    expect(thumbnail).not.toBeNull();
    thumbnail.click();
    await nextTick();
    expect(previewed).toEqual(mockRefImg);

    // 验证不显示左下角序号与清空全部按钮
    expect(container.querySelector('.ref-index')).toBeNull();
    expect(container.querySelector('.ref-clear-all')).toBeNull();

    const deleteBtn = container.querySelector('.ref-delete-btn') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    await nextTick();
    expect(removedId).toBe('ref-1');

    app.unmount();
  });

  it('应该正确渲染背景控件与审核控件，审核默认值为低，背景默认值为默认', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps
        });
      }
    });

    app.mount(container);
    await nextTick();

    const triggerLabels = Array.from(container.querySelectorAll('.select-trigger')).map((el) =>
      el.textContent?.trim()
    );

    // 验证包含 背景 与 审核 标签触发器
    expect(triggerLabels.some((t) => t?.includes('背景'))).toBe(true);
    expect(triggerLabels.some((t) => t?.includes('审核'))).toBe(true);
    expect(triggerLabels.some((t) => t?.includes('审核') && t?.includes('低'))).toBe(true);
    expect(triggerLabels.some((t) => t?.includes('背景') && t?.includes('默认'))).toBe(true);

    app.unmount();
  });
});


describe('PromptBar 模型设置列表联动', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp> | undefined;
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  afterEach(() => { app?.unmount(); container.remove(); });
  const baseProps = { prompt: 'test', resolution: 'auto' as const, aspectRatio: 'auto', sizeWidth: null, sizeHeight: null,
    quality: 'medium' as const, format: 'jpeg' as const, transparent: false, count: 1, referenceImages: [], isGenerating: false, elapsedTime: '0s' };

  function findSelect(label: string): HTMLElement | undefined {
    return Array.from(container.querySelectorAll<HTMLElement>('.ui-select')).find((select) => select.querySelector('.select-label')?.textContent === label);
  }
  async function options(label: string): Promise<string[]> {
    const select = findSelect(label)!;
    if (!select.classList.contains('is-open')) {
      select.querySelector<HTMLButtonElement>('.select-trigger')!.click();
      await nextTick();
    }
    return Array.from(select.querySelectorAll('.item-label')).map((option) => option.textContent!.trim());
  }

  it('压缩使用短标签、步长 1 滑动条与避免误解的 hover 说明', async () => {
    const compression = ref<number | undefined>(undefined);
    const format = ref<ModelFormat>('jpeg');
    app = createApp(() => h(PromptBar, { ...baseProps, format: format.value, outputCompression: compression.value,
      'onUpdate:outputCompression': (value: number | undefined) => { compression.value = value; } }));
    app.mount(container);
    const label = container.querySelector<HTMLElement>('.slider-label')!;
    expect(label.textContent).toBe('压缩');
    expect(container.querySelector('.ui-slider svg')).toBeNull();
    expect(label.dataset.tip).toContain('非生图画质');
    expect(label.dataset.tip).toContain('不代表压缩掉 100%');
    expect(container.textContent).not.toContain('压缩质量');
    expect(container.querySelector('input[type="range"]')).toBeNull();
    container.querySelector<HTMLButtonElement>('.slider-trigger')!.click();
    await nextTick();
    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('100');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('100');
    expect(compression.value).toBeUndefined();
    slider.value = '63';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(compression.value).toBe(63);
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(compression.value).toBe(0);
    format.value = 'png';
    await nextTick();
    expect(container.querySelector('.ui-slider')).toBeNull();
    format.value = 'webp';
    await nextTick();
    expect(container.querySelector('.ui-slider')).not.toBeNull();
  });

  it('切换模型立即替换格式、画质和复杂度选项，未知模型使用旧列表', async () => {
    app = createApp(() => h(PromptBar, baseProps));
    app.mount(container);
    expect(await options('格式')).toEqual(['PNG', 'JPEG', 'WEBP', 'GIF', 'SVG']);
    expect(await options('质量')).toEqual(['自动', '低', '中', '高', '极高', '最高']);
    expect(findSelect('复杂度')).toBeDefined();
    useModelStore().setActiveModel('gpt-image-2');
    await nextTick();
    expect(await options('格式')).toEqual(['PNG', 'JPEG', 'WEBP']);
    expect(await options('质量')).toEqual(['自动', '低', '中', '高']);
    expect(findSelect('复杂度')).toBeUndefined();
    useModelStore().setActiveModel('unknown-image');
    await nextTick();
    expect(await options('格式')).toEqual(['PNG', 'JPEG', 'WEBP']);
  });

  it('参考图编辑移除 SVG，透明背景仅展示当前模型透明格式', async () => {
    const referenceImages = ref<Array<{ id: string; file: File; previewUrl: string }>>([]);
    const transparent = ref(false);
    app = createApp(() => h(PromptBar, { ...baseProps, referenceImages: referenceImages.value, transparent: transparent.value }));
    app.mount(container);
    referenceImages.value = [{ id: 'ref', file: new File(['test'], 'ref.png', { type: 'image/png' }), previewUrl: 'blob:ref' }];
    await nextTick();
    expect(await options('格式')).toEqual(['PNG', 'JPEG', 'WEBP', 'GIF']);
    transparent.value = true;
    await nextTick();
    expect(await options('格式')).toEqual(['PNG', 'WEBP']);
  });

  it('选择 GIF 显示模型帧设置并按 10ms 滚轮步进，切回 JPEG 恢复压缩滑动条', async () => {
    const format = ref<ModelFormat>('jpeg');
    const duration = ref(200);
    app = createApp(() => h(PromptBar, { ...baseProps, format: format.value, frameDurationMs: duration.value,
      'onUpdate:format': (value: ModelFormat) => { format.value = value; },
      'onUpdate:frameDurationMs': (value: number) => { duration.value = value; } }));
    app.mount(container);
    expect(container.querySelector('.ui-slider')).not.toBeNull();
    await options('格式');
    const gif = Array.from(findSelect('格式')!.querySelectorAll<HTMLElement>('.dropdown-item')).find((option) => option.textContent?.trim() === 'GIF')!;
    gif.click();
    await nextTick();
    expect(container.querySelector('.ui-slider')).toBeNull();
    const steppers = Array.from(container.querySelectorAll<HTMLElement>('.ui-stepper'));
    const frameCount = steppers.find((stepper) => stepper.textContent?.includes('帧数'))!.querySelector('input')!;
    const frameDuration = steppers.find((stepper) => stepper.textContent?.includes('帧时长'))!.querySelector('input')!;
    expect(frameCount.value).toBe('9');
    expect(frameCount.min).toBe('2');
    expect(frameCount.max).toBe('16');
    expect(frameDuration.step).toBe('10');
    frameDuration.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    await nextTick();
    expect(duration.value).toBe(210);
    format.value = 'jpeg';
    await nextTick();
    expect(container.textContent).not.toContain('帧时长');
    container.querySelector<HTMLButtonElement>('.slider-trigger')!.click();
    await nextTick();
    const compression = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(compression.step).toBe('1');
    expect(compression.value).toBe('100');
  });
});


describe('模型数据核实提示', () => {
  it('二点五模型保持独立名称并展示相同参数配置说明', async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    const models = useModelStore();
    models.setActiveModel('gpt-image-2.5');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp(() => h(PromptBar, { prompt: '', resolution: 'auto', aspectRatio: 'auto', sizeWidth: null,
      sizeHeight: null, quality: 'medium', format: 'jpeg', transparent: false, count: 1,
      referenceImages: [], isGenerating: false, elapsedTime: '0s' }));
    try {
      app.mount(container);
      const select = Array.from(container.querySelectorAll<HTMLElement>('.ui-select')).find((element) => element.querySelector('.select-label')?.textContent === '模型')!;
      select.querySelector<HTMLButtonElement>('.select-trigger')!.click();
      await nextTick();
      const modelOption = Array.from(select.querySelectorAll<HTMLElement>('.dropdown-item')).find((item) => item.querySelector('.item-label')?.textContent === 'GPT-Image-2.5')!;
      expect(modelOption.dataset.tip).toContain('2026-11-10');
      expect(modelOption.dataset.tip).toContain('参数配置与 gpt-image-2.5-flare 相同');
      expect(modelOption.dataset.tip).toContain('模型名称和请求 ID 保持 gpt-image-2.5');
      expect(modelOption.dataset.tip).not.toContain('别名');
    } finally {
      app.unmount();
      container.remove();
    }
  });
});
