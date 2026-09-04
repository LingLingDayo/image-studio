import { Globe, Key } from '@lucide/vue';
import { useConfigStore } from '@/stores/configStore';
import { ENV_API_KEY_HINT } from '@/types/config';
import { SETTING_WIDGET, type SettingSection } from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_SECTION } from './keys';

export const imageSection: SettingSection = {
  id: SETTING_SECTION.image,
  category: SETTING_CATEGORY.service,
  title: '生图服务',
  description: '配置生图接口地址与 API Key',
  icon: Key,
  groups: [
    {
      id: 'image.credentials',
      title: '接口凭据',
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.imageBaseUrl,
          type: SETTING_WIDGET.TEXT,
          label: '生图 API Base URL',
          placeholder: 'https://api.example.com',
          required: true,
          icon: Globe,
          props: { mono: true },
          visibleWhen: { lock: SETTING_KEYS.imageBaseUrl, eq: false }
        },
        {
          key: SETTING_KEYS.imageApiKey,
          type: SETTING_WIDGET.PASSWORD,
          label: '生图 API Key',
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
    return { ok: true };
  }
};
