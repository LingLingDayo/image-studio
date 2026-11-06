<script setup lang="ts">
import { computed } from 'vue';
import { Loader2, RefreshCw } from '@lucide/vue';
import { UiCombobox } from '@/components/ui';
import { getPath, isFieldDisabled, type SettingWidgetProps } from '@/core/settings';

const props = defineProps<SettingWidgetProps>();
const emit = defineEmits<{
  (e: 'change', value: string): void;
  (e: 'refresh'): void;
}>();

const options = computed(() => props.options.map((option) => ({
  label: option.label,
  value: String(option.value),
  disabled: option.disabled
})));
const refreshDisabled = computed(() => props.disabled || props.loading ||
  !props.field.refreshAction || isFieldDisabled(props.field.refreshAction, props.ctx)
);
const isError = computed(() => {
  const key = props.field.props?.statusRuntimeKey;
  if (typeof key !== 'string') return false;
  const status = getPath(props.ctx.runtime, key);
  return status != null && typeof status === 'object' && 'type' in status && status.type === 'error';
});
</script>

<template>
  <div class="setting-combobox">
    <UiCombobox
      :id="field.id ?? field.key"
      :model-value="String(value ?? '')"
      :label="field.label"
      :placeholder="field.placeholder"
      :options="options"
      :disabled="disabled"
      @update:model-value="emit('change', $event)"
    >
      <template v-if="field.refreshAction" #actions>
        <button
          type="button"
          class="combobox-refresh"
          :class="{ 'is-loading': loading }"
          :disabled="refreshDisabled"
          :aria-label="loading ? '正在获取模型列表' : field.refreshAction.label"
          :aria-busy="loading || undefined"
          :data-tip="field.refreshAction.label"
          @mousedown.prevent
          @click.stop="emit('refresh')"
        >
          <Loader2 v-if="loading" :size="14" class="refresh-spinner" />
          <RefreshCw v-else :size="14" />
        </button>
      </template>
    </UiCombobox>
    <p v-if="hint" class="combobox-hint" :class="{ 'is-error': isError }" :role="isError ? 'alert' : undefined">
      {{ hint }}
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.setting-combobox {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.combobox-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-muted;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: $accent-primary;
    background: $accent-subtle;
  }

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 1px;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.refresh-spinner {
  animation: spin 1s linear infinite;
}

.combobox-hint {
  color: $text-muted;
  font-size: 0.75rem;
  line-height: 1.4;

  &.is-error {
    color: $danger;
  }
}
</style>
