import type { Component } from 'vue';

/**
 * 设置控件注册表：field.type → Vue 组件。
 * Extension Point: 新增滑条 / 颜色选择器等控件时，register(type, Component) 即可，
 * SettingsField 分发器无需增加业务 switch-case。
 */
export class WidgetRegistry {
  private widgets = new Map<string, Component>();

  register(type: string, widget: Component): void {
    this.widgets.set(type, widget);
  }

  get(type: string): Component {
    const widget = this.widgets.get(type);
    if (!widget) {
      throw new Error(`未注册的设置控件类型: [${type}]`);
    }
    return widget;
  }

  tryGet(type: string): Component | undefined {
    return this.widgets.get(type);
  }

  has(type: string): boolean {
    return this.widgets.has(type);
  }

  clear(): void {
    this.widgets.clear();
  }
}

export const widgetRegistry = new WidgetRegistry();
