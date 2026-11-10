<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown } from '@lucide/vue';
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
  <component :is="group.collapsible ? 'details' : 'section'" class="settings-group" :class="{ 'is-subcard': isSubcard }">
    <component :is="group.collapsible ? 'summary' : 'div'" v-if="group.title || headerField" class="group-header">
      <div class="group-title">
        <component v-if="group.icon" :is="group.icon" :size="14" />
        <span v-if="group.title">{{ group.title }}</span>
      </div>
      <SettingsField v-if="headerField" :field="headerField" :session="session" />
      <ChevronDown v-if="group.collapsible" :size="14" class="collapse-icon" />
    </component>

    <p v-if="group.description" class="group-description">{{ group.description }}</p>

    <div class="group-fields">
      <SettingsField
        v-for="field in bodyFields"
        :key="fieldId(field)"
        :field="field"
        :session="session"
      />
    </div>
  </component>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &.is-subcard {
    background: $bg-surface-subtle;
    border: 1px solid $border-color;
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

summary.group-header {
  cursor: pointer;
  list-style: none;
  padding: 10px 0;

  &::-webkit-details-marker {
    display: none;
  }

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 2px;
    border-radius: $radius-sm;
  }
}

.collapse-icon {
  color: $text-muted;
}

details[open] .collapse-icon {
  transform: rotate(180deg);
}

details.settings-group {
  display: block;
  border-top: 1px solid $border-color;

  .group-description,
  .group-fields {
    margin-top: 12px;
  }
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  font-size: 0.85rem;
  line-height: normal;
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
