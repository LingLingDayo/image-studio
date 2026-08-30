import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationTask } from '@/types/task';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';

export const useTaskStore = defineStore('task', () => {
  const currentTask = ref<GenerationTask | null>(null);
  const taskHistory = ref<GenerationTask[]>([]);

  const isGenerating = computed(() => currentTask.value?.status === 'processing');
  const currentProgress = computed(() => currentTask.value?.progress || 0);
  const currentElapsedTime = computed(() => currentTask.value?.durationFormatted || '0.0s');
  const lastError = computed(() => currentTask.value?.errorMessage || null);

  function setCurrentTask(task: GenerationTask | null) {
    currentTask.value = task;
    if (task) {
      const idx = taskHistory.value.findIndex((t) => t.id === task.id);
      if (idx === -1) {
        taskHistory.value.unshift(task);
      } else {
        taskHistory.value[idx] = task;
      }
    }
  }

  function updateCurrentTask(partial: Partial<GenerationTask>) {
    if (currentTask.value) {
      Object.assign(currentTask.value, partial);
    }
  }

  function cancelCurrentTask(): boolean {
    if (currentTask.value && currentTask.value.status === 'processing') {
      return defaultTaskScheduler.cancel(currentTask.value.id);
    }
    return false;
  }

  return {
    currentTask,
    taskHistory,
    isGenerating,
    currentProgress,
    currentElapsedTime,
    lastError,
    setCurrentTask,
    updateCurrentTask,
    cancelCurrentTask
  };
});
