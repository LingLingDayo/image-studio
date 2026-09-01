import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import PromptBar from './PromptBar.vue';
import { useConfigStore } from '@/stores/configStore';

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
});
