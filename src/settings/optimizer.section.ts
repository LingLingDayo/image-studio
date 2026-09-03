import { Globe, Key, Cpu, Route, RefreshCw } from 'lucide-vue-next';
import { useConfigStore } from '@/stores/configStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import { COMMON_OPTIMIZER_ENDPOINTS, ENV_OPTIMIZER_API_KEY_HINT } from '@/types/config';
import {
  SETTING_WIDGET,
  isTruthy,
  type SettingSection,
  type SettingValue,
  type SettingsMutator
} from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_RUNTIME, SETTING_SECTION } from './keys';

const PREFERRED_OPTIMIZER_MODEL = 'gpt-5.6-terra';

export interface OptimizerFetchStatus {
  type: 'idle' | 'success' | 'error';
  message: string;
}

export function selectPreferredOptimizerModel(list: string[], current: string): string {
  if (current && list.includes(current)) return current;
  if (list.includes(PREFERRED_OPTIMIZER_MODEL)) return PREFERRED_OPTIMIZER_MODEL;
  return list[0] ?? current;
}

function idleFetchStatus(): OptimizerFetchStatus {
  return { type: 'idle', message: '' };
}

/**
 * 拉取优化模型列表，并在当前选择非法时联动写入默认模型。
 * Extension Point: 替换数据源时只改此命令，字段 schema 保持不变。
 */
export async function fetchOptimizerModels(
  _value: SettingValue,
  ctx: SettingsMutator
): Promise<void> {
  if (ctx.runtime[SETTING_RUNTIME.optimizerIsFetching] === true) return;

  const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
  const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();

  if (!url) {
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
      type: 'error',
      message: '请先填写优化 API Base URL'
    } satisfies OptimizerFetchStatus);
    return;
  }
  if (!key) {
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
      type: 'error',
      message: '请先填写优化 API Key'
    } satisfies OptimizerFetchStatus);
    return;
  }

  ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, true);
  ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, idleFetchStatus());

  try {
    const list = await PromptOptimizerService.fetchModels(url, key);
    ctx.setRuntime(SETTING_RUNTIME.optimizerModels, list);

    if (list.length > 0) {
      ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
        type: 'success',
        message: `已成功获取 ${list.length} 个支持的模型`
      } satisfies OptimizerFetchStatus);

      const current = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
      ctx.setValue(SETTING_KEYS.optimizerModel, selectPreferredOptimizerModel(list, current));
    } else {
      ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
        type: 'error',
        message: '接口未返回任何可用模型'
      } satisfies OptimizerFetchStatus);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取模型列表失败';
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
      type: 'error',
      message
    } satisfies OptimizerFetchStatus);
  } finally {
    ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, false);
  }
}

function syncOptimizerRuntimeOnApiKeyChange(value: SettingValue, ctx: SettingsMutator): void {
  if (isTruthy(value) || ctx.locks[SETTING_KEYS.optimizerApiKey]) return;
  ctx.setRuntime(SETTING_RUNTIME.optimizerModels, []);
  ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, idleFetchStatus());
}

export const optimizerSection: SettingSection = {
  id: SETTING_SECTION.optimizer,
  category: SETTING_CATEGORY.service,
  title: '提示词优化',
  description: '配置提示词优化大模型与调用端点',
  icon: Cpu,
  badge(ctx) {
    const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
    const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();
    const model = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
    return url && key && model ? 'ready' : 'none';
  },
  groups: [
    {
      id: 'optimizer.credentials',
      title: '接口凭据',
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.optimizerBaseUrl,
          type: SETTING_WIDGET.TEXT,
          label: '优化 API Base URL',
          placeholder: 'https://api.openai.com',
          icon: Globe,
          props: { mono: true },
          visibleWhen: { lock: SETTING_KEYS.optimizerBaseUrl, eq: false }
        },
        {
          key: SETTING_KEYS.optimizerApiKey,
          type: SETTING_WIDGET.PASSWORD,
          label: '优化 API Key',
          placeholder: 'sk-...',
          icon: Key,
          hint: ENV_OPTIMIZER_API_KEY_HINT,
          props: { mono: true, showPasswordToggle: true },
          visibleWhen: { lock: SETTING_KEYS.optimizerApiKey, eq: false },
          onChange: syncOptimizerRuntimeOnApiKeyChange
        }
      ]
    },
    {
      id: 'optimizer.models',
      title: '模型与调用端点',
      icon: Cpu,
      layout: 'subcard',
      headerActionId: 'optimizer.fetchModels',
      visibleWhen: { field: SETTING_KEYS.optimizerApiKey, truthy: true },
      fields: [
        {
          id: 'optimizer.fetchModels',
          key: 'optimizer.fetchModels',
          type: SETTING_WIDGET.ACTION,
          label: '获取可用模型',
          persist: false,
          icon: RefreshCw,
          props: {
            loadingRuntimeKey: SETTING_RUNTIME.optimizerIsFetching,
            loadingLabel: '拉取中...'
          },
          disabledWhen: {
            or: [
              { runtime: SETTING_RUNTIME.optimizerIsFetching, truthy: true },
              { field: SETTING_KEYS.optimizerApiKey, falsy: true }
            ]
          },
          onChange: fetchOptimizerModels
        },
        {
          id: 'optimizer.fetchStatus',
          key: SETTING_RUNTIME.optimizerFetchStatus,
          type: SETTING_WIDGET.STATUS,
          label: '',
          persist: false,
          visibleWhen: {
            not: { runtime: `${SETTING_RUNTIME.optimizerFetchStatus}.type`, eq: 'idle' }
          }
        },
        {
          id: 'optimizer.model.select',
          key: SETTING_KEYS.optimizerModel,
          type: SETTING_WIDGET.SELECT,
          label: '选择优化模型',
          icon: Cpu,
          visibleWhen: { runtime: SETTING_RUNTIME.optimizerModels, truthy: true },
          options: (ctx) => {
            const models = (ctx.runtime[SETTING_RUNTIME.optimizerModels] as string[] | undefined) ?? [];
            return models.map((model) => ({ label: model, value: model }));
          }
        },
        {
          id: 'optimizer.model.text',
          key: SETTING_KEYS.optimizerModel,
          type: SETTING_WIDGET.TEXT,
          label: '模型名称',
          placeholder: 'gpt-5.6-terra',
          icon: Cpu,
          props: { mono: true },
          visibleWhen: { not: { runtime: SETTING_RUNTIME.optimizerModels, truthy: true } }
        },
        {
          key: SETTING_KEYS.optimizerEndpoint,
          type: SETTING_WIDGET.SELECT,
          label: '调用端点',
          icon: Route,
          options: COMMON_OPTIMIZER_ENDPOINTS
        }
      ]
    }
  ],
  hydrate() {
    const store = useConfigStore();
    return {
      values: {
        [SETTING_KEYS.optimizerBaseUrl]: store.hasEnvOptimizerBaseUrl
          ? store.effectiveOptimizerBaseUrl
          : store.optimizerBaseUrl,
        [SETTING_KEYS.optimizerApiKey]: store.hasEnvOptimizerApiKey
          ? store.effectiveOptimizerApiKey
          : store.optimizerApiKey,
        [SETTING_KEYS.optimizerModel]: store.optimizerModel,
        [SETTING_KEYS.optimizerEndpoint]: store.optimizerEndpoint
      },
      locks: {
        [SETTING_KEYS.optimizerBaseUrl]: store.hasEnvOptimizerBaseUrl,
        [SETTING_KEYS.optimizerApiKey]: store.hasEnvOptimizerApiKey
      },
      runtime: {
        [SETTING_RUNTIME.optimizerModels]: [],
        [SETTING_RUNTIME.optimizerFetchStatus]: idleFetchStatus(),
        [SETTING_RUNTIME.optimizerIsFetching]: false
      }
    };
  },
  commit(ctx) {
    const store = useConfigStore();
    store.updateOptimizerConfig({
      ...(ctx.locks[SETTING_KEYS.optimizerBaseUrl]
        ? {}
        : { baseUrl: String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '') }),
      ...(ctx.locks[SETTING_KEYS.optimizerApiKey]
        ? {}
        : { apiKey: String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '') }),
      model: String(ctx.values[SETTING_KEYS.optimizerModel] ?? ''),
      endpoint: String(ctx.values[SETTING_KEYS.optimizerEndpoint] ?? '')
    });
  },
  async onOpen(ctx) {
    const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
    const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();
    const models = ctx.runtime[SETTING_RUNTIME.optimizerModels];
    if (url && key && !isTruthy(models)) {
      await fetchOptimizerModels(null, ctx);
    }
  }
};
