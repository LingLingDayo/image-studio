import type { SettingCategoryGroup, SettingSection } from './types';

/**
 * 设置分区分区注册表。
 * Extension Point: 新分区调用 register(section) 即可出现在左侧菜单，无需改 Shell。
 */
export class SettingsRegistry {
  private sections = new Map<string, SettingSection>();

  register(section: SettingSection): void {
    this.sections.set(section.id, section);
  }

  get(id: string): SettingSection | undefined {
    return this.sections.get(id);
  }

  has(id: string): boolean {
    return this.sections.has(id);
  }

  list(): SettingSection[] {
    return Array.from(this.sections.values());
  }

  listByCategory(): SettingCategoryGroup[] {
    const order: string[] = [];
    const grouped = new Map<string, SettingSection[]>();

    for (const section of this.list()) {
      if (!grouped.has(section.category)) {
        order.push(section.category);
        grouped.set(section.category, []);
      }
      grouped.get(section.category)!.push(section);
    }

    return order.map((category) => ({
      category,
      sections: grouped.get(category)!
    }));
  }

  clear(): void {
    this.sections.clear();
  }
}

export const settingsRegistry = new SettingsRegistry();
