<script setup lang="ts">
import { computed } from 'vue';
import type { MediaAsset, ArtworkBatch } from '@/types/asset';
import type { GenerationTask } from '@/types/task';
import TaskCard from './card/TaskCard.vue';
import ArtworkCard from './card/ArtworkCard.vue';

const props = defineProps<{
  item?: MediaAsset;
  batch?: ArtworkBatch;
  task?: GenerationTask;
}>();

const emit = defineEmits<{
  (e: 'view', item: MediaAsset, allAssets: MediaAsset[]): void;
  (e: 'regenerate', item: MediaAsset | GenerationTask): void;
  (e: 'toggleFavorite', id: number): void;
  (e: 'reuse', item: MediaAsset | GenerationTask): void;
  (e: 'editAsReference', item: MediaAsset): void;
  (e: 'delete', id: number): void;
  (e: 'deleteBatch', batch: ArtworkBatch): void;
  (e: 'cancelTask', taskId: string): void;
  (e: 'retryTask', task: GenerationTask): void;
  (e: 'removeTask', taskId: string): void;
  (e: 'showToast', message: string, type: 'success' | 'error' | 'info'): void;
}>();

// 是否为任务模式
const isTaskMode = computed(() => Boolean(props.task));
</script>

<template>
  <!-- 任务进行中/失败状态卡片 -->
  <TaskCard
    v-if="isTaskMode && task"
    :task="task"
    @cancel-task="emit('cancelTask', $event)"
    @retry-task="emit('retryTask', $event)"
    @remove-task="emit('removeTask', $event)"
  />

  <!-- 作品结果展示卡片 (支持多图聚合与切换) -->
  <ArtworkCard
    v-else
    :item="item"
    :batch="batch"
    @view="(current, all) => emit('view', current, all)"
    @regenerate="emit('regenerate', $event)"
    @toggle-favorite="emit('toggleFavorite', $event)"
    @reuse="emit('reuse', $event)"
    @edit-as-reference="emit('editAsReference', $event)"
    @delete="emit('delete', $event)"
    @delete-batch="emit('deleteBatch', $event)"
    @show-toast="(msg, type) => emit('showToast', msg, type)"
  />
</template>
