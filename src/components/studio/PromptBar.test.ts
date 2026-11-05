import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import PromptBar from './PromptBar.vue';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';

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
    expect(magicBtn.getAttribute('data-tip')).toBe('请先在「设置 -> 提示词优化」中配置 API Key');

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

  it('空输入时应在占位文案中说明连续两个空行可分批生成', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, defaultProps);
      }
    });

    app.mount(container);
    await nextTick();

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('连续两个空行分隔即可分批生成');

    app.unmount();
  });

  it('单段提示词或仅单个空行时数量控件文案为数量且无批量说明', async () => {
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
    expect(stepper.querySelector('.stepper-controls')?.getAttribute('data-tip')).toBeNull();

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
