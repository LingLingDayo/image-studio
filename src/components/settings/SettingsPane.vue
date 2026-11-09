<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsSession } from '@/composables/useSettingsSession';
import { listVisibleGroups, type SettingSection } from '@/core/settings';
import SettingsGroup from './SettingsGroup.vue';

const props = defineProps<{
  section: SettingSection | null;
  session: SettingsSession;
}>();

const visibleGroups = computed(() => {
  if (!props.section) return [];
  return listVisibleGroups(props.section.groups, props.session.ctx);
});

const hasDeploymentPreset = computed(() => props.section?.groups.some((group) =>
  group.fields.some((field) => props.session.locks[field.key])
));
</script>

<template>
  <div class="settings-pane">
    <div class="pane-heading">
      <h4 v-if="section">{{ section.title }}</h4>
      <p v-if="section?.description" class="pane-description">{{ section.description }}</p>
    </div>
    <p v-if="hasDeploymentPreset" class="deployment-notice">
      部分接口凭据由部署预设，隐藏项无需重复填写。
    </p>

    <SettingsGroup
      v-for="group in visibleGroups"
      :key="group.id"
      :group="group"
      :session="session"
    />

    <div v-if="visibleGroups.length === 0" class="pane-empty">
      本分区暂无需要填写的设置
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100%;
}

.pane-heading {
  display: flex;
  flex-direction: column;
  gap: 6px;

  h4 {
    font-size: 1rem;
    font-weight: 600;
    color: $text-main;
  }
}

.deployment-notice {
  color: $text-muted;
  background: $bg-surface-subtle;
  border-radius: $radius-md;
  padding: 10px 12px;
  font-size: 0.78rem;
  line-height: 1.5;
}

.pane-description {
  font-size: 0.8rem;
  color: $text-muted;
  line-height: 1.5;
}

.pane-empty {
  font-size: 0.85rem;
  color: $text-muted;
  background: $bg-surface-subtle;
  border: 1px dashed $border-color;
  border-radius: $radius-md;
  padding: 18px 16px;
  text-align: center;
}
</style>
