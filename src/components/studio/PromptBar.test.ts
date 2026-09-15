import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import PromptBar from './PromptBar.vue';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';

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
    format: 'png' as const,
    transparent: false,
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
    expect(magicBtn.getAttribute('data-tip')).toBe('使用大模型智能优化提示词 (AI 润色扩写细节)');

    app.unmount();
  });

  it('应在参数栏展示模型切换且默认选中 gpt-image-2', async () => {
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
    expect(modelValue).toBe('GPT-Image-2');
    const iconSelects = container.querySelectorAll('.params-group .ui-select.has-icon');
    expect(iconSelects.length).toBeGreaterThanOrEqual(6);
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

  it('单段提示词时数量控件文案为数量且无批量说明', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫\n站在屋顶',
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

  it('空行分隔多段提示词时数量控件切换为批量并展示批次说明', async () => {
    const app = createApp({
      render() {
        return h(PromptBar as any, {
          ...defaultProps,
          prompt: '一只猫\n\n一只狗',
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
          prompt: '日出\n\n海边\n\n城市',
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
});
