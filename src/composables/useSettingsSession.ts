import { computed, reactive } from 'vue';
import type {
  SettingField,
  SettingSection,
  SettingValue,
  SettingsContext,
  SettingsMutator
} from '@/core/settings';
import { applyFieldChange, collectHydration } from '@/core/settings';

function replaceReactive(target: Record<string, unknown>, next: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    if (!(key in next)) {
      delete target[key];
    }
  }
  Object.assign(target, next);
}

export function useSettingsSession() {
  const values = reactive<Record<string, SettingValue>>({});
  const runtime = reactive<Record<string, unknown>>({});
  const locks = reactive<Record<string, boolean>>({});
  const baseline = reactive<Record<string, SettingValue>>({});
  let revision = 0;

  const ctx: SettingsContext = { values, runtime, locks };
  const mutator: SettingsMutator = {
    values,
    runtime,
    locks,
    setValue(key, value) {
      values[key] = value;
    },
    setRuntime(key, value) {
      runtime[key] = value;
    }
  };

  function isChanged(key: string): boolean {
    return !locks[key] && !Object.is(values[key], baseline[key]);
  }

  const hasChanges = computed(() => Object.keys(values).some(isChanged));

  function changedSections(sections: SettingSection[]): SettingSection[] {
    return sections.filter((section) => section.groups.some((group) =>
      group.fields.some((field) => field.persist !== false && isChanged(field.key))
    ));
  }

  function invalidate(): void {
    revision += 1;
  }

  // 关闭或重开弹窗后，旧异步操作不能再写入当前草稿。
  function scopedMutator(): SettingsMutator {
    const currentRevision = revision;
    return {
      values,
      runtime,
      locks,
      setValue(key, value) {
        if (currentRevision !== revision) return;
        mutator.setValue(key, value);
      },
      setRuntime(key, value) {
        if (currentRevision !== revision) return;
        mutator.setRuntime(key, value);
      }
    };
  }

  function hydrate(sections: SettingSection[]): void {
    invalidate();
    const next = collectHydration(sections);
    replaceReactive(values, next.values);
    replaceReactive(baseline, next.values);
    replaceReactive(runtime, next.runtime);
    replaceReactive(locks as Record<string, unknown>, next.locks);
  }

  function commit(sections: SettingSection[]): void {
    for (const section of sections) {
      section.commit?.(ctx);
      for (const group of section.groups) {
        for (const field of group.fields) {
          if (field.persist !== false) baseline[field.key] = values[field.key];
        }
      }
    }
  }

  async function change(field: SettingField, value: SettingValue): Promise<void> {
    await applyFieldChange(field, value, scopedMutator());
  }

  async function runOnOpen(section: SettingSection | undefined): Promise<void> {
    if (!section?.onOpen) return;
    await section.onOpen(scopedMutator());
  }

  return {
    values,
    runtime,
    locks,
    ctx,
    mutator,
    hasChanges,
    changedSections,
    invalidate,
    hydrate,
    commit,
    change,
    runOnOpen
  };
}

export type SettingsSession = ReturnType<typeof useSettingsSession>;
