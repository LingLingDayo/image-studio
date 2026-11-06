import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationTask } from '@/types/task';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';

export const MAX_TASK_HISTORY = 30;

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<GenerationTask[]>([]);
  const taskHistory = ref<GenerationTask[]>([]);

  // 失败任务仍保留在工作区，直到用户重试或显式移除。
  const activeTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'processing' || t.status === 'queued' || t.status === 'failed')
  );

  // 正在执行中的任务
  const runningTasks = computed(() =>
    tasks.value.filter((t) => t.status === 'processing')
  );

  const isGenerating = computed(() => runningTasks.value.length > 0);
  const currentTask = computed<GenerationTask | null>(() => activeTasks.value[0] || null);
  const currentProgress = computed(() => currentTask.value?.progress || 0);
  const currentElapsedTime = computed(() => currentTask.value?.durationFormatted || '0.0s');
  const lastError = computed(() => currentTask.value?.errorMessage || null);

  function isTerminal(task: GenerationTask): boolean {
    return task.status === 'succeeded' || task.status === 'cancelled';
  }

  function pruneHistory(): void {
    let terminalCount = 0;
    taskHistory.value = taskHistory.value.filter((task) => !isTerminal(task) || ++terminalCount <= MAX_TASK_HISTORY);
    const retainedIds = new Set(taskHistory.value.map((task) => task.id));
    tasks.value = tasks.value.filter((task) => !isTerminal(task) || retainedIds.has(task.id));
  }

  function addTask(task: GenerationTask) {
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx === -1) {
      tasks.value.unshift(task);
    } else {
      tasks.value[idx] = { ...task };
    }

    taskHistory.value = [task, ...taskHistory.value.filter((entry) => entry.id !== task.id)];
    pruneHistory();
  }

  function updateTask(taskId: string, partial: Partial<GenerationTask>) {
    const updatedAt = Date.now();
    const idx = tasks.value.findIndex((task) => task.id === taskId);
    if (idx !== -1) tasks.value[idx] = { ...tasks.value[idx], ...partial, updatedAt };
    const historical = taskHistory.value.find((task) => task.id === taskId);
    if (historical) {
      taskHistory.value = [
        { ...historical, ...partial, updatedAt },
        ...taskHistory.value.filter((task) => task.id !== taskId)
      ];
    }
    pruneHistory();
  }

  function removeTask(taskId: string) {
    const task = tasks.value.find((entry) => entry.id === taskId) ?? taskHistory.value.find((entry) => entry.id === taskId);
    // 成功后的延迟移除可能遇到同一任务已经重试，不能丢失正在执行的任务。
    if (task && (task.status === 'idle' || task.status === 'queued' || task.status === 'processing')) return;
    tasks.value = tasks.value.filter((entry) => entry.id !== taskId);
    if (task?.status === 'failed') taskHistory.value = taskHistory.value.filter((entry) => entry.id !== taskId);
    pruneHistory();
  }

  function cancelTask(taskId: string): boolean {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task && task.status === 'processing') {
      const cancelled = defaultTaskScheduler.cancel(taskId);
      if (cancelled) {
        updateTask(taskId, { status: 'cancelled', errorMessage: '已取消生成' });
      }
      return cancelled;
    }
    return false;
  }

  function cancelAllTasks() {
    runningTasks.value.forEach((t) => cancelTask(t.id));
  }

  // 兼容旧接口
  function setCurrentTask(task: GenerationTask | null) {
    if (task) {
      addTask(task);
    }
  }

  function updateCurrentTask(partial: Partial<GenerationTask>) {
    if (currentTask.value) {
      updateTask(currentTask.value.id, partial);
    }
  }

  function cancelCurrentTask(): boolean {
    if (currentTask.value) {
      return cancelTask(currentTask.value.id);
    }
    return false;
  }

  return {
    tasks,
    activeTasks,
    runningTasks,
    currentTask,
    taskHistory,
    isGenerating,
    currentProgress,
    currentElapsedTime,
    lastError,
    addTask,
    updateTask,
    removeTask,
    cancelTask,
    cancelAllTasks,
    setCurrentTask,
    updateCurrentTask,
    cancelCurrentTask
  };
});

