<script setup lang="ts">
import { computed } from 'vue';
import { UiSelect } from '@/components/ui';
import type { SettingWidgetProps } from '@/core/settings';

const props = defineProps<SettingWidgetProps>();

const emit = defineEmits<{
  (e: 'change', value: string | number | boolean): void;
}>();

const selectValue = computed(() => {
  if (props.value == null) return '';
  return props.value;
});
</script>

<template>
  <div class="setting-select">
    <label v-if="field.label" class="setting-select-label">
      <component v-if="field.icon" :is="field.icon" :size="13" />
      <span>{{ field.label }}</span>
    </label>
    <UiSelect
      :model-value="selectValue"
      :options="options"
      placement="bottom"
      variant="default"
      size="md"
      block
      :disabled="disabled"
      @update:model-value="emit('change', $event)"
    />
    <p v-if="hint" class="setting-select-hint">{{ hint }}</p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.setting-select {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.setting-select-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 600;
  color: $text-muted;
}

.setting-select-hint {
  font-size: 0.75rem;
  color: $text-muted;
  line-height: 1.4;
}
</style>
