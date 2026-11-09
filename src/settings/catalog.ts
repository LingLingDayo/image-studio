import { settingsRegistry } from '@/core/settings';
import { imageSection } from './image.section';
import { generalSection } from './general.section';

let installed = false;

/**
 * 装配默认设置分区。
 * Extension Point: 新增外观 / 下载等分区时在此 register，Shell 会按 category 自动分组。
 * 注册顺序即左侧菜单顺序，通用偏好固定在首位。
 */
export function ensureSettingsCatalog() {
  if (!installed) {
    settingsRegistry.register(generalSection);
    settingsRegistry.register(imageSection);
    installed = true;
  }
  return settingsRegistry;
}

export { imageSection, generalSection };
