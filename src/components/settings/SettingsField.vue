<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsSession } from '@/composables/useSettingsSession';
import {
  getPath,
  isFieldDisabled,
  isTruthy,
  widgetRegistry,
  type SettingField,
  type SettingSelectOption,
  type SettingValue
} from '@/core/settings';
import { registerSettingWidgets } from './registerWidgets';

registerSettingWidgets();

const props = defineProps<{
  field: SettingField;
  session: SettingsSession;
}>();

const widget = computed(() => widgetRegistry.tryGet(props.field.type));

const value = computed<SettingValue>(() => props.session.values[props.field.key] ?? null);

const disabled = computed(() => isFieldDisabled(props.field, props.session.ctx));

const hint = computed(() => {
  const raw = props.field.hint;
  if (typeof raw === 'function') return raw(props.session.ctx) || '';
  return raw || props.field.description || '';
});

const options = computed<SettingSelectOption[]>(() => {
  const raw = props.field.options;
  if (!raw) return [];
  return typeof raw === 'function' ? raw(props.session.ctx) : raw;
});

const loading = computed(() => {
  const key = props.field.props?.loadingRuntimeKey;
  if (typeof key !== 'string' || !key) return false;
  return isTruthy(getPath(props.session.runtime, key));
});

function handleChange(next: SettingValue): void {
  void props.session.change(props.field, next);
}
</script>

<template>
  <component
    v-if="widget"
    :is="widget"
    :field="field"
    :value="value"
    :ctx="session.ctx"
    :disabled="disabled"
    :hint="hint"
    :options="options"
    :loading="loading"
    @change="handleChange"
  />
  <div v-else class="unknown-widget">未知设置控件：{{ field.type }}</div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.unknown-widget {
  font-size: 0.78rem;
  color: $danger;
  padding: 8px 10px;
  background: $danger-subtle;
  border-radius: $radius-sm;
}
</style>
