import { describe, it, expect } from 'vitest';
import {
  applyFieldChange,
  collectHydration,
  createSettingsMutator,
  firstInvalidSection,
  isFieldDisabled,
  isGroupVisible,
  listVisibleFields
} from './engine';
import { SettingsRegistry } from './registry';
import { SETTING_WIDGET, type SettingField, type SettingGroup, type SettingSection } from './types';

function stubSection(partial: Partial<SettingSection> & Pick<SettingSection, 'id' | 'title'>): SettingSection {
  return {
    category: '服务',
    icon: {} as SettingSection['icon'],
    groups: [],
    ...partial
  };
}

describe('settings engine', () => {
  it('writes value then applies declarative set / setRuntime effects', async () => {
    const mutator = createSettingsMutator({ a: '1', b: '2' }, { flag: 0 });
    const field: SettingField = {
      key: 'a',
      type: SETTING_WIDGET.TEXT,
      label: 'A',
      onChange: [{ set: { b: '3' } }, { setRuntime: { flag: 1 } }]
    };

    await applyFieldChange(field, 'x', mutator);

    expect(mutator.values.a).toBe('x');
    expect(mutator.values.b).toBe('3');
    expect(mutator.runtime.flag).toBe(1);
  });

  it('skips persist for action fields and still runs function onChange', async () => {
    const mutator = createSettingsMutator({}, { ran: false });
    const field: SettingField = {
      key: 'fetch',
      type: SETTING_WIDGET.ACTION,
      label: '拉取',
      persist: false,
      onChange: (_value, ctx) => {
        ctx.setRuntime('ran', true);
      }
    };

    await applyFieldChange(field, true, mutator);

    expect(mutator.values.fetch).toBeUndefined();
    expect(mutator.runtime.ran).toBe(true);
  });

  it('does not disable fields unless disabledWhen is set', () => {
    const ctx = createSettingsMutator({ a: '1' }, { busy: true });
    expect(
      isFieldDisabled({ key: 'a', type: SETTING_WIDGET.TEXT, label: 'A' }, ctx)
    ).toBe(false);
    expect(
      isFieldDisabled(
        {
          key: 'a',
          type: SETTING_WIDGET.ACTION,
          label: 'Go',
          disabledWhen: { runtime: 'busy', truthy: true }
        },
        ctx
      )
    ).toBe(true);
  });

  it('hides groups when all member fields fail visibleWhen', () => {
    const ctx = createSettingsMutator(
      { 'optimizer.apiKey': '' },
      { 'optimizer.models': [] },
      {}
    );
    const group: SettingGroup = {
      id: 'models',
      layout: 'subcard',
      visibleWhen: { field: 'optimizer.apiKey', truthy: true },
      fields: [
        {
          key: 'optimizer.model',
          type: SETTING_WIDGET.TEXT,
          label: '模型'
        }
      ]
    };

    expect(isGroupVisible(group, ctx)).toBe(false);

    ctx.setValue('optimizer.apiKey', 'sk-1');
    expect(isGroupVisible(group, ctx)).toBe(true);
  });

  it('filters mutually exclusive fields by runtime', () => {
    const ctx = createSettingsMutator({ 'optimizer.model': 'gpt-4o' }, { 'optimizer.models': [] });
    const fields: SettingField[] = [
      {
        id: 'optimizer.model.select',
        key: 'optimizer.model',
        type: SETTING_WIDGET.SELECT,
        label: '选择优化模型',
        visibleWhen: { runtime: 'optimizer.models', truthy: true }
      },
      {
        id: 'optimizer.model.text',
        key: 'optimizer.model',
        type: SETTING_WIDGET.TEXT,
        label: '模型名称',
        visibleWhen: { not: { runtime: 'optimizer.models', truthy: true } }
      }
    ];

    const hiddenList = listVisibleFields(fields, ctx).map((field) => field.id);
    expect(hiddenList).toEqual(['optimizer.model.text']);

    ctx.setRuntime('optimizer.models', ['gpt-4o']);
    const shownList = listVisibleFields(fields, ctx).map((field) => field.id);
    expect(shownList).toEqual(['optimizer.model.select']);
  });

  it('merges hydration slices and reports the first invalid section', () => {
    const image = stubSection({
      id: 'image',
      title: '生图服务',
      hydrate: () => ({
        values: { 'image.apiKey': '' },
        locks: { 'image.apiKey': false }
      }),
      validate: (ctx) => ({ ok: Boolean(ctx.values['image.apiKey']) })
    });
    const optimizer = stubSection({
      id: 'optimizer',
      title: '提示词优化',
      hydrate: () => ({
        values: { 'optimizer.apiKey': 'sk' },
        runtime: { 'optimizer.models': [] }
      })
    });

    const hydration = collectHydration([image, optimizer]);
    expect(hydration.values['image.apiKey']).toBe('');
    expect(hydration.values['optimizer.apiKey']).toBe('sk');
    expect(hydration.locks['image.apiKey']).toBe(false);
    expect(hydration.runtime['optimizer.models']).toEqual([]);

    expect(firstInvalidSection([image, optimizer], hydration)?.id).toBe('image');
  });

  it('groups registered sections by category in insertion order', () => {
    const registry = new SettingsRegistry();
    registry.register(stubSection({ id: 'image', title: '生图服务', category: '服务' }));
    registry.register(stubSection({ id: 'optimizer', title: '提示词优化', category: '服务' }));
    registry.register(stubSection({ id: 'appearance', title: '外观', category: '界面' }));

    const grouped = registry.listByCategory();
    expect(grouped.map((item) => item.category)).toEqual(['服务', '界面']);
    expect(grouped[0].sections.map((section) => section.id)).toEqual(['image', 'optimizer']);
  });
});
