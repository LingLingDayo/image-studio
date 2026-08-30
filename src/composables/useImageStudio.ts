import { ref, computed, reactive } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';
import type { TaskReferenceImage, TaskGenerationParams, GenerationTask } from '@/types/task';
import {
  resolveTransparentOutputFormat,
  type ModelFormat,
  type ModelQuality,
  type ResolutionTier
} from '@/types/model';
import type { MediaAsset } from '@/types/asset';
import { dataUrlToFile } from '@/utils/download';
import {
  applyAspectRatioChange,
  applyHeightChange,
  applyResolutionChange,
  applySizeAuto,
  applyWidthChange,
  formatSizeParam,
  hydrateImageSizeFromAsset,
  materializeSize,
  type ImageSizeState
} from '@/utils/imageSize';

export function useImageStudio() {
  const configStore = useConfigStore();
  const modelStore = useModelStore();
  const taskStore = useTaskStore();
  const galleryStore = useGalleryStore();

  const prompt = ref<string>('');
  const sizeState = reactive<ImageSizeState>({
    resolution: modelStore.activeModel.defaultParams.resolution,
    aspectRatio: modelStore.activeModel.defaultParams.aspectRatio,
    width: null,
    height: null
  });
  const resolution = computed({
    get: () => sizeState.resolution,
    set: (value: ResolutionTier) => Object.assign(sizeState, applyResolutionChange(sizeState, value))
  });
  const aspectRatio = computed({
    get: () => sizeState.aspectRatio,
    set: (value: string) => Object.assign(sizeState, applyAspectRatioChange(sizeState, value))
  });
  const sizeWidth = computed({
    get: () => sizeState.width,
    set: (value: number | null) => Object.assign(sizeState, applyWidthChange(sizeState, value))
  });
  const sizeHeight = computed({
    get: () => sizeState.height,
    set: (value: number | null) => Object.assign(sizeState, applyHeightChange(sizeState, value))
  });
  const quality = ref<ModelQuality>(modelStore.activeModel.defaultParams.quality);
  const format = ref<ModelFormat>(modelStore.activeModel.defaultParams.format);
  const transparent = ref<boolean>(modelStore.activeModel.defaultParams.transparent);
  const count = ref<number>(modelStore.activeModel.defaultParams.count);

  const referenceImages = ref<TaskReferenceImage[]>([]);

  const isGenerating = computed(() => taskStore.isGenerating);
  const elapsedTime = computed(() => taskStore.currentElapsedTime);
  const progress = computed(() => taskStore.currentProgress);
  const errorMessage = computed(() => taskStore.lastError);

  function addReferenceImages(files: FileList | File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(file);
      referenceImages.value.push({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl
      });
    }
  }

  function removeReferenceImage(id: string) {
    const idx = referenceImages.value.findIndex((img) => img.id === id);
    if (idx !== -1) {
      URL.revokeObjectURL(referenceImages.value[idx].previewUrl);
      referenceImages.value.splice(idx, 1);
    }
  }

  function clearReferenceImages() {
    referenceImages.value.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    referenceImages.value = [];
  }

  async function generate(): Promise<GenerationTask> {
    const trimmedPrompt = prompt.value.trim();
    if (!trimmedPrompt) {
      throw new Error('请输入提示词 (Prompt)');
    }

    if (!configStore.isConfigured) {
      throw new Error('请先在顶部设置中填写接口地址与 API Key');
    }

    const isEditMode = referenceImages.value.length > 0;

    const params: TaskGenerationParams = {
      model: modelStore.activeModel.id,
      prompt: trimmedPrompt,
      type: isEditMode ? 'i2i' : 't2i',
      size: formatSizeParam(sizeState),
      resolution: sizeState.resolution,
      aspectRatio: sizeState.aspectRatio,
      quality: quality.value,
      format: transparent.value ? resolveTransparentOutputFormat(format.value) : format.value,
      transparent: transparent.value,
      count: count.value,
      referenceImages: isEditMode ? [...referenceImages.value] : []
    };

    const task = defaultTaskScheduler.createTask(params);
    taskStore.addTask(task);

    // 提交后清空输入框，支持用户立即输入下一个提示词并发绘图
    prompt.value = '';

    // 异步执行生成流水线，非阻塞返回
    runTaskExecution(task);

    return task;
  }

  function runTaskExecution(task: GenerationTask) {
    defaultTaskScheduler.execute(
      task,
      configStore.providerConfig,
      modelStore.activeModel,
      {
        onStatusChange: (t) => {
          taskStore.updateTask(t.id, { status: t.status });
        },
        onProgress: (t) => {
          taskStore.updateTask(t.id, {
            progress: t.progress,
            elapsedSeconds: t.elapsedSeconds,
            durationFormatted: t.durationFormatted
          });
        },
        onSuccess: (_t, resultAssets) => {
          galleryStore.addAssets(resultAssets);
          setTimeout(() => {
            taskStore.removeTask(task.id);
          }, 400);
        },
        onError: (_t, err) => {
          taskStore.updateTask(task.id, {
            status: 'failed',
            errorMessage: err.message || '生成失败'
          });
        }
      }
    ).catch(() => {
      // 错误已在 onError 中捕获处理
    });
  }

  function retryTask(task: GenerationTask) {
    const updatedTask: GenerationTask = {
      ...task,
      status: 'idle',
      progress: 0,
      elapsedSeconds: 0,
      durationFormatted: '0.0s',
      errorMessage: undefined,
      updatedAt: Date.now()
    };
    taskStore.addTask(updatedTask);
    runTaskExecution(updatedTask);
  }

  function cancelTask(taskId: string) {
    taskStore.cancelTask(taskId);
  }

  function removeTask(taskId: string) {
    taskStore.removeTask(taskId);
  }

  function cancel() {
    if (taskStore.currentTask) {
      taskStore.cancelTask(taskStore.currentTask.id);
    }
  }

  function setSizeAuto() {
    Object.assign(sizeState, applySizeAuto(sizeState));
  }

  function materializeImageSize() {
    Object.assign(sizeState, materializeSize(sizeState));
  }

  function reuseItem(item: MediaAsset) {
    prompt.value = item.prompt;
    Object.assign(sizeState, hydrateImageSizeFromAsset(item));
    if (item.quality) quality.value = item.quality as ModelQuality;
    if (item.transparent !== undefined) transparent.value = item.transparent;
    if (item.format) {
      const reusedFormat = item.format as ModelFormat;
      format.value = transparent.value ? resolveTransparentOutputFormat(reusedFormat) : reusedFormat;
    } else if (transparent.value) {
      format.value = resolveTransparentOutputFormat(format.value);
    }
  }

  async function useImageAsReference(url: string, filename: string = 'reference.png') {
    try {
      if (url.startsWith('data:')) {
        const file = dataUrlToFile(url, filename);
        addReferenceImages([file]);
        return;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      addReferenceImages([file]);
    } catch (e) {
      console.error('加载参考图失败:', e);
    }
  }

  return {
    prompt,
    resolution,
    aspectRatio,
    sizeWidth,
    sizeHeight,
    setSizeAuto,
    materializeImageSize,
    quality,
    format,
    transparent,
    count,
    referenceImages,
    isGenerating,
    elapsedTime,
    progress,
    errorMessage,
    addReferenceImages,
    removeReferenceImage,
    clearReferenceImages,
    generate,
    retryTask,
    cancelTask,
    removeTask,
    cancel,
    reuseItem,
    useImageAsReference
  };
}

