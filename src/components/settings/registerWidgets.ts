import { SETTING_WIDGET, widgetRegistry } from '@/core/settings';
import SettingInput from './widgets/SettingInput.vue';
import SettingSelect from './widgets/SettingSelect.vue';
import SettingSwitch from './widgets/SettingSwitch.vue';
import SettingAction from './widgets/SettingAction.vue';
import SettingStatus from './widgets/SettingStatus.vue';
import SettingCustom from './widgets/SettingCustom.vue';

let installed = false;

/**
 * 注册内置设置控件。
 * Extension Point: 新增 number / color / slider 等类型时在此 register 即可。
 */
export function registerSettingWidgets(): void {
  if (installed) return;
  widgetRegistry.register(SETTING_WIDGET.TEXT, SettingInput);
  widgetRegistry.register(SETTING_WIDGET.PASSWORD, SettingInput);
  widgetRegistry.register(SETTING_WIDGET.SELECT, SettingSelect);
  widgetRegistry.register(SETTING_WIDGET.SWITCH, SettingSwitch);
  widgetRegistry.register(SETTING_WIDGET.ACTION, SettingAction);
  widgetRegistry.register(SETTING_WIDGET.STATUS, SettingStatus);
  widgetRegistry.register(SETTING_WIDGET.CUSTOM, SettingCustom);
  installed = true;
}
