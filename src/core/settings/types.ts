import type { Component } from 'vue';

export interface SettingSelectOption {
  label: string;
  value: string | number | boolean;
  description?: string;
  disabled?: boolean;
}

/**
 * 设置项可持久化的标量值。
 * 瞬时态（拉取中、模型列表等）走 runtime，不占用此类型。
 */
export type SettingValue = string | number | boolean | null;

/** 内置控件类型。Extension Point: 新控件只需 registerWidget，不必改此常量。 */
export const SETTING_WIDGET = {
  TEXT: 'text',
  PASSWORD: 'password',
  SELECT: 'select',
  SWITCH: 'switch',
  ACTION: 'action',
  STATUS: 'status',
  CUSTOM: 'custom'
} as const;

export type SettingWidgetType = (typeof SETTING_WIDGET)[keyof typeof SETTING_WIDGET] | (string & {});

export interface SettingsContext {
  values: Record<string, SettingValue>;
  runtime: Record<string, unknown>;
  locks: Record<string, boolean>;
}

export interface SettingsMutator extends SettingsContext {
  setValue(key: string, value: SettingValue): void;
  setRuntime(key: string, value: unknown): void;
}

export type SettingPredicate =
  | { field: string; eq?: unknown; neq?: unknown; truthy?: boolean; falsy?: boolean }
  | { runtime: string; eq?: unknown; neq?: unknown; truthy?: boolean; falsy?: boolean }
  | { lock: string; eq?: boolean }
  | { and: SettingPredicate[] }
  | { or: SettingPredicate[] }
  | { not: SettingPredicate };

export type SettingEffect =
  | { set: Record<string, SettingValue> }
  | { setRuntime: Record<string, unknown> };

export type SettingChangeHandler =
  | SettingEffect[]
  | ((value: SettingValue, ctx: SettingsMutator) => void | Promise<void>);

export interface SettingHydration {
  values: Record<string, SettingValue>;
  locks?: Record<string, boolean>;
  runtime?: Record<string, unknown>;
}

export interface SettingValidation {
  ok: boolean;
  message?: string;
}

export interface SettingField {
  /** 渲染与列表用的稳定标识；缺省回退到 key */
  id?: string;
  /** 绑定到 Session.values 的存储键；同 key 可有多个互斥控件 */
  key: string;
  type: SettingWidgetType;
  label: string;
  description?: string;
  hint?: string | ((ctx: SettingsContext) => string);
  placeholder?: string;
  required?: boolean;
  /** 为 false 时 change 不写入 values（action / status） */
  persist?: boolean;
  icon?: Component;
  options?: SettingSelectOption[] | ((ctx: SettingsContext) => SettingSelectOption[]);
  visibleWhen?: SettingPredicate;
  disabledWhen?: SettingPredicate;
  onChange?: SettingChangeHandler;
  /** 透传给具体 Widget 的扩展属性 */
  props?: Record<string, unknown>;
  /** type=custom 时渲染的逃生舱组件 */
  component?: Component;
}

export interface SettingGroup {
  id: string;
  title?: string;
  description?: string;
  icon?: Component;
  layout?: 'stack' | 'subcard';
  visibleWhen?: SettingPredicate;
  /** 渲染到分组标题右侧的字段 id（通常是 action） */
  headerActionId?: string;
  fields: SettingField[];
}

export type SettingBadge = 'ready' | 'warn' | 'none';

export interface SettingSection {
  id: string;
  /** 左侧菜单分组名，如「服务」 */
  category: string;
  title: string;
  description?: string;
  icon: Component;
  badge?: (ctx: SettingsContext) => SettingBadge;
  groups: SettingGroup[];
  hydrate?: () => SettingHydration;
  commit?: (ctx: SettingsContext) => void;
  validate?: (ctx: SettingsContext) => SettingValidation;
  /** Extension Point: 弹窗打开后的生命周期（如预拉取模型） */
  onOpen?: (ctx: SettingsMutator) => void | Promise<void>;
}

export interface SettingCategoryGroup {
  category: string;
  sections: SettingSection[];
}

export interface SettingWidgetProps {
  field: SettingField;
  value: SettingValue;
  ctx: SettingsContext;
  disabled: boolean;
  hint: string;
  options: SettingSelectOption[];
  loading: boolean;
}
