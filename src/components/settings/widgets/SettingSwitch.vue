<script setup lang="ts">
import { computed } from 'vue';
import { UiSwitch } from '@/components/ui';
import type { SettingWidgetProps } from '@/core/settings';

const props = defineProps<SettingWidgetProps>();

const emit = defineEmits<{
  (e: 'change', value: boolean): void;
}>();

const checked = computed(() => Boolean(props.value));
</script>

<template>
  <div class="setting-switch" :class="{ 'is-disabled': disabled }">
    <div class="setting-switch-copy">
      <span class="setting-switch-label">{{ field.label }}</span>
      <span v-if="hint" class="setting-switch-hint">{{ hint }}</span>
    </div>
    <UiSwitch
      :model-value="checked"
      :disabled="disabled"
      size="md"
      @update:model-value="emit('change', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.setting-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;

  &.is-disabled {
    opacity: 0.55;
  }
}

.setting-switch-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-switch-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: $text-secondary;
}

.setting-switch-hint {
  font-size: 0.75rem;
  color: $text-muted;
  line-height: 1.4;
}
</style>
