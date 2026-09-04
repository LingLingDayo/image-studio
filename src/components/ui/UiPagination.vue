<script setup lang="ts">
import { computed, ref } from 'vue';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from '@lucide/vue';
import UiSelect, { type SelectOption } from './UiSelect.vue';

interface Props {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [12, 24, 36, 48, 96],
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void;
  (e: 'update:pageSize', size: number): void;
  (e: 'change', page: number): void;
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)));

const formattedSizeOptions = computed<SelectOption[]>(() => {
  return props.pageSizeOptions.map((size) => ({
    label: `${size} 条 / 页`,
    value: size
  }));
});

// 计算页码与省略号
type PageItem = number | '...';

const visiblePages = computed<PageItem[]>(() => {
  const total = totalPages.value;
  const current = props.currentPage;

  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, '...', current - 1, current, current + 1, '...', total];
});

function handlePageClick(page: PageItem) {
  if (page === '...' || props.disabled) return;
  if (page >= 1 && page <= totalPages.value && page !== props.currentPage) {
    emit('update:currentPage', page);
    emit('change', page);
  }
}

function handlePrev() {
  if (props.disabled || props.currentPage <= 1) return;
  const target = props.currentPage - 1;
  emit('update:currentPage', target);
  emit('change', target);
}

function handleNext() {
  if (props.disabled || props.currentPage >= totalPages.value) return;
  const target = props.currentPage + 1;
  emit('update:currentPage', target);
  emit('change', target);
}

function handleFirst() {
  if (props.disabled || props.currentPage === 1) return;
  emit('update:currentPage', 1);
  emit('change', 1);
}

function handleLast() {
  if (props.disabled || props.currentPage === totalPages.value) return;
  emit('update:currentPage', totalPages.value);
  emit('change', totalPages.value);
}

function handleSizeChange(newSize: string | number | boolean) {
  const sizeNum = Number(newSize);
  if (props.disabled || !sizeNum || sizeNum === props.pageSize) return;
  emit('update:pageSize', sizeNum);
  emit('update:currentPage', 1);
  emit('change', 1);
}

// 快速跳转
const jumpInput = ref<string>('');

function handleJump() {
  const target = parseInt(jumpInput.value.trim(), 10);
  if (!isNaN(target) && target >= 1 && target <= totalPages.value) {
    emit('update:currentPage', target);
    emit('change', target);
    jumpInput.value = '';
  }
}
</script>

<template>
  <nav class="ui-pagination" :class="{ 'is-disabled': disabled }" aria-label="分页导航">
    <!-- 左侧信息摘要 -->
    <div class="pagination-info">
      <span class="total-text">共 <strong>{{ totalItems }}</strong> 件作品</span>
      <span class="divider">·</span>
      <span class="page-text">第 <strong>{{ currentPage }}</strong> / <strong>{{ totalPages }}</strong> 页</span>
    </div>

    <!-- 中间翻页按钮组 -->
    <div class="pagination-controls">
      <!-- 首页 -->
      <button
        type="button"
        class="page-btn nav-btn"
        :disabled="disabled || currentPage <= 1"
        data-tip="第一页"
        @click="handleFirst"
      >
        <ChevronsLeft :size="15" />
      </button>

      <!-- 上一页 -->
      <button
        type="button"
        class="page-btn nav-btn"
        :disabled="disabled || currentPage <= 1"
        data-tip="上一页"
        @click="handlePrev"
      >
        <ChevronLeft :size="15" />
      </button>

      <!-- 数字页码按钮 -->
      <div class="page-numbers">
        <template v-for="(p, idx) in visiblePages" :key="idx">
          <span v-if="p === '...'" class="page-ellipsis">…</span>
          <button
            v-else
            type="button"
            class="page-btn num-btn"
            :class="{ 'is-active': p === currentPage }"
            :disabled="disabled"
            :aria-current="p === currentPage ? 'page' : undefined"
            @click="handlePageClick(p)"
          >
            {{ p }}
          </button>
        </template>
      </div>

      <!-- 下一页 -->
      <button
        type="button"
        class="page-btn nav-btn"
        :disabled="disabled || currentPage >= totalPages"
        data-tip="下一页"
        @click="handleNext"
      >
        <ChevronRight :size="15" />
      </button>

      <!-- 末页 -->
      <button
        type="button"
        class="page-btn nav-btn"
        :disabled="disabled || currentPage >= totalPages"
        data-tip="最后一页"
        @click="handleLast"
      >
        <ChevronsRight :size="15" />
      </button>
    </div>

    <!-- 右侧配置项：每页条数选择器 + 快速跳转 -->
    <div class="pagination-actions">
      <div class="page-size-selector">
        <UiSelect
          :model-value="pageSize"
          :options="formattedSizeOptions"
          variant="default"
          size="sm"
          placement="top"
          :disabled="disabled"
          @update:model-value="handleSizeChange"
        />
      </div>

      <div v-if="totalPages > 5" class="page-jump">
        <span class="jump-label">跳至</span>
        <input
          v-model="jumpInput"
          type="number"
          min="1"
          :max="totalPages"
          class="jump-input"
          placeholder=""
          :disabled="disabled"
          @keydown.enter.prevent="handleJump"
        />
        <span class="jump-label">页</span>
        <button
          type="button"
          class="jump-btn"
          :disabled="disabled || !jumpInput"
          @click="handleJump"
        >
          确定
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.ui-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: $radius-lg;
  box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
  user-select: none;
  flex-wrap: wrap;

  &.is-disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.825rem;
  color: $text-secondary;

  strong {
    color: $text-main;
    font-weight: 600;
  }

  .divider {
    color: $text-dim;
  }
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border-radius: $radius-sm;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #ffffff;
  color: $text-secondary;
  font-size: 0.825rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: $shadow-xs;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover:not(:disabled) {
    border-color: #93c5fd;
    color: $accent-primary;
    background: #f8fafc;
    transform: translateY(-0.5px);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    background: #f8fafc;
    border-color: rgba(226, 232, 240, 0.6);
  }

  &.is-active {
    background: $accent-primary;
    border-color: $accent-primary;
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);

    &:hover {
      background: $accent-hover;
      border-color: $accent-hover;
      color: #ffffff;
    }
  }
}

.nav-btn {
  color: $text-muted;

  &:hover:not(:disabled) {
    color: $accent-primary;
  }
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  color: $text-dim;
  font-size: 0.85rem;
}

.pagination-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-size-selector {
  display: flex;
  align-items: center;
}

.page-jump {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: $text-secondary;

  .jump-label {
    color: $text-muted;
  }

  .jump-input {
    width: 44px;
    height: 30px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: $radius-sm;
    background: #ffffff;
    text-align: center;
    font-size: 0.825rem;
    color: $text-main;
    font-weight: 500;
    outline: none;
    transition: all 0.15s ease;

    /* 隐藏数字上下箭头 */
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &:focus {
      border-color: $accent-primary;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
  }

  .jump-btn {
    height: 30px;
    padding: 0 9px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: $radius-sm;
    background: #ffffff;
    color: $text-secondary;
    font-size: 0.775rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      border-color: #93c5fd;
      color: $accent-primary;
      background: #f8fafc;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

/* 响应式适配 */
@media (max-width: 900px) {
  .ui-pagination {
    justify-content: center;
    gap: 12px;
  }

  .pagination-info {
    width: 100%;
    justify-content: center;
  }

  .page-jump {
    display: none;
  }
}

@media (max-width: 600px) {
  .pagination-controls {
    width: 100%;
    justify-content: center;
  }

  .num-btn:not(.is-active) {
    display: none;
  }

  .page-ellipsis {
    display: none;
  }

  .pagination-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
