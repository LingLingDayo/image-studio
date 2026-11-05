import { ref, computed, reactive, watch } from 'vue';
import { useConfigStore } from '@/stores/configStore';
import { useModelStore } from '@/stores/modelStore';
import { useTaskStore } from '@/stores/taskStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { defaultTaskScheduler } from '@/core/scheduler/TaskScheduler';
import type { TaskReferenceImage, TaskGenerationParams, GenerationTask } from '@/types/task';
import {
  resolveTransparentOutputFormat,
  type ModelFormat,
  type ModelModeration,
  type ModelQuality,
  type ResolutionTier
} from '@/types/model';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import { dataUrlToFile } from '@/utils/download';
import { calculateImageDimensions } from '@/utils/image';
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

  const sizeState = reactive<ImageSizeState>({
    resolution: modelStore.activeModel.defaultParams.resolution,
    aspectRatio: modelStore.activeModel.defaultParams.aspectRatio,
    width: null,
    height: null
  });
  const resolution = computed({
    get: () => sizeState.resolution,
    set: (value: ResolutionTier) =>
      Object.assign(sizeState, applyResolutionChange(sizeState, value, primaryReferenceRatio.value, primaryReferenceDims.value))
  });
  const aspectRatio = computed({
    get: () => sizeState.aspectRatio,
    set: (value: string) =>
      Object.assign(sizeState, applyAspectRatioChange(sizeState, value, primaryReferenceRatio.value, primaryReferenceDims.value))
  });
  const sizeWidth = computed({
    get: () => sizeState.width,
    set: (value: number | null) =>
      Object.assign(sizeState, applyWidthChange(sizeState, value, primaryReferenceRatio.value))
  });
  const sizeHeight = computed({
    get: () => sizeState.height,
    set: (value: number | null) =>
      Object.assign(sizeState, applyHeightChange(sizeState, value, primaryReferenceRatio.value))
  });
  const quality = ref<ModelQuality>(modelStore.activeModel.defaultParams.quality);
  const format = ref<ModelFormat>(modelStore.activeModel.defaultParams.format);
  const transparent = ref<boolean>(modelStore.activeModel.defaultParams.transparent);
  const moderation = ref<ModelModeration>(modelStore.activeModel.defaultParams.moderation ?? 'low');
  const count = ref<number>(modelStore.activeModel.defaultParams.count);

  const isGenerating = computed(() => taskStore.isGenerating);
  const elapsedTime = computed(() => taskStore.currentElapsedTime);
  const progress = computed(() => taskStore.currentProgress);
  const errorMessage = computed(() => taskStore.lastError);

  function addReferenceImages(files: FileList | File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const previewUrl = URL.createObjectURL(file);
      const newImg = reactive<TaskReferenceImage>({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl
      });
      referenceImages.value.push(newImg);

      calculateImageDimensions(previewUrl)
        .then((dims) => {
          newImg.width = dims.width;
          newImg.height = dims.height;
          newImg.ratio = dims.ratioStr;
          if (isReferenceRatio(sizeState.aspectRatio) && referenceImages.value[0]?.id === newImg.id) {
            Object.assign(sizeState, applyAspectRatioChange(sizeState, sizeState.aspectRatio, dims.ratioStr));
          }
        })
        .catch(() => {});
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

  async function generate(): Promise<GenerationTask[]> {
    const batches = splitPromptBatches(prompt.value);
    if (batches.length === 0) {
      throw new Error('请输入提示词');
    }

    if (!configStore.isConfigured) {
      throw new Error('请先在顶部设置中填写接口地址与 API Key');
    }

    const isEditMode = referenceImages.value.length > 0;
    const sharedRefs = isEditMode ? [...referenceImages.value] : [];
    const outputFormat = transparent.value ? resolveTransparentOutputFormat(format.value) : format.value;

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

    // 解析生成时实际生效的尺寸与分辨率（同参考图且未设尺寸时自动使用满足分辨率上限的最大尺寸）
    const { size: effectiveSize, resolution: effectiveResolution } = resolveEffectiveGenerationSize({
      sizeState,
      referenceImages: referenceImages.value,
      primaryReferenceRatio: primaryReferenceRatio.value
    });

    const tasks: GenerationTask[] = [];
    for (const batchPrompt of batches) {
      const params: TaskGenerationParams = {
        model: modelStore.activeModel.id,
        prompt: batchPrompt,
        type: isEditMode ? 'i2i' : 't2i',
        size: effectiveSize,
        resolution: effectiveResolution,
        aspectRatio: sizeState.aspectRatio,
        quality: quality.value,
        format: outputFormat,
        transparent: transparent.value,
        moderation: moderation.value,
        count: count.value,
        referenceImages: sharedRefs
      };

      const task = defaultTaskScheduler.createTask(params);
      taskStore.addTask(task);
      tasks.push(task);
    }

    // 提交后根据设置项决定是否清空输入框（默认保持内容以便微调）
    if (configStore.clearPromptOnGenerate) {
      prompt.value = '';
    }

    // 异步执行生成流水线，非阻塞返回
    for (const task of tasks) {
      runTaskExecution(task);
    }

    return tasks;
  }

  function runTaskExecution(task: GenerationTask) {
    defaultTaskScheduler.execute(
      task,
      configStore.providerConfig,
      modelStore.activeModel,
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
    Object.assign(sizeState, materializeSize(sizeState, refRatio, refDims));
  }

  async function reuseItem(item: MediaAsset | ArtworkBatch | GenerationTask | TaskGenerationParams) {
    if (!item) return;

    let modelName: string | undefined;
    let targetPrompt = '';
    let targetQuality: ModelQuality | undefined;
    let targetFormat: ModelFormat | undefined;
    let targetTransparent: boolean | undefined;
    let targetModeration: ModelModeration | undefined;
    let targetCount: number | undefined;
    let refsTask: TaskReferenceImage[] | undefined;
    let refsStrings: string[] | undefined;

    if ('params' in item) {
      // GenerationTask
      const p = item.params;
      modelName = p.model;
      targetPrompt = p.prompt;
      targetQuality = p.quality;
      targetFormat = p.format;
      targetTransparent = p.transparent;
      targetModeration = p.moderation;
      targetCount = p.count;
      refsTask = p.referenceImages;
      Object.assign(sizeState, hydrateImageSizeFromSettings(p));
    } else if ('url' in item || 'assets' in item) {
      // MediaAsset 或 ArtworkBatch
      const asset = item as MediaAsset;
      modelName = asset.model;
      targetPrompt = asset.prompt;
      targetQuality = asset.quality as ModelQuality;
      targetFormat = asset.format as ModelFormat;
      targetTransparent = asset.transparent;
      targetModeration = asset.moderation as ModelModeration | undefined;
      targetCount = ('assets' in item && Array.isArray((item as ArtworkBatch).assets))
        ? (item as ArtworkBatch).assets.length
        : undefined;
      refsStrings = asset.referenceImages;
      Object.assign(sizeState, hydrateImageSizeFromSettings(asset));
    } else {
      // TaskGenerationParams
      const p = item as TaskGenerationParams;
      modelName = p.model;
      targetPrompt = p.prompt;
      targetQuality = p.quality;
      targetFormat = p.format;
      targetTransparent = p.transparent;
      targetModeration = p.moderation;
      targetCount = p.count;
      refsTask = p.referenceImages;
      Object.assign(sizeState, hydrateImageSizeFromSettings(p));
    }

    // 1. 恢复提示词 (使用原始 prompt，绝非 revisedPrompt)
    if (targetPrompt !== undefined) {
      prompt.value = targetPrompt;
    }

    // 2. 恢复模型选择
    if (modelName) {
      modelStore.setActiveModel(modelName);
    }

    // 3. 恢复画质
    if (targetQuality) {
      quality.value = targetQuality;
    }

    // 4. 恢复透明度与格式
    if (targetTransparent !== undefined) {
      transparent.value = targetTransparent;
    }
    if (targetFormat) {
      const reusedFormat = targetFormat as ModelFormat;
      format.value = transparent.value ? resolveTransparentOutputFormat(reusedFormat) : reusedFormat;
    } else if (transparent.value) {
      format.value = resolveTransparentOutputFormat(format.value);
    }

    // 5. 恢复生成张数
    if (targetCount && targetCount > 0) {
      count.value = targetCount;
    }

    // 6. 恢复审核力度
    if (targetModeration) {
      moderation.value = targetModeration;
    }

    // 7. 恢复参考图 (先清空现有参考图，精准还原生图设定的参考图状态)
    clearReferenceImages();
    if (refsTask && refsTask.length > 0) {
      referenceImages.value = [...refsTask];
      refsTask.forEach((img) => {
        if (!img.ratio) {
          calculateImageDimensions(img.previewUrl).then((dims) => {
            img.width = dims.width;
            img.height = dims.height;
            img.ratio = dims.ratioStr;
            if (isReferenceRatio(sizeState.aspectRatio) && referenceImages.value[0]?.id === img.id) {
              Object.assign(sizeState, applyAspectRatioChange(sizeState, sizeState.aspectRatio, dims.ratioStr));
            }
          }).catch(() => {});
        }
      });
    } else if (refsStrings && refsStrings.length > 0) {
      for (let i = 0; i < refsStrings.length; i++) {
        const refStr = refsStrings[i];
        if (!refStr) continue;
        try {
          if (refStr.startsWith('data:')) {
            const file = dataUrlToFile(refStr, `reference_${i + 1}.png`);
            addReferenceImages([file]);
          } else {
            const res = await fetch(refStr);
            const blob = await res.blob();
            const file = new File([blob], `reference_${i + 1}.png`, { type: blob.type || 'image/png' });
            addReferenceImages([file]);
          }
        } catch (e) {
          console.warn('恢复参考图失败:', e);
        }
      }
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
    moderation,
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

