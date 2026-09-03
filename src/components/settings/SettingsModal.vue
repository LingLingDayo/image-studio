<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Key, Save, X } from 'lucide-vue-next';
import { UiButton } from '@/components/ui';
import { useSettingsSession } from '@/composables/useSettingsSession';
import { firstInvalidSection } from '@/core/settings';
import { ensureSettingsCatalog } from '@/settings/catalog';
import { registerSettingWidgets } from './registerWidgets';
import SettingsNav from './SettingsNav.vue';
import SettingsPane from './SettingsPane.vue';

registerSettingWidgets();

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    initialTab?: string;
  }>(),
  {
    initialTab: 'image'
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const catalog = ensureSettingsCatalog();
const session = useSettingsSession();
const activeSectionId = ref(props.initialTab);

const categories = computed(() => catalog.listByCategory());
const sections = computed(() => catalog.list());
const activeSection = computed(() => catalog.get(activeSectionId.value) ?? sections.value[0] ?? null);

const canSave = computed(() => firstInvalidSection(sections.value, session.ctx) == null);

function resolveSectionId(preferred?: string): string {
  if (preferred && catalog.has(preferred)) return preferred;
  return sections.value[0]?.id ?? '';
}

async function bootstrap(): Promise<void> {
  const list = catalog.list();
  session.hydrate(list);
  activeSectionId.value = resolveSectionId(props.initialTab);
  await session.runOnOpen(catalog.get(activeSectionId.value));
}

function selectSection(id: string): void {
  if (id === activeSectionId.value) return;
  activeSectionId.value = id;
  void session.runOnOpen(catalog.get(id));
}

function handleSave(): void {
  const invalid = firstInvalidSection(sections.value, session.ctx);
  if (invalid) {
    activeSectionId.value = invalid.id;
    return;
  }

  session.commit(sections.value);
  emit('saved');
  emit('close');
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      void bootstrap();
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="emit('close')">
    <div class="config-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <div class="icon-circle">
            <Key :size="18" />
          </div>
          <div>
            <h3 id="settings-title">系统设置</h3>
            <p>管理生图接口与提示词优化大模型配置</p>
          </div>
        </div>
        <button class="btn-close" type="button" aria-label="关闭" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="settings-layout">
        <SettingsNav
          :categories="categories"
          :active-id="activeSectionId"
          :session="session"
          @select="selectSection"
        />
        <div class="settings-content">
          <SettingsPane :section="activeSection" :session="session" />
        </div>
      </div>

      <div class="dialog-footer">
        <UiButton variant="secondary" @click="emit('close')">取消</UiButton>
        <UiButton variant="primary" :disabled="!canSave" @click="handleSave">
          <template #icon>
            <Save :size="15" />
          </template>
          保存设置
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.config-dialog {
  max-width: 780px;
  width: 100%;
  max-height: 90vh;
  background: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 20px;
  box-shadow: $shadow-float;
  display: flex;
  flex-direction: column;
  animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(241, 245, 249, 0.9);
}

.dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;

  .icon-circle {
    width: 38px;
    height: 38px;
    border-radius: $radius-lg;
    background: $accent-subtle;
    color: $accent-primary;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: $text-main;
  }

  p {
    font-size: 0.8rem;
    color: $text-muted;
  }
}

.btn-close {
  background: none;
  border: none;
  color: $text-dim;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s ease;

  &:hover {
    background: #f1f5f9;
    color: $text-main;
  }
}

.settings-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  max-height: calc(90vh - 150px);
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: 20px 22px;
  overflow-y: auto;
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(241, 245, 249, 0.9);
  background: #ffffff;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
