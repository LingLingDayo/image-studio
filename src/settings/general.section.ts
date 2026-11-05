import { Sliders, Download, Sparkles, Maximize2 } from '@lucide/vue';
import { useConfigStore } from '@/stores/configStore';
import { SETTING_WIDGET, type SettingSection } from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_SECTION } from './keys';

export const generalSection: SettingSection = {
  id: SETTING_SECTION.general,
  category: SETTING_CATEGORY.general,
  title: '通用设置',
  description: '配置应用交互偏好与文件下载导出规则',
  icon: Sliders,
  groups: [
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
          hint: '开启后，点击开始生成时将自动清空当前提示词输入框；默认保持输入内容以便二次微调。'
        }
      ]
    },
    {
      id: 'general.preview',
      title: '看图与视口',
      icon: Maximize2,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.previewFullscreenMode,
          type: SETTING_WIDGET.SELECT,
          label: '大图全屏展示模式',
          hint: '页面内全屏仅铺满当前浏览器视口，不脱离窗口；整个电脑屏幕全屏将调用系统原生全屏铺满整个电脑显示器。',
          options: [
            { label: '页面内全屏 / 网页全屏 (推荐)', value: 'window' },
            { label: '整个电脑屏幕全屏 (系统原生全屏)', value: 'native' }
          ]
        }
      ]
    },
    {
      id: 'general.download',
      title: '下载与导出',
      icon: Download,
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.downloadFilenamePattern,
          type: SETTING_WIDGET.TEXT,
          label: '自定义下载文件名格式',
          placeholder: '{prefix}_{date}_{time}_{id}',
          hint: '支持变量：{prefix} (文生图/图生图)、{date} (年月日)、{time} (时分秒)、{id} (时间戳后四位)、{prompt} (提示词)'
        },
        {
          key: SETTING_KEYS.downloadImageFormat,
          type: SETTING_WIDGET.SELECT,
          label: '自定义下载文件格式',
          hint: '导出下载时的文件格式；选择跟随原图则保持与生成时的格式一致',
          options: [
            { label: '跟随原图格式 (默认)', value: 'auto' },
            { label: 'PNG 格式 (.png)', value: 'png' },
            { label: 'JPEG 格式 (.jpg)', value: 'jpeg' },
            { label: 'WEBP 格式 (.webp)', value: 'webp' }
          ]
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
