import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationTask } from '@/types/task';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<GenerationTask[]>([]);
  const taskHistory = ref<GenerationTask[]>([]);

  // 活跃任务（生成中、排队中、失败待查看/重试、已取消）
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

  function addTask(task: GenerationTask) {
    const idx = tasks.value.findIndex((t) => t.id === task.id);
    if (idx === -1) {
      tasks.value.unshift(task);
    } else {
      tasks.value[idx] = { ...task };
    }

    const hIdx = taskHistory.value.findIndex((t) => t.id === task.id);
    if (hIdx === -1) {
      taskHistory.value.unshift(task);
    } else {
      taskHistory.value[hIdx] = task;
    }
  }

  function updateTask(taskId: string, partial: Partial<GenerationTask>) {
    const idx = tasks.value.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks.value[idx] = {
        ...tasks.value[idx],
        ...partial,
        updatedAt: Date.now()
      };
    }
    const hIdx = taskHistory.value.findIndex((t) => t.id === taskId);
    if (hIdx !== -1) {
      taskHistory.value[hIdx] = {
        ...taskHistory.value[hIdx],
        ...partial,
        updatedAt: Date.now()
      };
    }
  }

  function removeTask(taskId: string) {
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
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

