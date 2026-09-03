<script setup lang="ts">
import { UiButton } from '@/components/ui';
import type { SettingWidgetProps } from '@/core/settings';

defineProps<SettingWidgetProps>();

const emit = defineEmits<{
  (e: 'change', value: boolean): void;
}>();
</script>

<template>
  <UiButton
    size="sm"
    variant="secondary"
    :disabled="disabled"
    :loading="loading"
    @click="emit('change', true)"
  >
    <template v-if="field.icon" #icon>
      <component :is="field.icon" :size="13" />
    </template>
    {{ loading ? String(field.props?.loadingLabel ?? '处理中...') : field.label }}
  </UiButton>
</template>
