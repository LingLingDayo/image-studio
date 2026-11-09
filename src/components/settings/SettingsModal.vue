<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { X } from '@lucide/vue';
import { UiButton, UiDialog } from '@/components/ui';
import { useSettingsSession } from '@/composables/useSettingsSession';
import { firstInvalidSection } from '@/core/settings';
import { ensureSettingsCatalog } from '@/settings/catalog';
import { SETTING_SECTION } from '@/settings/keys';
import { registerSettingWidgets } from './registerWidgets';
import SettingsNav from './SettingsNav.vue';
import SettingsPane from './SettingsPane.vue';

registerSettingWidgets();

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    initialTab?: string;
  }>(),
  { initialTab: SETTING_SECTION.general }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const catalog = ensureSettingsCatalog();
const session = useSettingsSession();
const hasChanges = session.hasChanges;
const activeSectionId = ref(props.initialTab);
const dialogEl = ref<HTMLElement | null>(null);
const isDiscardDialogOpen = ref(false);
const saveAttempted = ref(false);
const saveError = ref('');
let previousFocus: HTMLElement | null = null;
let previousOverflow: string | null = null;

const categories = computed(() => catalog.listByCategory());
const sections = computed(() => catalog.list());
const activeSection = computed(() => catalog.get(activeSectionId.value) ?? sections.value[0] ?? null);
const changedSections = computed(() => session.changedSections(sections.value));
const validationMessage = computed(() => {
  if (!saveAttempted.value) return '';
  const keys = session.changedKeys.value;
  const invalid = firstInvalidSection(changedSections.value, session.ctx, keys);
  return invalid?.validate?.(session.ctx, keys).message ?? '';
});

function resolveSectionId(preferred?: string): string {
  if (preferred && catalog.has(preferred)) return preferred;
  return sections.value[0]?.id ?? '';
}

async function bootstrap(): Promise<void> {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  session.hydrate(sections.value);
  activeSectionId.value = resolveSectionId(props.initialTab);
  saveAttempted.value = false;
  saveError.value = '';
  isDiscardDialogOpen.value = false;
  void session.runOnOpen(activeSection.value ?? undefined);
  await nextTick();
  if (!props.isOpen) return;
  const target = dialogEl.value?.querySelector<HTMLElement>('.settings-content input, .nav-item.is-active');
  target?.focus();
}

function selectSection(id: string): void {
  if (id === activeSectionId.value) return;
  activeSectionId.value = id;
  saveError.value = '';
  void session.runOnOpen(catalog.get(id));
  void nextTick(() => {
    const content = dialogEl.value?.querySelector<HTMLElement>('.settings-content');
    if (content) content.scrollTop = 0;
  });
}

function requestClose(): void {
  if (hasChanges.value) {
    isDiscardDialogOpen.value = true;
    return;
  }
  emit('close');
}

function discardChanges(): void {
  isDiscardDialogOpen.value = false;
  emit('close');
}

async function keepEditing(): Promise<void> {
  isDiscardDialogOpen.value = false;
  await nextTick();
  dialogEl.value?.querySelector<HTMLElement>('.btn-close')?.focus();
}

function handleSave(): void {
  if (!hasChanges.value) return;
  saveAttempted.value = true;
  saveError.value = '';
  const invalid = firstInvalidSection(changedSections.value, session.ctx, session.changedKeys.value);
  if (invalid) {
    selectSection(invalid.id);
    void nextTick(() => dialogEl.value?.querySelector<HTMLElement>('.settings-error')?.focus());
    return;
  }

  try {
    session.commit(changedSections.value);
    emit('saved');
    emit('close');
  } catch {
    saveError.value = '设置未能保存，请检查浏览器是否允许本地存储后重试。';
  }
}

function focusableElements(root: HTMLElement | null = dialogEl.value): HTMLElement[] {
  const elements = root?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
  );
  return [...(elements ?? [])].filter((element) =>
    !element.closest('[hidden], [inert]') &&
    (!element.closest('details:not([open])') || element.tagName === 'SUMMARY')
  );
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!props.isOpen || event.defaultPrevented || event.isComposing) return;
  const focusRoot = isDiscardDialogOpen.value
    ? document.querySelector<HTMLElement>('.dialog-container')
    : dialogEl.value;
  if (event.key === 'Escape' && !isDiscardDialogOpen.value) {
    event.preventDefault();
    requestClose();
  } else if (event.key === 'Tab') {
    const elements = focusableElements(focusRoot);
    const first = elements[0];
    const last = elements[elements.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !focusRoot?.contains(active))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (active === last || !focusRoot?.contains(active))) {
      event.preventDefault();
      first?.focus();
    }
  }
}

function releaseDialog(): void {
  session.invalidate();
  if (previousOverflow !== null) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = null;
  }
  if (previousFocus?.isConnected) previousFocus.focus();
  previousFocus = null;
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) void bootstrap();
    else releaseDialog();
  },
  { immediate: true }
);

onMounted(() => window.addEventListener('keydown', handleKeyDown));
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  releaseDialog();
});
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="requestClose">
    <div ref="dialogEl" class="config-dialog" :inert="isDiscardDialogOpen || undefined" :aria-hidden="isDiscardDialogOpen || undefined" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="dialog-header">
        <div>
          <h3 id="settings-title">设置</h3>
          <p>连接服务，调整使用偏好</p>
        </div>
        <button class="btn-close" type="button" aria-label="关闭设置" @click="requestClose">
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
          <p v-if="validationMessage || saveError" class="settings-error" role="alert" tabindex="-1">
            {{ validationMessage || saveError }}
          </p>
          <SettingsPane :key="activeSection?.id" :section="activeSection" :session="session" />
        </div>
      </div>

      <div class="dialog-footer">
        <p class="save-hint">{{ hasChanges ? '修改尚未保存' : '修改后点击保存' }}</p>
        <div class="footer-actions">
          <UiButton variant="secondary" @click="requestClose">关闭</UiButton>
          <UiButton variant="primary" :disabled="!hasChanges" @click="handleSave">保存设置</UiButton>
        </div>
      </div>
    </div>
  </div>
  <UiDialog
    :is-open="isOpen && isDiscardDialogOpen"
    type="warning"
    title="放弃未保存的修改？"
    description="关闭后，这次修改不会保留。"
    confirm-text="放弃修改"
    cancel-text="继续编辑"
    :confirm-on-enter="false"
    @confirm="discardChanges"
    @close="keepEditing"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: $overlay;
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.config-dialog {
  max-width: 760px;
  height: min(640px, calc(100dvh - 48px));
  width: 100%;
  background: $bg-surface;
  border: 1px solid $border-color;
  border-radius: $radius-xl;
  box-shadow: $shadow-float;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid $border-light;
  flex-shrink: 0;

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: $text-main;
  }

  p {
    font-size: 0.8rem;
    color: $text-muted;
    margin-top: 2px;
  }
}

.btn-close {
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: $text-muted;
  cursor: pointer;
  border-radius: $radius-md;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: $bg-surface-hover;
    color: $text-main;
  }

  &:focus-visible {
    outline: 2px solid $border-focus;
    outline-offset: 2px;
  }
}

.settings-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.settings-content {
  flex: 1;
  min-width: 0;
  padding: 24px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.settings-error {
  margin-bottom: 18px;
  padding: 10px 12px;
  border-radius: $radius-md;
  background: $danger-subtle;
  color: $danger;
  font-size: 0.8rem;
  line-height: 1.5;
}

.dialog-footer {
  padding: 16px 24px;
  border-top: 1px solid $border-light;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.save-hint {
  color: $text-muted;
  font-size: 0.75rem;
}

.footer-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: 12px;
  }

  .config-dialog {
    height: calc(100dvh - 24px);
  }

  .settings-layout {
    flex-direction: column;
  }

  .dialog-header,
  .settings-content {
    padding: 18px;
  }

  .dialog-footer {
    padding: 12px 18px;
    flex-wrap: wrap;
  }
}
</style>
