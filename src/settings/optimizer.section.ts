import { Globe, Key, Cpu, Route, RefreshCw } from '@lucide/vue';
import { useConfigStore } from '@/stores/configStore';
import { PromptOptimizerService } from '@/core/services/PromptOptimizerService';
import { COMMON_OPTIMIZER_ENDPOINTS, ENV_OPTIMIZER_API_KEY_HINT } from '@/types/config';
import { isHttpUrl } from '@/utils/apiUrl';
import {
  SETTING_WIDGET,
  type SettingSection,
  type SettingValue,
  type SettingsMutator
} from '@/core/settings';
import { SETTING_CATEGORY, SETTING_KEYS, SETTING_RUNTIME, SETTING_SECTION } from './keys';

const FETCH_REQUEST_ID = 'optimizer.fetchRequestId';
let nextFetchRequestId = 0;

export interface OptimizerFetchStatus {
  type: 'idle' | 'success' | 'error';
  message: string;
}

export function selectPreferredOptimizerModel(list: string[], current: string): string {
  return current || list[0] || '';
}

function idleFetchStatus(): OptimizerFetchStatus {
  return { type: 'idle', message: '' };
}

export async function fetchOptimizerModels(
  _value: SettingValue,
  ctx: SettingsMutator
): Promise<void> {
  if (ctx.runtime[SETTING_RUNTIME.optimizerIsFetching] === true) return;

  const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
  const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();

  if (!isHttpUrl(url)) {
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
      type: 'error',
      message: '请先填写有效的优化接口地址（http 或 https）'
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

  const requestId = ++nextFetchRequestId;
  ctx.setRuntime(FETCH_REQUEST_ID, requestId);
  ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, true);
  ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, idleFetchStatus());

  // 凭据可能在请求中途变更，旧请求不能覆盖新服务的模型与状态。
  const isCurrentRequest = () =>
    ctx.runtime[FETCH_REQUEST_ID] === requestId &&
    String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim() === url &&
    String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim() === key;

  try {
    const list = await PromptOptimizerService.fetchModels(url, key);
    if (!isCurrentRequest()) return;
    ctx.setRuntime(SETTING_RUNTIME.optimizerModels, list);

    if (list.length > 0) {
      ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
        type: 'success',
        message: `已获取 ${list.length} 个模型`
      } satisfies OptimizerFetchStatus);

      const current = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
      ctx.setValue(SETTING_KEYS.optimizerModel, selectPreferredOptimizerModel(list, current));
    } else {
      ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
        type: 'error',
        message: '未返回可用模型，可以手动填写模型名称'
      } satisfies OptimizerFetchStatus);
    }
  } catch (err: unknown) {
    if (!isCurrentRequest()) return;
    const message = err instanceof Error ? err.message : '获取模型列表失败';
    ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, {
      type: 'error',
      message
    } satisfies OptimizerFetchStatus);
  } finally {
    if (isCurrentRequest()) {
      ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, false);
    }
  }
}

function resetOptimizerModels(_value: SettingValue, ctx: SettingsMutator): void {
  ctx.setRuntime(FETCH_REQUEST_ID, ++nextFetchRequestId);
  ctx.setRuntime(SETTING_RUNTIME.optimizerModels, []);
  ctx.setRuntime(SETTING_RUNTIME.optimizerFetchStatus, idleFetchStatus());
  ctx.setRuntime(SETTING_RUNTIME.optimizerIsFetching, false);
}

export const optimizerSection: SettingSection = {
  id: SETTING_SECTION.optimizer,
  category: SETTING_CATEGORY.service,
  title: '提示词优化',
  description: '可选功能。配置语言模型后，可一键优化提示词；不影响正常生图。',
  icon: Cpu,
  badge(ctx) {
    const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
    const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();
    const model = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
    if (!url && !key) return 'none';
    return isHttpUrl(url) && key && model ? 'ready' : 'warn';
  },
  groups: [
    {
      id: 'optimizer.credentials',
      layout: 'stack',
      fields: [
        {
          key: SETTING_KEYS.optimizerBaseUrl,
          type: SETTING_WIDGET.TEXT,
          label: '接口地址',
          placeholder: 'https://api.example.com',
          hint: '填写语言模型服务地址，可带或不带 /v1。',
          icon: Globe,
          props: { mono: true },
          visibleWhen: { lock: SETTING_KEYS.optimizerBaseUrl, eq: false },
          onChange: resetOptimizerModels
        },
        {
          key: SETTING_KEYS.optimizerApiKey,
          type: SETTING_WIDGET.PASSWORD,
          label: 'API Key',
          placeholder: 'sk-...',
          icon: Key,
          hint: ENV_OPTIMIZER_API_KEY_HINT,
          props: { mono: true, showPasswordToggle: true },
          visibleWhen: { lock: SETTING_KEYS.optimizerApiKey, eq: false },
          onChange: resetOptimizerModels
        }
      ]
    },
    {
      id: 'optimizer.models',
      title: '优化模型',
      layout: 'stack',
      headerActionId: 'optimizer.fetchModels',
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
            loadingLabel: '获取中...'
          },
          disabledWhen: {
            or: [
              { runtime: SETTING_RUNTIME.optimizerIsFetching, truthy: true },
              { field: SETTING_KEYS.optimizerBaseUrl, falsy: true },
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
          label: '模型名称',
          visibleWhen: { runtime: SETTING_RUNTIME.optimizerModels, truthy: true },
          options: (ctx) => {
            const models = (ctx.runtime[SETTING_RUNTIME.optimizerModels] as string[] | undefined) ?? [];
            const current = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
            const options = current && !models.includes(current) ? [current, ...models] : models;
            return options.map((model) => ({ label: model, value: model }));
          }
        },
        {
          id: 'optimizer.model.text',
          key: SETTING_KEYS.optimizerModel,
          type: SETTING_WIDGET.TEXT,
          label: '模型名称',
          placeholder: '输入服务支持的模型名称',
          hint: '可手动填写，也可先填写接口凭据再获取模型列表。',
          props: { mono: true },
          visibleWhen: { not: { runtime: SETTING_RUNTIME.optimizerModels, truthy: true } }
        }
      ]
    },
    {
      id: 'optimizer.advanced',
      title: '高级选项',
      collapsible: true,
      fields: [
        {
          key: SETTING_KEYS.optimizerEndpoint,
          type: SETTING_WIDGET.SELECT,
          label: '调用端点',
          icon: Route,
          hint: '默认使用聊天端点，仅在服务要求其他协议时修改。',
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
  validate(ctx) {
    const url = String(ctx.values[SETTING_KEYS.optimizerBaseUrl] ?? '').trim();
    const key = String(ctx.values[SETTING_KEYS.optimizerApiKey] ?? '').trim();
    const model = String(ctx.values[SETTING_KEYS.optimizerModel] ?? '').trim();
    if (!url && !key) return { ok: true };
    if (!url || !key) return { ok: false, message: '请补全优化接口地址与 API Key；不使用时可将两项留空。' };
    if (!isHttpUrl(url)) return { ok: false, message: '优化接口地址需以 http:// 或 https:// 开头。' };
    if (!model) return { ok: false, message: '请填写优化模型名称，或获取可用模型后选择。' };
    return { ok: true };
  }
};
