import { Sliders, Download, Sparkles, Maximize2, Palette } from '@lucide/vue';
import { useConfigStore } from '@/stores/configStore';
import BackupSettings from '@/components/settings/BackupSettings.vue';
import ThemeSettings from '@/components/settings/ThemeSettings.vue';
import { SETTING_WIDGET, type SettingSection } from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_SECTION } from './keys';

export const generalSection: SettingSection = {
  id: SETTING_SECTION.general,
  category: SETTING_CATEGORY.general,
  title: '通用设置',
  description: '调整生成、预览和下载偏好。默认设置即可使用。',
  icon: Sliders,
  groups: [
    {
      id: 'general.appearance',
      title: '外观',
      icon: Palette,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.themeMode,
          type: SETTING_WIDGET.CUSTOM,
          label: '主题模式',
          component: ThemeSettings,
          persist: false
        }
      ]
    },
    {
      id: 'general.interaction',
      title: '生成交互',
      icon: Sparkles,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.clearPromptOnGenerate,
          type: SETTING_WIDGET.SWITCH,
          label: '开始生成后清空输入框',
          hint: '默认保留提示词，方便继续微调。'
        }
      ]
    },
    {
      id: 'general.preview',
      title: '图片预览',
      icon: Maximize2,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.previewFullscreenMode,
          type: SETTING_WIDGET.SELECT,
          label: '全屏方式',
          hint: '默认铺满浏览器页面；浏览器全屏会隐藏浏览器界面。',
          options: [
            { label: '页面内全屏（默认）', value: 'window' },
            { label: '浏览器全屏', value: 'native' }
          ]
        }
      ]
    },
    {
      id: 'general.download',
      collapsible: true,
      title: '下载与导出',
      icon: Download,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.downloadFilenamePattern,
          type: SETTING_WIDGET.TEXT,
          label: '下载文件名',
          placeholder: '{prefix}_{date}_{time}_{id}',
          hint: '支持变量：{prefix} (文生图/图生图)、{date} (年月日)、{time} (时分秒)、{id} (时间戳后四位)、{prompt} (提示词)'
        },
        {
          key: SETTING_KEYS.downloadImageFormat,
          type: SETTING_WIDGET.SELECT,
          label: '下载格式',
          hint: '默认保留生成时的文件格式。',
          options: [
            { label: '跟随原图格式 (默认)', value: 'auto' },
            { label: 'PNG 格式 (.png)', value: 'png' },
            { label: 'JPEG 格式 (.jpg)', value: 'jpeg' },
            { label: 'WEBP 格式 (.webp)', value: 'webp' }
          ]
        }
      ]
    },
    {
      id: 'general.backup',
      title: '作品备份',
      icon: Download,
      collapsible: true,
      fields: [
        {
          key: 'general.backup',
          label: '',
          type: SETTING_WIDGET.CUSTOM,
          component: BackupSettings,
          persist: false
        }
      ]
    }
  ],
  hydrate() {
    const store = useConfigStore();
    return {
      values: {
        [SETTING_KEYS.clearPromptOnGenerate]: store.clearPromptOnGenerate,
        [SETTING_KEYS.previewFullscreenMode]: store.previewFullscreenMode,
        [SETTING_KEYS.downloadFilenamePattern]: store.downloadFilenamePattern,
        [SETTING_KEYS.downloadImageFormat]: store.downloadImageFormat
      }
    };
  },
  commit(ctx) {
    const store = useConfigStore();
    store.updateGeneralConfig({
      clearPromptOnGenerate: Boolean(ctx.values[SETTING_KEYS.clearPromptOnGenerate]),
      previewFullscreenMode: ctx.values[SETTING_KEYS.previewFullscreenMode] === 'native' ? 'native' : 'window',
      downloadFilenamePattern: String(ctx.values[SETTING_KEYS.downloadFilenamePattern] ?? '').trim() || '{prefix}_{date}_{time}_{id}',
      downloadImageFormat: String(ctx.values[SETTING_KEYS.downloadImageFormat] ?? 'auto').trim() || 'auto'
    });
  }
};
