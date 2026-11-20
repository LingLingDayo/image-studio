import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GenerationTask } from '@/types/task';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';

export const MAX_TASK_HISTORY = 30;
export const TASK_STORAGE_KEY = 'gpt_image_tasks';

function serializeTask(task: GenerationTask): any {
  return {
    ...task,
    params: {
      ...task.params,
      referenceImages: task.params.referenceImages?.map((img) => ({
        id: img.id,
        previewUrl: img.previewUrl?.startsWith('data:') ? img.previewUrl : '',
        ratio: img.ratio,
        width: img.width,
        height: img.height
      }))
    }
  };
}

function deserializeTask(raw: any): GenerationTask | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.params) return null;

  let status = raw.status;
  let errorMessage = raw.errorMessage;
  // 刷新前若处于处理中或排队中，恢复后标记为异常中断失败
  if (status === 'processing' || status === 'queued') {
    status = 'failed';
    errorMessage = errorMessage || '页面刷新或异常中断，未完成生图';
  }

  return {
    id: String(raw.id),
    type: raw.type === 'i2i' ? 'i2i' : 't2i',
    status,
    progress: Number(raw.progress) || 0,
    currentIndex: Number(raw.currentIndex) || 1,
    elapsedSeconds: Number(raw.elapsedSeconds) || 0,
    durationFormatted: String(raw.durationFormatted || '0.0s'),
    errorMessage,
    resultAssetIds: Array.isArray(raw.resultAssetIds) ? raw.resultAssetIds : [],
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    params: {
      model: String(raw.params.model || ''),
      prompt: String(raw.params.prompt || ''),
      type: raw.params.type === 'i2i' ? 'i2i' : 't2i',
      size: String(raw.params.size || 'auto'),
      resolution: raw.params.resolution,
      aspectRatio: raw.params.aspectRatio,
      quality: raw.params.quality || 'medium',
      format: raw.params.format || 'png',
      transparent: Boolean(raw.params.transparent),
      moderation: raw.params.moderation,
      count: Number(raw.params.count) || 1,
      complexity: raw.params.complexity,
      outputCompression: raw.params.outputCompression,
      frameCount: raw.params.frameCount,
      frameDurationMs: raw.params.frameDurationMs,
      referenceImages: Array.isArray(raw.params.referenceImages)
        ? raw.params.referenceImages.map((img: any) => ({
            id: String(img.id || ''),
            file: new File([], 'reference.png', { type: 'image/png' }),
            previewUrl: String(img.previewUrl || ''),
            width: img.width,
            height: img.height,
            ratio: img.ratio
          }))
        : undefined
    }
  };
}

function saveTasksToStorage(tasks: GenerationTask[], history: GenerationTask[]): void {
  try {
    const payload = {
      tasks: tasks.map(serializeTask),
      history: history.map(serializeTask)
    };
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to persist tasks to storage:', e);
  }
}

function loadTasksFromStorage(): { tasks: GenerationTask[]; history: GenerationTask[] } {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY);
    if (!raw) return { tasks: [], history: [] };
    const parsed = JSON.parse(raw);
    const tasks = Array.isArray(parsed?.tasks)
      ? parsed.tasks.map(deserializeTask).filter((t: GenerationTask | null): t is GenerationTask => t !== null)
      : [];
    const history = Array.isArray(parsed?.history)
      ? parsed.history.map(deserializeTask).filter((t: GenerationTask | null): t is GenerationTask => t !== null)
      : [];
    return { tasks, history };
  } catch (e) {
    console.error('Failed to load tasks from storage:', e);
    return { tasks: [], history: [] };
  }
}

export const useTaskStore = defineStore('task', () => {
  const initial = loadTasksFromStorage();
  const tasks = ref<GenerationTask[]>(initial.tasks);
  const taskHistory = ref<GenerationTask[]>(initial.history);

  function persist(): void {
    saveTasksToStorage(tasks.value, taskHistory.value);
  }

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
    persist();
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

  function clearAllTasks() {
    tasks.value = [];
    taskHistory.value = [];
    persist();
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
    clearAllTasks,
    setCurrentTask,
    updateCurrentTask,
    cancelCurrentTask
  };
});

