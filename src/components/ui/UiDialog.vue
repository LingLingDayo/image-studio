<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X
} from '@lucide/vue';
import { UiButton } from '@/components/ui';

export type DialogType = 'info' | 'warning' | 'success' | 'danger' | 'error' | 'confirm';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    type?: DialogType;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    confirmVariant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'ghost';
    cancelVariant?: 'primary' | 'secondary' | 'ghost';
    loading?: boolean;
    closeOnClickBackdrop?: boolean;
    closeOnEsc?: boolean;
    confirmOnEnter?: boolean;
    showCloseButton?: boolean;
    maxWidth?: string;
  }>(),
  {
    type: 'info',
    title: '',
    description: '',
    confirmText: '确定',
    cancelText: '取消',
    showCancel: true,
    confirmVariant: undefined,
    cancelVariant: 'secondary',
    loading: false,
    closeOnClickBackdrop: true,
    closeOnEsc: true,
    confirmOnEnter: true,
    showCloseButton: true,
    maxWidth: '440px'
  }
);

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const dialogEl = ref<HTMLElement | null>(null);

// 根据类型解析默认按钮变体
const computedConfirmVariant = computed(() => {
  if (props.confirmVariant) return props.confirmVariant;
  if (props.type === 'danger' || props.type === 'error') {
    return 'danger';
  }
  return 'primary';
});

// 解析默认图标组件
const iconComponent = computed(() => {
  switch (props.type) {
    case 'warning':
      return AlertTriangle;
    case 'success':
      return CheckCircle2;
    case 'danger':
    case 'error':
      return AlertCircle;
    case 'confirm':
      return HelpCircle;
    case 'info':
    default:
      return Info;
  }
});

function handleBackdropClick() {
  if (props.closeOnClickBackdrop && !props.loading) {
    emit('close');
  }
}

function handleCancel() {
  if (props.loading) return;
  emit('cancel');
  emit('close');
}

function handleConfirm() {
  emit('confirm');
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || target.isContentEditable;
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen || props.loading || e.isComposing) return;

  if (e.key === 'Escape' && props.closeOnEsc) {
    e.preventDefault();
    e.stopImmediatePropagation();
    emit('close');
    return;
  }

  if (e.key === 'Enter' && props.confirmOnEnter) {
    // 焦点已在操作按钮上时走原生点击，避免确认被触发两次
    if (e.target instanceof HTMLElement && e.target.closest('.dialog-actions button')) return;
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handleConfirm();
  }
}

async function focusConfirmButton() {
  await nextTick();
  const btn = dialogEl.value?.querySelector('.dialog-actions button:last-child') as HTMLButtonElement | null;
  btn?.focus();
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) void focusConfirmButton();
  }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true);
  if (props.isOpen) void focusConfirmButton();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
});
</script>

<template>
  <div v-if="isOpen" class="dialog-backdrop" @click.self="handleBackdropClick">
    <div
      ref="dialogEl"
      class="dialog-container"
      :class="[`type-${type}`]"
      :style="{ maxWidth }"
      role="dialog"
      aria-modal="true"
    >
      <!-- 右上角关闭按钮 -->
      <button
        v-if="showCloseButton"
        class="dialog-close-btn"
        type="button"
        aria-label="关闭"
        :disabled="loading"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>

      <div class="dialog-content-wrap">
        <!-- 图标区域 -->
        <div class="dialog-icon-badge">
          <slot name="icon">
            <component :is="iconComponent" :size="22" />
          </slot>
        </div>

        <!-- 标题与文本内容 -->
        <div class="dialog-main">
          <h3 v-if="title || $slots.title" class="dialog-title">
            <slot name="title">{{ title }}</slot>
          </h3>
          <div v-if="description || $slots.default" class="dialog-description">
            <slot>{{ description }}</slot>
          </div>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="dialog-actions">
        <slot name="footer">
          <UiButton
            v-if="showCancel"
            :variant="cancelVariant"
            size="md"
            :disabled="loading"
            @click="handleCancel"
          >
            {{ cancelText }}
          </UiButton>
          <UiButton
            :variant="computedConfirmVariant"
            size="md"
            :loading="loading"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </UiButton>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-container {
  position: relative;
  width: 100%;
  background: $bg-surface;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  box-shadow: $shadow-float;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.dialog-close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: $bg-surface-hover;
    color: $text-main;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.dialog-content-wrap {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.dialog-icon-badge {
  width: 44px;
  height: 44px;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.dialog-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}

.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: $text-main;
  line-height: 1.4;
  margin: 0;
}

.dialog-description {
  font-size: 0.875rem;
  color: $text-muted;
  line-height: 1.55;
  word-break: break-word;
}

.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}

/* 类型主题配色 */
.type-warning {
  .dialog-icon-badge {
    background: $warning-subtle;
    color: $warning;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }
}

.type-info,
.type-confirm {
  .dialog-icon-badge {
    background: $accent-subtle;
    color: $accent-primary;
    border: 1px solid rgba(37, 99, 235, 0.2);
  }
}

.type-success {
  .dialog-icon-badge {
    background: $success-subtle;
    color: $success;
    border: 1px solid rgba(16, 185, 129, 0.25);
  }
}

.type-danger,
.type-error {
  .dialog-icon-badge {
    background: $danger-subtle;
    color: $danger;
    border: 1px solid rgba(239, 68, 68, 0.25);
  }
}
</style>
