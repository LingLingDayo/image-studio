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
</script>

<template>
  <div class="settings-pane">
    <p v-if="section?.description" class="pane-description">{{ section.description }}</p>

    <SettingsGroup
      v-for="group in visibleGroups"
      :key="group.id"
      :group="group"
      :session="session"
    />

    <div v-if="visibleGroups.length === 0" class="pane-empty">
      当前分区已由环境变量锁定，无需在此配置
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

.pane-description {
  font-size: 0.8rem;
  color: $text-muted;
  line-height: 1.5;
  margin-top: -4px;
}

.pane-empty {
  font-size: 0.85rem;
  color: $text-muted;
  background: #f8fafc;
  border: 1px dashed rgba(226, 232, 240, 0.95);
  border-radius: $radius-md;
  padding: 18px 16px;
  text-align: center;
}
</style>
