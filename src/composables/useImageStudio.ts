import { ref, computed, reactive, watch, markRaw, toRaw, getCurrentScope, onScopeDispose } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';
import type { TaskReferenceImage, TaskGenerationParams, GenerationTask } from '@/types/task';
import {
  type ModelGenerationSettings,
  type ModelFormat,
  type ModelModeration,
  type ModelQuality,
  type ResolutionTier
} from '@/types/model';
import { fitModelGeneratedSize, normalizeModelSettings, resolveModelComplexity, validateModelGenerationParams } from '@/core/models/settings';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import { dataUrlToFile } from '@/utils/download';
import { calculateImageDimensions, loadImageDimensions } from '@/utils/image';
import {
  applyAspectRatioChange,
  applyHeightChange,
  applyResolutionChange,
  applySizeAuto,
  applyWidthChange,
  hydrateImageSizeFromSettings,
  isReferenceRatio,
  materializeSize,
  resolveEffectiveGenerationSize,
  type ImageSizeState
} from '@/utils/imageSize';
import { splitPromptBatches } from '@/utils/promptBatches';

export function useImageStudio() {
  const configStore = useConfigStore();
  const modelStore = useModelStore();
  const taskStore = useTaskStore();
  const galleryStore = useGalleryStore();

  const prompt = ref<string>('');
  const referenceImages = ref<TaskReferenceImage[]>([]);

  // 首张参考图的比例与物理尺寸（同参考图选项绑定首张参考图）
  const primaryReferenceRatio = computed<string | null>(() => {
    if (referenceImages.value.length === 0) return null;
    return referenceImages.value[0]?.ratio || null;
  });

  const primaryReferenceDims = computed<{ width: number; height: number } | null>(() => {
    const first = referenceImages.value[0];
    if (first?.width && first?.height) {
      return { width: first.width, height: first.height };
    }
    return null;
  });

  // 当首张参考图比例变化（如异步加载完成、或首图被删除切换至下一张）时，实时更新尺寸
  watch(primaryReferenceRatio, (newRatio) => {
    if (isReferenceRatio(sizeState.aspectRatio)) {
      Object.assign(
        sizeState,
        applyAspectRatioChange(sizeState, sizeState.aspectRatio, newRatio, primaryReferenceDims.value)
      );
    }
  });

  const sizeState = reactive<ImageSizeState>(hydrateImageSizeFromSettings(modelStore.activeModel.defaultParams));
  let hasManualSize = modelStore.activeModel.defaultParams.size !== 'auto';
  const resolution = computed({
    get: () => sizeState.resolution,
    set: (value: ResolutionTier) => {
      hasManualSize = false;
      Object.assign(sizeState, applyResolutionChange(sizeState, value, primaryReferenceRatio.value, primaryReferenceDims.value));
      fitDerivedSize();
    }
  });
  const aspectRatio = computed({
    get: () => sizeState.aspectRatio,
    set: (value: string) => {
      hasManualSize = false;
      Object.assign(sizeState, applyAspectRatioChange(sizeState, value, primaryReferenceRatio.value, primaryReferenceDims.value));
      fitDerivedSize();
    }
  });
  const sizeWidth = computed({
    get: () => sizeState.width,
    set: (value: number | null) => {
      hasManualSize = value !== null;
      Object.assign(sizeState, applyWidthChange(sizeState, value, primaryReferenceRatio.value));
    }
  });
  const sizeHeight = computed({
    get: () => sizeState.height,
    set: (value: number | null) => {
      hasManualSize = value !== null;
      Object.assign(sizeState, applyHeightChange(sizeState, value, primaryReferenceRatio.value));
    }
  });
  const quality = ref<ModelQuality>(modelStore.activeModel.defaultParams.quality);
  const format = ref<ModelFormat>(modelStore.activeModel.defaultParams.format);
  const transparent = ref<boolean>(modelStore.activeModel.defaultParams.transparent);
  const moderation = ref<ModelModeration>(modelStore.activeModel.defaultParams.moderation ?? 'low');
  const count = ref<number>(modelStore.activeModel.defaultParams.count);

  const outputCompression = ref<number | undefined>(modelStore.activeModel.defaultParams.outputCompression);
  const frameCount = ref<number | undefined>(modelStore.activeModel.defaultParams.frameCount);
  const frameDurationMs = ref<number | undefined>(modelStore.activeModel.defaultParams.frameDurationMs);
  let isSyncingSettings = false;
  let isRestoringSettings = false;

  function fitDerivedSize() {
    if (hasManualSize || sizeState.width === null || sizeState.height === null) return;
    const fitted = fitModelGeneratedSize(modelStore.activeModel, `${sizeState.width}x${sizeState.height}`, format.value);
    const dimensions = fitted === 'auto' ? null : fitted.split('x').map(Number);
    sizeState.width = dimensions?.[0] ?? null;
    sizeState.height = dimensions?.[1] ?? null;
  }

  function syncModelSettings() {
    if (isSyncingSettings || isRestoringSettings) return;
    isSyncingSettings = true;
    try {
      const current: ModelGenerationSettings = {
        size: sizeState.width !== null && sizeState.height !== null ? `${sizeState.width}x${sizeState.height}` : 'auto',
        resolution: resolution.value, aspectRatio: aspectRatio.value, quality: quality.value, format: format.value,
        transparent: transparent.value, moderation: moderation.value, count: count.value,
        outputCompression: outputCompression.value,
        frameCount: frameCount.value, frameDurationMs: frameDurationMs.value
      };
      const next = normalizeModelSettings(modelStore.activeModel, current, referenceImages.value.length > 0 ? 'i2i' : 't2i');
      if (next.size !== current.size || next.resolution !== current.resolution || next.aspectRatio !== current.aspectRatio) {
        const nextSize = next.size === current.size ? 'auto' : next.size;
        Object.assign(sizeState, hydrateImageSizeFromSettings({ ...next, size: nextSize }));
        hasManualSize = nextSize !== 'auto';
      }
      quality.value = next.quality;
      format.value = next.format;
      transparent.value = next.transparent;
      moderation.value = next.moderation;
      count.value = next.count;
      outputCompression.value = next.outputCompression;
      frameCount.value = next.frameCount;
      frameDurationMs.value = next.frameDurationMs;
      fitDerivedSize();
    } finally {
      isSyncingSettings = false;
    }
  }

  watch([
    () => modelStore.activeModel, () => referenceImages.value.length, quality, format, transparent, moderation,
    count, outputCompression, frameCount, frameDurationMs
  ], syncModelSettings, { flush: 'sync', deep: true });

  const isGenerating = computed(() => taskStore.isGenerating);
  const elapsedTime = computed(() => taskStore.currentElapsedTime);
  const progress = computed(() => taskStore.currentProgress);
  const errorMessage = computed(() => taskStore.lastError);

  function createReferenceImage(file: File, metadata?: TaskReferenceImage): TaskReferenceImage {
    const retainedFile = markRaw(toRaw(file));
    return reactive<TaskReferenceImage>({
      ...metadata,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: retainedFile,
      previewUrl: URL.createObjectURL(retainedFile)
    });
  }

  function updateReferenceDimensions(img: TaskReferenceImage) {
    calculateImageDimensions(img.previewUrl)
      .then((dims) => {
        img.width = dims.width;
        img.height = dims.height;
        img.ratio = dims.ratioStr;
        if (isReferenceRatio(sizeState.aspectRatio) && referenceImages.value[0]?.id === img.id) {
          Object.assign(sizeState, applyAspectRatioChange(sizeState, sizeState.aspectRatio, dims.ratioStr, dims));
        }
      })
      .catch(() => {});
  }

  function addReferenceImages(files: FileList | File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const img = createReferenceImage(file);
      referenceImages.value.push(img);
      updateReferenceDimensions(img);
    }
  }

  async function loadReferenceImage(url: string, filename: string): Promise<TaskReferenceImage> {
    if (!url.trim()) {
      throw new Error('无法读取参考图：图片地址为空');
    }

    let file: File;
    if (url.startsWith('data:')) {
      try {
        file = dataUrlToFile(url, filename);
      } catch {
        throw new Error('无法读取参考图：本地图片数据无效');
      }
    } else {
      let response: Response;
      try {
        response = await fetch(url);
      } catch {
        throw new Error('无法读取参考图，请检查图片地址、网络或跨域权限');
      }
      if (!response.ok) {
        throw new Error(`无法读取参考图：HTTP ${response.status}`);
      }
      try {
        const blob = await response.blob();
        file = new File([blob], filename, { type: blob.type });
      } catch {
        throw new Error('无法读取参考图：图片内容读取失败');
      }
    }

    if (!file.type.startsWith('image/') || file.size === 0) {
      throw new Error('参考图为空或不是有效的图片，请重新选择');
    }

    const img = createReferenceImage(file);
    try {
      const dims = await loadImageDimensions(img.previewUrl);
      img.width = dims.width;
      img.height = dims.height;
      img.ratio = dims.ratioStr;
      return img;
    } catch (error) {
      URL.revokeObjectURL(img.previewUrl);
      throw error;
    }
  }

  function removeReferenceImage(id: string) {
    const idx = referenceImages.value.findIndex((img) => img.id === id);
    if (idx !== -1) {
      URL.revokeObjectURL(referenceImages.value[idx].previewUrl);
      referenceImages.value.splice(idx, 1);
      if (isReferenceRatio(sizeState.aspectRatio)) {
        Object.assign(sizeState, applyAspectRatioChange(sizeState, sizeState.aspectRatio, primaryReferenceRatio.value));
      }
    }
  }

  function clearReferenceImages() {
    referenceImages.value.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    referenceImages.value = [];
    if (isReferenceRatio(sizeState.aspectRatio)) {
      Object.assign(sizeState, applyAspectRatioChange(sizeState, sizeState.aspectRatio, null));
    }
  }

  let isDisposed = false;
  if (getCurrentScope()) {
    onScopeDispose(() => {
      isDisposed = true;
      clearReferenceImages();
    });
  }

  async function generate(): Promise<GenerationTask[]> {
    const batches = splitPromptBatches(prompt.value);
    if (batches.length === 0) {
      throw new Error('请输入提示词');
    }

    if (!configStore.isConfigured) {
      throw new Error('请先在顶部设置中填写接口地址与 API Key');
    }

    // 确保首张参考图真实尺寸已就绪（避免直接点击生成时尺寸未决）
    const firstRef = referenceImages.value[0];
    if (firstRef && (!firstRef.ratio || !firstRef.width || !firstRef.height)) {
      try {
        const dims = await calculateImageDimensions(firstRef.previewUrl);
        firstRef.width = dims.width;
        firstRef.height = dims.height;
        firstRef.ratio = dims.ratioStr;
      } catch (e) {}
    }

    syncModelSettings();
    const isEditMode = referenceImages.value.length > 0;
    const outputFormat = format.value;

    // 解析生成时实际生效的尺寸与分辨率（同参考图且未设尺寸时自动使用满足分辨率上限的最大尺寸）
    const { size: effectiveSize, resolution: effectiveResolution } = resolveEffectiveGenerationSize({
      sizeState,
      referenceImages: referenceImages.value,
      primaryReferenceRatio: primaryReferenceRatio.value
    });

    // 输入区持有预览 URL；任务只保留 File 与尺寸快照，复用时重新创建预览。
    const sharedRefs = isEditMode ? referenceImages.value.map((img) => ({ ...img })) : [];
    const tasks: GenerationTask[] = [];
    for (const batchPrompt of batches) {
      const params: TaskGenerationParams = {
        model: modelStore.activeModel.id,
        prompt: batchPrompt,
        type: isEditMode ? 'i2i' : 't2i',
        size: hasManualSize
          ? effectiveSize
          : fitModelGeneratedSize(modelStore.activeModel, effectiveSize, outputFormat),
        resolution: effectiveResolution,
        aspectRatio: sizeState.aspectRatio,
        quality: quality.value,
        format: outputFormat,
        transparent: transparent.value,
        moderation: modelStore.activeModel.moderationOptions.length > 0 ? moderation.value : undefined,
        complexity: resolveModelComplexity(modelStore.activeModel, effectiveResolution, outputFormat),
        outputCompression: outputCompression.value,
        frameCount: outputFormat === 'gif' ? frameCount.value : undefined,
        frameDurationMs: outputFormat === 'gif' ? frameDurationMs.value : undefined,
        count: count.value,
        referenceImages: sharedRefs
      };

      validateModelGenerationParams(modelStore.activeModel, params);
      const task = defaultTaskScheduler.createTask(params);
      tasks.push(task);
    }

    // 提交后根据设置项决定是否清空输入框（默认保持内容以便微调）
    if (configStore.clearPromptOnGenerate) {
      prompt.value = '';
    }

    // 异步执行生成流水线，非阻塞返回
    for (const task of tasks) {
      taskStore.addTask(task);
      runTaskExecution(task);
    }

    return tasks;
  }

  function runTaskExecution(task: GenerationTask) {
    defaultTaskScheduler.execute(
      task,
      configStore.providerConfig,
      modelStore.getModelProfile(task.params.model),
      {
        onStatusChange: (t) => {
          taskStore.updateTask(t.id, {
            status: t.status,
            errorMessage: t.errorMessage
          });
        },
        onProgress: (t) => {
          taskStore.updateTask(t.id, {
            progress: t.progress,
            currentIndex: t.currentIndex,
            elapsedSeconds: t.elapsedSeconds,
            durationFormatted: t.durationFormatted
          });
        },
        onImageComplete: (_t, resultAssets) => {
          galleryStore.addAssets(resultAssets);
        },
        onSuccess: () => {
          setTimeout(() => {
            taskStore.removeTask(task.id);
          }, 500);
        },
        onError: (t, err) => {
          taskStore.updateTask(task.id, {
            status: t.status || 'failed',
            errorMessage: t.errorMessage || err.message || '生成失败'
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
      currentIndex: 1,
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
    hasManualSize = false;
    Object.assign(sizeState, applySizeAuto(sizeState));
  }

  async function materializeImageSize() {
    const firstRef = referenceImages.value[0];
    if (firstRef && (!firstRef.ratio || !firstRef.width || !firstRef.height)) {
      try {
        const dims = await calculateImageDimensions(firstRef.previewUrl);
        firstRef.width = dims.width;
        firstRef.height = dims.height;
        firstRef.ratio = dims.ratioStr;
      } catch (e) {}
    }
    const refDims = firstRef?.width && firstRef?.height ? { width: firstRef.width, height: firstRef.height } : primaryReferenceDims.value;
    const refRatio = firstRef?.ratio || primaryReferenceRatio.value;
    hasManualSize = false;
    Object.assign(sizeState, materializeSize(sizeState, refRatio, refDims));
    fitDerivedSize();
  }

  async function reuseItem(item: MediaAsset | ArtworkBatch | GenerationTask | TaskGenerationParams) {
    const source = 'params' in item ? item.params : item;
    const targetSize = hydrateImageSizeFromSettings(source);
    const targetQuality = source.quality as ModelQuality | undefined;
    const targetFormat = ('targetFormat' in source ? source.targetFormat ?? source.format : source.format) as ModelFormat | undefined;
    const targetModeration = source.moderation as ModelModeration | undefined;
    const targetCount = 'count' in source ? source.count : 'assets' in source ? source.assets.length : undefined;
    const preparedRefs: TaskReferenceImage[] = [];

    // 参考图全部准备成功后再替换输入，避免加载失败时留下不完整的复用状态。
    try {
      if ('url' in source || 'assets' in source) {
        for (const [index, url] of (source.referenceImages || []).entries()) {
          preparedRefs.push(await loadReferenceImage(url, `reference_${index + 1}.png`));
        }
      } else {
        for (const img of source.referenceImages || []) {
          preparedRefs.push(createReferenceImage(img.file, img));
        }
      }
      if (isDisposed) throw new Error('工作台已关闭，请重新打开后再操作');
    } catch (error) {
      preparedRefs.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      throw error;
    }

    isRestoringSettings = true;
    try {
      clearReferenceImages();
      referenceImages.value = preparedRefs;
      for (const img of preparedRefs) {
        if (!img.ratio || !img.width || !img.height) updateReferenceDimensions(img);
      }
      if (source.model) modelStore.setActiveModel(source.model);
      Object.assign(sizeState, targetSize);
      hasManualSize = targetSize.width !== null && targetSize.height !== null;
      prompt.value = source.prompt;
      if (targetQuality) quality.value = targetQuality;
      if (source.transparent !== undefined) transparent.value = source.transparent;
      if (targetFormat) format.value = targetFormat;
      if (targetCount && targetCount > 0) count.value = targetCount;
      if (targetModeration) moderation.value = targetModeration;
      outputCompression.value = source.outputCompression;
      frameCount.value = source.frameCount;
      frameDurationMs.value = source.frameDurationMs;
    } finally {
      isRestoringSettings = false;
      syncModelSettings();
    }
  }

  async function useImageAsReference(url: string, filename: string = 'reference.png') {
    const img = await loadReferenceImage(url, filename);
    if (isDisposed) {
      URL.revokeObjectURL(img.previewUrl);
      throw new Error('工作台已关闭，请重新打开后再操作');
    }
    referenceImages.value.push(img);
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
    moderation,
    outputCompression,
    frameCount,
    frameDurationMs,
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

