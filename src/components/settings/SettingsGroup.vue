<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsSession } from '@/composables/useSettingsSession';
import { fieldId, isFieldVisible, listVisibleFields, type SettingGroup } from '@/core/settings';
import SettingsField from './SettingsField.vue';

const props = defineProps<{
  group: SettingGroup;
  session: SettingsSession;
}>();

const bodyFields = computed(() => {
  const skip = props.group.headerActionId ? new Set([props.group.headerActionId]) : undefined;
  return listVisibleFields(props.group.fields, props.session.ctx, skip);
});

const headerField = computed(() => {
  const id = props.group.headerActionId;
  if (!id) return null;
  const field = props.group.fields.find((item) => fieldId(item) === id);
  if (!field || !isFieldVisible(field, props.session.ctx)) return null;
  return field;
});

const isSubcard = computed(() => props.group.layout === 'subcard');
</script>

<template>
  <section class="settings-group" :class="{ 'is-subcard': isSubcard }">
    <div v-if="group.title || headerField" class="group-header">
      <div class="group-title">
        <component v-if="group.icon" :is="group.icon" :size="14" />
        <span v-if="group.title">{{ group.title }}</span>
      </div>
      <SettingsField v-if="headerField" :field="headerField" :session="session" />
    </div>

    <p v-if="group.description" class="group-description">{{ group.description }}</p>

    <div class="group-fields">
      <SettingsField
        v-for="field in bodyFields"
        :key="fieldId(field)"
        :field="field"
        :session="session"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &.is-subcard {
    background: #f8fafc;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: $radius-lg;
    padding: 14px;
  }
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: $text-main;
}

.group-description {
  font-size: 0.78rem;
  color: $text-muted;
  line-height: 1.45;
}

.group-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
