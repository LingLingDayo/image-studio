import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { usePromptOptimizer } from './usePromptOptimizer';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import type { OptimizerConfig } from '@/types/config';

function deferred() {
  let resolve!: (prompt: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let scopes: EffectScope[] = [];
function setup(promptValue = ' 原始描述 ') {
  const prompt = ref(promptValue);
  const configured = ref(true);
  const config = ref<OptimizerConfig>({ baseUrl: 'https://api.example.com', apiKey: 'test-key', model: 'model-a', endpoint: '/v1/chat/completions' });
  const onMessage = vi.fn();
  const onRestored = vi.fn();
  const scope = effectScope();
  scopes.push(scope);
  const optimizer = scope.run(() => usePromptOptimizer({
    getPrompt: () => prompt.value, setPrompt: (value) => { prompt.value = value; },
    getConfig: () => config.value, isConfigured: () => configured.value, onMessage, onRestored
  }))!;
  return { prompt, config, configured, onMessage, onRestored, optimizer, scope };
}

describe('usePromptOptimizer', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => { scopes.forEach((scope) => scope.stop()); scopes = []; });

  it('优化、撤销、重做保留原始输入并由调用方管理焦点', async () => {
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockResolvedValue('优化后的描述');
    const state = setup();
    await state.optimizer.optimize();
    await nextTick();
    expect(service).toHaveBeenCalledWith(state.config.value, '原始描述', undefined, expect.any(AbortSignal));
    expect(state.prompt.value).toBe('优化后的描述');
    expect(state.optimizer.canUndo.value).toBe(true);
    expect(state.optimizer.undo()).toBe(true);
    expect(state.prompt.value).toBe(' 原始描述 ');
    expect(state.optimizer.redo()).toBe(true);
    expect(state.prompt.value).toBe('优化后的描述');
    expect(state.onRestored).toHaveBeenCalledTimes(2);
  });

  it('未配置或空输入不发送请求，正常优化期间重复操作也不会重复调用', async () => {
    const request = deferred();
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup('');
    state.configured.value = false;
    await state.optimizer.optimize();
    state.configured.value = true;
    await state.optimizer.optimize();
    expect(service).not.toHaveBeenCalled();
    state.prompt.value = '原始描述';
    const pending = state.optimizer.optimize();
    await state.optimizer.optimize();
    expect(service).toHaveBeenCalledOnce();
    request.resolve('优化后的描述');
    await pending;
  });

  it('用户手动修改输入后清除优化撤销历史，不拦截普通撤销', async () => {
    vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockResolvedValue('优化后的描述');
    const state = setup();
    await state.optimizer.optimize();
    state.prompt.value = '继续手动编辑';
    await nextTick();
    expect(state.optimizer.undo()).toBe(false);
    expect(state.optimizer.redo()).toBe(false);
  });

  it('编辑期间取消旧请求，迟到的结果不能覆盖新输入', async () => {
    const request = deferred();
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup();
    const pending = state.optimizer.optimize();
    state.prompt.value = '新的创作内容';
    await nextTick();
    expect(service.mock.calls[0][3]?.aborted).toBe(true);
    request.resolve('过期描述');
    await pending;
    expect(state.prompt.value).toBe('新的创作内容');
    expect(state.onMessage).not.toHaveBeenCalled();
    expect(state.optimizer.isOptimizing.value).toBe(false);
  });

  it('配置改变使用新请求，旧请求结束不能清除新请求的加载状态', async () => {
    const first = deferred();
    const second = deferred();
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const state = setup();
    const old = state.optimizer.optimize();
    state.config.value.model = 'model-b';
    await nextTick();
    const current = state.optimizer.optimize();
    expect(service.mock.calls[0][0].model).toBe('model-a');
    expect(service.mock.calls[1][0].model).toBe('model-b');
    first.resolve('旧响应');
    await old;
    expect(state.optimizer.isOptimizing.value).toBe(true);
    expect(state.prompt.value).toBe(' 原始描述 ');
    second.resolve('新响应');
    await current;
    expect(state.prompt.value).toBe('新响应');
  });

  it('同一tick响应先完成再改配置时，不依赖watch调度来拒绝旧结果', async () => {
    const request = deferred();
    vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup();
    const pending = state.optimizer.optimize();
    request.resolve('旧配置结果');
    state.config.value.endpoint = '/v1/responses';
    await pending;
    expect(state.prompt.value).toBe(' 原始描述 ');
    expect(state.onMessage).not.toHaveBeenCalled();
  });
  it('同一tick旧请求失败后改配置时，也不显示旧配置的错误', async () => {
    const request = deferred();
    vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup();
    const pending = state.optimizer.optimize();
    request.reject(new Error('旧配置错误'));
    state.config.value.model = 'model-b';
    await pending;
    expect(state.onMessage).not.toHaveBeenCalled();
  });
  it('生成时reset清除历史并中止未完成的优化，不改变现有输入', async () => {
    const request = deferred();
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup();
    const pending = state.optimizer.optimize();
    state.optimizer.reset();
    expect(service.mock.calls[0][3]?.aborted).toBe(true);
    request.resolve('旧响应');
    await pending;
    expect(state.prompt.value).toBe(' 原始描述 ');
    expect(state.optimizer.canUndo.value).toBe(false);
  });

  it('卸载中止请求，迟到成功与错误均不再写回或通知', async () => {
    const request = deferred();
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockReturnValue(request.promise);
    const state = setup();
    const pending = state.optimizer.optimize();
    state.scope.stop();
    expect(service.mock.calls[0][3]?.aborted).toBe(true);
    request.reject(new Error('迟到错误'));
    await pending;
    expect(state.onMessage).not.toHaveBeenCalled();
    expect(state.prompt.value).toBe(' 原始描述 ');
  });

  it('当前请求错误提供可理解提示，AbortError不作为失败通知', async () => {
    const service = vi.spyOn(PromptOptimizerService, 'optimizePrompt').mockRejectedValueOnce(new Error('优化服务暂时不可用')).mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
    const state = setup();
    await state.optimizer.optimize();
    expect(state.onMessage).toHaveBeenCalledWith('优化服务暂时不可用', 'error');
    expect(state.optimizer.isOptimizing.value).toBe(false);
    state.onMessage.mockClear();
    await state.optimizer.optimize();
    expect(service).toHaveBeenCalledTimes(2);
    expect(state.onMessage).not.toHaveBeenCalled();
  });
});
