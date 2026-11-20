import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { toRaw } from 'vue';
import { MAX_TASK_HISTORY, TASK_STORAGE_KEY, useTaskStore } from './taskStore';
import type { GenerationTask, TaskStatus } from '@/types/task';

function task(id: string, status: TaskStatus = 'succeeded'): GenerationTask {
  return {
    id, status, type: 'i2i', progress: 100, currentIndex: 1, elapsedSeconds: 1,
    durationFormatted: '1.0s', resultAssetIds: [], createdAt: 1, updatedAt: 1,
    params: {
      model: 'test-model', prompt: id, type: 'i2i', size: '1024x1024', quality: 'low',
      format: 'png', transparent: false, count: 1,
      referenceImages: [{ id: 'reference', file: new File(['image'], 'ref.png', { type: 'image/png' }), previewUrl: 'blob:input-owned' }]
    }
  };
}

describe('任务历史保留策略', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('仅保留最近30个成功或取消任务，并从两份集合释放更早的文件引用', () => {
    const store = useTaskStore();
    for (let i = 0; i < 35; i++) store.addTask(task(String(i), i % 2 ? 'cancelled' : 'succeeded'));
    expect(MAX_TASK_HISTORY).toBe(30);
    expect(store.taskHistory).toHaveLength(30);
    expect(store.tasks).toHaveLength(30);
    expect(store.taskHistory[0].id).toBe('34');
    expect(store.taskHistory.some((entry) => entry.id === '0')).toBe(false);
  });

  it('终态上限不驱逐待执行、排队、生成中或失败待复用的任务', () => {
    const store = useTaskStore();
    for (const status of ['idle', 'queued', 'processing', 'failed'] as const) store.addTask(task(status, status));
    for (let i = 0; i < 35; i++) store.addTask(task(String(i)));
    expect(store.taskHistory).toHaveLength(34);
    for (const status of ['idle', 'queued', 'processing', 'failed']) {
      expect(store.tasks.some((entry) => entry.id === status)).toBe(true);
      expect(store.taskHistory.some((entry) => entry.id === status)).toBe(true);
    }
  });

  it('显式移除失败任务同时释放历史中的引用，完成任务仍保留近期历史', () => {
    const store = useTaskStore();
    store.addTask(task('failed', 'failed'));
    store.addTask(task('done'));
    store.removeTask('failed');
    store.removeTask('done');
    expect(store.tasks).toHaveLength(0);
    expect(store.taskHistory.map((entry) => entry.id)).toEqual(['done']);
  });

  it('延迟移除回调不能移除已重新开始执行的同一任务', () => {
    const store = useTaskStore();
    store.addTask(task('retry'));
    store.updateTask('retry', { status: 'processing' });
    store.removeTask('retry');
    expect(store.runningTasks).toHaveLength(1);
    expect(store.taskHistory[0].status).toBe('processing');
  });

  it('以最近完成状态更新排序，早创建晚完成的任务仍能保留', () => {
    const store = useTaskStore();
    store.addTask(task('first-created', 'processing'));
    for (let i = 0; i < 30; i++) store.addTask(task(String(i)));
    store.updateTask('first-created', { status: 'succeeded' });
    expect(store.taskHistory).toHaveLength(30);
    expect(store.taskHistory[0].id).toBe('first-created');
    expect(store.taskHistory.some((entry) => entry.id === '0')).toBe(false);
  });

  it('重试仍沿用现有记录而不会复制历史，也不撤销输入区拥有的预览地址', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    try {
      const store = useTaskStore();
      const original = task('failed', 'failed');
      store.addTask(original);
      store.addTask({ ...original, status: 'idle' });
      expect(store.taskHistory).toHaveLength(1);
      expect(toRaw(store.taskHistory[0].params.referenceImages![0].file)).toBe(original.params.referenceImages?.[0].file);
      for (let i = 0; i < 35; i++) store.addTask(task(String(i)));
      expect(revoke).not.toHaveBeenCalled();
    } finally {
      revoke.mockRestore();
    }
  });

  it('报错失败的任务会被持久化保存并在刷新后成功恢复，错误信息与卡片依然可见', () => {
    const store = useTaskStore();
    const failedTask = {
      ...task('task-seedream-err', 'failed'),
      errorMessage: '生图失败: images endpoint requires an image model, got "seedream-5.5"'
    };
    store.addTask(failedTask);

    expect(localStorage.getItem(TASK_STORAGE_KEY)).not.toBeNull();

    // 模拟页面刷新（重新初始化 Pinia 与 store 实例）
    setActivePinia(createPinia());
    const restoredStore = useTaskStore();

    expect(restoredStore.tasks).toHaveLength(1);
    expect(restoredStore.activeTasks).toHaveLength(1);
    expect(restoredStore.activeTasks[0].id).toBe('task-seedream-err');
    expect(restoredStore.activeTasks[0].status).toBe('failed');
    expect(restoredStore.activeTasks[0].errorMessage).toBe(
      '生图失败: images endpoint requires an image model, got "seedream-5.5"'
    );
    expect(restoredStore.activeTasks[0].params.prompt).toBe('task-seedream-err');

    // 显式移除该报错任务卡片后，持久化同步清除
    restoredStore.removeTask('task-seedream-err');
    expect(restoredStore.tasks).toHaveLength(0);

    // 再次刷新验证已彻底删除
    setActivePinia(createPinia());
    const cleanStore = useTaskStore();
    expect(cleanStore.tasks).toHaveLength(0);
    expect(cleanStore.activeTasks).toHaveLength(0);
  });

  it('页面刷新前处于 processing 的任务恢复后被安全转为 failed 状态，避免永久卡在加载中', () => {
    const store = useTaskStore();
    store.addTask(task('task-in-flight', 'processing'));

    // 模拟页面刷新中断
    setActivePinia(createPinia());
    const restoredStore = useTaskStore();

    expect(restoredStore.runningTasks).toHaveLength(0);
    expect(restoredStore.activeTasks).toHaveLength(1);
    expect(restoredStore.activeTasks[0].id).toBe('task-in-flight');
    expect(restoredStore.activeTasks[0].status).toBe('failed');
    expect(restoredStore.activeTasks[0].errorMessage).toContain('页面刷新或异常中断');
  });
});
