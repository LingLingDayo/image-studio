import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createSettingsMutator, SETTING_WIDGET } from '@/core/settings';
import { useConfigStore } from '@/stores/configStore';
import { generalSection } from './general.section';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_SECTION } from './keys';

describe('general section schema', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('has correct section metadata and fields', () => {
    expect(generalSection.id).toBe(SETTING_SECTION.general);
    expect(generalSection.category).toBe(SETTING_CATEGORY.general);
    expect(generalSection.title).toBe('通用设置');

    const interactionGroup = generalSection.groups.find((g) => g.id === 'general.interaction');
    expect(interactionGroup).toBeDefined();
    const switchField = interactionGroup?.fields.find((f) => f.key === SETTING_KEYS.clearPromptOnGenerate);
    expect(switchField).toBeDefined();
    expect(switchField?.type).toBe(SETTING_WIDGET.SWITCH);
    expect(switchField?.label).toContain('清空输入框');

    const downloadGroup = generalSection.groups.find((g) => g.id === 'general.download');
    expect(downloadGroup).toBeDefined();
    const patternField = downloadGroup?.fields.find((f) => f.key === SETTING_KEYS.downloadFilenamePattern);
    expect(patternField).toBeDefined();
    expect(patternField?.type).toBe(SETTING_WIDGET.TEXT);

    const formatField = downloadGroup?.fields.find((f) => f.key === SETTING_KEYS.downloadImageFormat);
    expect(formatField).toBeDefined();
    expect(formatField?.type).toBe(SETTING_WIDGET.SELECT);
  });

  it('hydrates default values from store and commits changes', () => {
    const store = useConfigStore();
    expect(store.clearPromptOnGenerate).toBe(false);
    expect(store.downloadFilenamePattern).toBe('{prefix}_{date}_{time}_{id}');
    expect(store.downloadImageFormat).toBe('auto');

    const slice = generalSection.hydrate!();
    expect(slice.values[SETTING_KEYS.clearPromptOnGenerate]).toBe(false);
    expect(slice.values[SETTING_KEYS.downloadFilenamePattern]).toBe('{prefix}_{date}_{time}_{id}');
    expect(slice.values[SETTING_KEYS.downloadImageFormat]).toBe('auto');

    const ctx = createSettingsMutator(
      {
        [SETTING_KEYS.clearPromptOnGenerate]: true,
        [SETTING_KEYS.downloadFilenamePattern]: '{type}_{prompt}_{time}',
        [SETTING_KEYS.downloadImageFormat]: 'webp'
      },
      {}
    );

    generalSection.commit!(ctx);

    expect(store.clearPromptOnGenerate).toBe(true);
    expect(store.downloadFilenamePattern).toBe('{type}_{prompt}_{time}');
    expect(store.downloadImageFormat).toBe('webp');
  });
});
