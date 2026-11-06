import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import type { OptimizerConfig } from '@/types/config';

type OptimizerMessageType = 'success' | 'error' | 'info';

export interface PromptOptimizerOptions {
  getPrompt: () => string;
  setPrompt: (prompt: string) => void;
  getConfig: () => OptimizerConfig;
  isConfigured: () => boolean;
  onMessage: (message: string, type: OptimizerMessageType) => void;
  onRestored?: () => void;
}

export function usePromptOptimizer(options: PromptOptimizerOptions) {
  const isOptimizing = ref(false);
  const previousPrompt = ref<string | null>(null);
  const optimizedPrompt = ref<string | null>(null);
  let controller: AbortController | null = null;
  let requestVersion = 0;
  let requestPrompt: string | null = null;
  let disposed = false;

  const canUndo = computed(() => previousPrompt.value !== null && optimizedPrompt.value !== null &&
    options.getPrompt() === optimizedPrompt.value
  );
  const canRedo = computed(() => previousPrompt.value !== null && optimizedPrompt.value !== null &&
    options.getPrompt() === previousPrompt.value
  );
  const tooltip = computed(() => {
    if (!options.isConfigured()) return '请先在「设置 -> 提示词优化」中配置 API Key';
    if (isOptimizing.value) return '优化中...';
    if (!options.getPrompt().trim()) return '请先输入提示词后再进行 AI 优化';
    return '使用大模型智能优化提示词 (精准描写与AI易读)';
  });

  function clearHistory(): void {
    previousPrompt.value = null;
    optimizedPrompt.value = null;
  }

  function cancelRequest(): void {
    requestVersion += 1;
    controller?.abort();
    controller = null;
    requestPrompt = null;
    isOptimizing.value = false;
  }

  function reset(): void {
    cancelRequest();
    clearHistory();
  }

  function undo(): boolean {
    if (!canUndo.value || previousPrompt.value === null) return false;
    options.setPrompt(previousPrompt.value);
    options.onRestored?.();
    return true;
  }

  function redo(): boolean {
    if (!canRedo.value || optimizedPrompt.value === null) return false;
    options.setPrompt(optimizedPrompt.value);
    options.onRestored?.();
    return true;
  }

  async function optimize(): Promise<void> {
    if (disposed || isOptimizing.value) return;
    if (!options.isConfigured()) {
      options.onMessage('请先在「设置 -> 提示词优化」中配置 API Key', 'info');
      return;
    }
    const original = options.getPrompt();
    if (!original.trim()) {
      options.onMessage('请先输入提示词后再进行优化', 'info');
      return;
    }

    clearHistory();
    const config = { ...options.getConfig() };
    const request = ++requestVersion;
    const abortController = new AbortController();
    controller = abortController;
    requestPrompt = original;
    isOptimizing.value = true;
    const isCurrentRequest = () => {
      const current = options.getConfig();
      return !disposed && request === requestVersion && !abortController.signal.aborted && options.isConfigured() &&
        options.getPrompt() === original && current.baseUrl === config.baseUrl && current.apiKey === config.apiKey &&
        current.model === config.model && current.endpoint === config.endpoint;
    };

    try {
      const enhanced = await PromptOptimizerService.optimizePrompt(config, original.trim(), undefined, abortController.signal);
      // 输入可能在请求期间被编辑或用于生成，旧响应不能覆盖新的创作内容。
      if (!isCurrentRequest()) return;
      previousPrompt.value = original;
      optimizedPrompt.value = enhanced;
      options.setPrompt(enhanced);
      options.onMessage('提示词优化成功！已提升描写精准度与AI理解度', 'success');
    } catch (error) {
      if (!isCurrentRequest() || (error instanceof Error && error.name === 'AbortError')) return;
      clearHistory();
      options.onMessage(error instanceof Error && error.message ? error.message : '提示词优化失败', 'error');
    } finally {
      if (request === requestVersion) {
        controller = null;
        requestPrompt = null;
        isOptimizing.value = false;
      }
    }
  }

  watch(options.getPrompt, (prompt) => {
    if (controller && prompt !== requestPrompt) cancelRequest();
    if (!prompt.trim() || (optimizedPrompt.value !== null && prompt !== optimizedPrompt.value && prompt !== previousPrompt.value)) {
      clearHistory();
    }
  });
  watch(() => {
    const config = options.getConfig();
    return [config.baseUrl, config.apiKey, config.model, config.endpoint] as const;
  }, reset);

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      reset();
    });
  }

  return { isOptimizing, canUndo, canRedo, tooltip, optimize, undo, redo, reset };
}
