<script setup lang="ts">
import type { SettingValue, SettingWidgetProps } from '@/core/settings';

defineProps<SettingWidgetProps>();

const emit = defineEmits<{
  (e: 'change', value: SettingValue): void;
}>();
</script>

<template>
  <component
    v-if="field.component"
    :is="field.component"
    v-bind="field.props"
    :field="field"
    :value="value"
    :ctx="ctx"
    :disabled="disabled"
    :hint="hint"
    @change="emit('change', $event)"
  />
</template>
