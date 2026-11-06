import { Globe, Key } from '@lucide/vue';
import { useConfigStore } from '@/stores/configStore';
import { ENV_API_KEY_HINT } from '@/types/config';
import { isHttpUrl } from '@/utils/apiUrl';
import { SETTING_WIDGET, type SettingSection } from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_SECTION } from './keys';

export const imageSection: SettingSection = {
  id: SETTING_SECTION.image,
  category: SETTING_CATEGORY.service,
  title: '生图服务',
  description: '连接生图服务即可开始创作。模型和画面参数在工作台调整。',
  icon: Key,
  badge(ctx) {
    return imageSection.validate?.(ctx).ok ? 'ready' : 'warn';
  },
  groups: [
    {
      id: 'image.credentials',
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.imageBaseUrl,
          type: SETTING_WIDGET.TEXT,
          label: '接口地址',
          placeholder: 'https://api.example.com',
          hint: '填写服务提供的完整地址，可带或不带 /v1。',
          required: true,
          icon: Globe,
          props: { mono: true },
          visibleWhen: { lock: SETTING_KEYS.imageBaseUrl, eq: false }
        },
        {
          key: SETTING_KEYS.imageApiKey,
          type: SETTING_WIDGET.PASSWORD,
          label: 'API Key',
          placeholder: 'sk-...',
          required: true,
          icon: Key,
          hint: ENV_API_KEY_HINT,
          props: { mono: true, showPasswordToggle: true },
          visibleWhen: { lock: SETTING_KEYS.imageApiKey, eq: false }
        }
      ]
    }
  ],
  hydrate() {
    const store = useConfigStore();
    return {
      values: {
        [SETTING_KEYS.imageBaseUrl]: store.hasEnvBaseUrl ? store.effectiveBaseUrl : store.baseUrl,
        [SETTING_KEYS.imageApiKey]: store.hasEnvApiKey ? store.effectiveApiKey : store.apiKey
      },
      locks: {
        [SETTING_KEYS.imageBaseUrl]: store.hasEnvBaseUrl,
        [SETTING_KEYS.imageApiKey]: store.hasEnvApiKey
      }
    };
  },
  commit(ctx) {
    const store = useConfigStore();
    store.updateConfig({
      ...(ctx.locks[SETTING_KEYS.imageBaseUrl]
        ? {}
        : { baseUrl: String(ctx.values[SETTING_KEYS.imageBaseUrl] ?? '') }),
      ...(ctx.locks[SETTING_KEYS.imageApiKey]
        ? {}
        : { apiKey: String(ctx.values[SETTING_KEYS.imageApiKey] ?? '') })
    });
  },
  validate(ctx) {
    const url = String(ctx.values[SETTING_KEYS.imageBaseUrl] ?? '').trim();
    const key = String(ctx.values[SETTING_KEYS.imageApiKey] ?? '').trim();
    if (!url || !key) {
      return { ok: false, message: '请填写生图接口地址与 API Key' };
    }
    if (!isHttpUrl(url)) {
      return { ok: false, message: '接口地址需以 http:// 或 https:// 开头。' };
    }
    return { ok: true };
  }
};
