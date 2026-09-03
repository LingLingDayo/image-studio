import type {
  SettingEffect,
  SettingField,
  SettingGroup,
  SettingSection,
  SettingValue,
  SettingsContext,
  SettingsMutator,
  SettingHydration
} from './types';
import { evaluatePredicate } from './predicates';

export function fieldId(field: SettingField): string {
  return field.id ?? field.key;
}

export function createSettingsMutator(
  values: Record<string, SettingValue>,
  runtime: Record<string, unknown>,
  locks: Record<string, boolean> = {}
): SettingsMutator {
  return {
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
}

export function applyEffects(effects: SettingEffect[], mutator: SettingsMutator): void {
  for (const effect of effects) {
    if ('set' in effect) {
      for (const [key, value] of Object.entries(effect.set)) {
        mutator.setValue(key, value);
      }
    }
    if ('setRuntime' in effect) {
      for (const [key, value] of Object.entries(effect.setRuntime)) {
        mutator.setRuntime(key, value);
      }
    }
  }
}

/**
 * 字段变更管道：先写入草稿值，再执行声明式 effect 或函数型 onChange。
 * Extension Point: 后续可在此插入校验中间件 / 审计日志，而不改字段 schema。
 */
export async function applyFieldChange(
  field: SettingField,
  value: SettingValue,
  mutator: SettingsMutator
): Promise<void> {
  if (field.persist !== false) {
    mutator.setValue(field.key, value);
  }

  if (!field.onChange) return;

  if (typeof field.onChange === 'function') {
    await field.onChange(value, mutator);
    return;
  }

  applyEffects(field.onChange, mutator);
}

export function isFieldVisible(field: SettingField, ctx: SettingsContext): boolean {
  return evaluatePredicate(field.visibleWhen, ctx);
}

export function isFieldDisabled(field: SettingField, ctx: SettingsContext): boolean {
  if (!field.disabledWhen) return false;
  return evaluatePredicate(field.disabledWhen, ctx);
}

export function listVisibleFields(
  fields: SettingField[],
  ctx: SettingsContext,
  skipIds?: Set<string>
): SettingField[] {
  return fields.filter((field) => {
    if (skipIds?.has(fieldId(field))) return false;
    return isFieldVisible(field, ctx);
  });
}

export function isGroupVisible(group: SettingGroup, ctx: SettingsContext): boolean {
  if (!evaluatePredicate(group.visibleWhen, ctx)) return false;

  const headerId = group.headerActionId;
  const skip = headerId ? new Set([headerId]) : undefined;
  if (listVisibleFields(group.fields, ctx, skip).length > 0) return true;

  if (headerId) {
    const header = group.fields.find((field) => fieldId(field) === headerId);
    if (header && isFieldVisible(header, ctx)) return true;
  }

  return false;
}

export function listVisibleGroups(groups: SettingGroup[], ctx: SettingsContext): SettingGroup[] {
  return groups.filter((group) => isGroupVisible(group, ctx));
}

export function collectHydration(sections: SettingSection[]): Required<SettingHydration> {
  const values: Record<string, SettingValue> = {};
  const locks: Record<string, boolean> = {};
  const runtime: Record<string, unknown> = {};

  for (const section of sections) {
    if (!section.hydrate) continue;
    const slice = section.hydrate();
    Object.assign(values, slice.values);
    if (slice.locks) Object.assign(locks, slice.locks);
    if (slice.runtime) Object.assign(runtime, slice.runtime);
  }

  return { values, locks, runtime };
}

export function firstInvalidSection(
  sections: SettingSection[],
  ctx: SettingsContext
): SettingSection | null {
  for (const section of sections) {
    if (!section.validate) continue;
    if (!section.validate(ctx).ok) return section;
  }
  return null;
}
