<script setup lang="ts">
import { computed } from 'vue';
import { AlertCircle, CheckCircle2, Info } from 'lucide-vue-next';
import { getPath, type SettingWidgetProps } from '@/core/settings';

const props = defineProps<SettingWidgetProps>();

const status = computed<{ type: string; message: string } | null>(() => {
  const staticMessage = props.field.props?.message;
  if (typeof staticMessage === 'string' && staticMessage) {
    return {
      type: String(props.field.props?.tone ?? 'info'),
      message: staticMessage
    };
  }

  const runtimeKey = String(props.field.props?.runtimeKey ?? props.field.key);
  const raw = getPath(props.ctx.runtime, runtimeKey);
  if (raw && typeof raw === 'object' && 'message' in raw) {
    const record = raw as { type?: string; message?: string };
    return {
      type: record.type || 'info',
      message: record.message || ''
    };
  }

  return null;
});
</script>

<template>
  <div v-if="status && status.type !== 'idle' && status.message" class="setting-status" :class="status.type">
    <CheckCircle2 v-if="status.type === 'success'" :size="13" />
    <AlertCircle v-else-if="status.type === 'error'" :size="13" />
    <Info v-else :size="13" />
    <span>{{ status.message }}</span>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.setting-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  padding: 6px 10px;
  border-radius: $radius-sm;

  &.success {
    background: $success-subtle;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  &.error {
    background: $danger-subtle;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  &.info,
  &.warning {
    background: $accent-subtle;
    color: $accent-primary;
    border: 1px solid rgba(37, 99, 235, 0.18);
  }
}
</style>
