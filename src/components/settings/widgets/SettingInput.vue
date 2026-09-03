<script setup lang="ts">
import { computed } from 'vue';
import { UiInput } from '@/components/ui';
import { SETTING_WIDGET, type SettingWidgetProps } from '@/core/settings';

const props = defineProps<SettingWidgetProps>();

const emit = defineEmits<{
  (e: 'change', value: string): void;
}>();

const stringValue = computed(() => {
  if (props.value == null) return '';
  return String(props.value);
});

const inputType = computed(() => (props.field.type === SETTING_WIDGET.PASSWORD ? 'password' : 'text'));
</script>

<template>
  <UiInput
    :id="field.id ?? field.key"
    :model-value="stringValue"
    :label="field.label"
    :placeholder="field.placeholder"
    :required="field.required"
    :disabled="disabled"
    :type="inputType"
    :mono="Boolean(field.props?.mono)"
    :show-password-toggle="
      field.type === SETTING_WIDGET.PASSWORD || Boolean(field.props?.showPasswordToggle)
    "
    :hint="hint"
    @update:model-value="emit('change', $event)"
  >
    <template v-if="field.icon" #label-prefix>
      <component :is="field.icon" :size="14" />
    </template>
  </UiInput>
</template>
