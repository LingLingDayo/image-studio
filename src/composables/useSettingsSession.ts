import { reactive } from 'vue';
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

  const ctx: SettingsContext = { values, runtime, locks };

  const mutator: SettingsMutator = {
    get values() {
      return values;
    },
    get runtime() {
      return runtime;
    },
    get locks() {
      return locks;
    },
    setValue(key, value) {
      values[key] = value;
    },
    setRuntime(key, value) {
      runtime[key] = value;
    }
  };

  function hydrate(sections: SettingSection[]): void {
    const next = collectHydration(sections);
    replaceReactive(values, next.values);
    replaceReactive(runtime, next.runtime);
    replaceReactive(locks as Record<string, unknown>, next.locks);
  }

  function commit(sections: SettingSection[]): void {
    for (const section of sections) {
      section.commit?.(ctx);
    }
  }

  async function change(field: SettingField, value: SettingValue): Promise<void> {
    await applyFieldChange(field, value, mutator);
  }

  async function runOnOpen(section: SettingSection | undefined): Promise<void> {
    if (!section?.onOpen) return;
    await section.onOpen(mutator);
  }

  return {
    values,
    runtime,
    locks,
    ctx,
    mutator,
    hydrate,
    commit,
    change,
    runOnOpen
  };
}

export type SettingsSession = ReturnType<typeof useSettingsSession>;
