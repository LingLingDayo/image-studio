import { settingsRegistry } from '@/core/settings';
import { imageSection } from './image.section';
import { optimizerSection } from './optimizer.section';

let installed = false;

/**
 * 装配默认设置分区。
 * Extension Point: 新增外观 / 下载等分区时在此 register，Shell 会按 category 自动分组。
 */
export function ensureSettingsCatalog() {
  if (!installed) {
    settingsRegistry.register(imageSection);
    settingsRegistry.register(optimizerSection);
    installed = true;
  }
  return settingsRegistry;
}

export { imageSection, optimizerSection };
