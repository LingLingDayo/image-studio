<script setup lang="ts">
import { computed } from 'vue';
import type { SettingsSession } from '@/composables/useSettingsSession';
import type { SettingCategoryGroup, SettingSection } from '@/core/settings';

const props = defineProps<{
  categories: SettingCategoryGroup[];
  activeId: string;
  session: SettingsSession;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const items = computed(() =>
  props.categories.map((group) => ({
    category: group.category,
    sections: group.sections.map((section) => ({
      section,
      badge: section.badge?.(props.session.ctx) ?? 'none'
    }))
  }))
);

function isActive(section: SettingSection): boolean {
  return section.id === props.activeId;
}
</script>

<template>
  <nav class="settings-nav" aria-label="设置分区">
    <div v-for="group in items" :key="group.category" class="nav-category-block">
      <div class="nav-category">{{ group.category }}</div>
      <button
        v-for="item in group.sections"
        :key="item.section.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': isActive(item.section) }"
        :aria-label="item.section.title"
        :aria-current="isActive(item.section) ? 'page' : undefined"
        @click="emit('select', item.section.id)"
      >
        <component :is="item.section.icon" :size="15" />
        <span class="nav-label">{{ item.section.title }}</span>
        <span
          v-if="item.badge === 'ready'"
          class="badge-configured"
          data-tip="已填写"
          role="img"
          aria-label="已填写"
        ></span>
        <span
          v-else-if="item.badge === 'warn'"
          class="badge-warn"
          data-tip="待完善"
          role="img"
          aria-label="待完善"
        ></span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-nav {
  width: 168px;
  flex-shrink: 0;
  background: #f8fafc;
  border-right: 1px solid rgba(226, 232, 240, 0.8);
  padding: 12px 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-category-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-category {
  font-size: 0.72rem;
  font-weight: 600;
  color: $text-muted;
  letter-spacing: 0.04em;
  padding: 4px 10px 6px;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: $radius-md;
  border: 1px solid transparent;
  background: transparent;
  color: $text-muted;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 2px;
  }

  &:hover {
    color: $text-main;
    background: rgba(255, 255, 255, 0.7);
  }

  &.is-active {
    background: #ffffff;
    color: $accent-primary;
    font-weight: 600;
    border-color: rgba(226, 232, 240, 0.9);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge-configured,
.badge-warn {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.badge-configured {
  background: $success;
}

.badge-warn {
  background: $warning;
}

@media (max-width: 640px) {
  .settings-nav {
    width: 100%;
    flex-direction: row;
    gap: 6px;
    padding: 10px 12px;
    border-right: none;
    border-bottom: 1px solid $border-color;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .nav-category-block {
    display: contents;
  }

  .nav-category {
    display: none;
  }

  .nav-item {
    width: auto;
    min-width: 0;
    flex: 1;
    gap: 6px;
    padding: 8px;
    font-size: 0.8rem;
  }
}
@media (max-width: 360px) {
  .nav-item > svg {
    display: none;
  }
}
</style>