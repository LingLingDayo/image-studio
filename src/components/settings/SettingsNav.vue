<script setup lang="ts">
import type { SettingCategoryGroup, SettingSection } from '@/core/settings';

const props = defineProps<{
  categories: SettingCategoryGroup[];
  activeId: string;
}>();

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

function isActive(section: SettingSection): boolean {
  return section.id === props.activeId;
}
</script>

<template>
  <nav class="settings-nav" aria-label="设置分区">
    <div v-for="group in categories" :key="group.category" class="nav-category-block">
      <div class="nav-category">{{ group.category }}</div>
      <button
        v-for="section in group.sections"
        :key="section.id"
        type="button"
        class="nav-item"
        :class="{ 'is-active': isActive(section) }"
        :aria-label="section.title"
        :aria-current="isActive(section) ? 'page' : undefined"
        @click="emit('select', section.id)"
      >
        <component :is="section.icon" :size="15" />
        <span class="nav-label">{{ section.title }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.settings-nav {
  width: 168px;
  flex-shrink: 0;
  background: $bg-surface-subtle;
  border-right: 1px solid $border-color;
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
  min-height: 38px;
  border-radius: $radius-md;
  border: 1px solid transparent;
  background: transparent;
  color: $text-muted;
  font-size: 0.85rem;
  line-height: normal;
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
    background: $bg-surface-hover;
  }

  &.is-active {
    background: $bg-surface;
    color: $accent-primary;
    font-weight: 600;
    border-color: $border-color;
    box-shadow: $shadow-sm;
  }
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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