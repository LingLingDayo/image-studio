import { describe, expect, it, vi } from 'vitest';
import { useSettingsSession } from './useSettingsSession';
import { SETTING_WIDGET, type SettingSection } from '@/core/settings';

function section(id: string, value: string): SettingSection {
  return {
    id,
    title: id,
    category: '测试',
    icon: {},
    groups: [{ id, fields: [{ key: id, type: SETTING_WIDGET.TEXT, label: id }] }],
    hydrate: () => ({ values: { [id]: value } }),
    commit: vi.fn()
  };
}

describe('useSettingsSession', () => {
  it('只提交修改过的分区，恢复原值后不再视为修改', () => {
    const image = section('image', '');
    const general = section('general', 'default');
    const session = useSettingsSession();
    session.hydrate([image, general]);
    expect(session.hasChanges.value).toBe(false);

    session.mutator.setValue('general', 'custom');
    expect(session.changedSections([image, general])).toEqual([general]);
    session.commit(session.changedSections([image, general]));
    expect(image.commit).not.toHaveBeenCalled();
    expect(general.commit).toHaveBeenCalledOnce();
    expect(session.hasChanges.value).toBe(false);

    session.mutator.setValue('general', 'default');
    expect(session.hasChanges.value).toBe(true);
    session.hydrate([image, general]);
    session.mutator.setValue('general', 'custom');
    session.mutator.setValue('general', 'default');
    expect(session.hasChanges.value).toBe(false);
  });

  it('环境锁定值与瞬时状态不会产生可提交的修改', () => {
    const image = section('image', 'preset');
    image.hydrate = () => ({ values: { image: 'preset' }, locks: { image: true } });
    const session = useSettingsSession();
    session.hydrate([image]);
    session.mutator.setRuntime('loading', true);
    session.mutator.setValue('image', 'changed');
    expect(session.hasChanges.value).toBe(false);
    expect(session.changedSections([image])).toEqual([]);
  });

  it('重新打开设置后，旧会话的异步返回不能覆盖新草稿', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const image = section('image', 'original');
    image.onOpen = async (ctx) => {
      await pending;
      ctx.setValue('image', 'stale');
      ctx.setRuntime('status', 'stale');
    };
    const session = useSettingsSession();
    session.hydrate([image]);
    const opening = session.runOnOpen(image);
    session.hydrate([image]);
    session.mutator.setValue('image', 'new draft');
    release();
    await opening;
    expect(session.values.image).toBe('new draft');
    expect(session.runtime.status).toBeUndefined();
  });

  it('关闭会话后，未完成的字段操作不能继续写入', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const image = section('image', 'original');
    const field = image.groups[0].fields[0];
    field.onChange = async (_value, ctx) => {
      await pending;
      ctx.setValue('image', 'stale');
    };
    const session = useSettingsSession();
    session.hydrate([image]);
    const changing = session.change(field, 'draft');
    session.invalidate();
    release();
    await changing;
    expect(session.values.image).toBe('draft');
  });
});
