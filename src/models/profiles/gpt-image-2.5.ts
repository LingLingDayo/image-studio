import type { ModelProfileDefinition } from '@/types/model';
import { GPT_IMAGE_25_CAPABILITIES, IMAGE_EDIT_API, IMAGE_GENERATE_API, IMAGE_GENERATION_GUIDE, MODEL_DATA_CHECKED_AT } from '../presets';

/** 共用参数预设，避免重复维护相同配置。 */
export const GPT_IMAGE_25: ModelProfileDefinition = {
  ...GPT_IMAGE_25_CAPABILITIES,
  id: 'gpt-image-2.5',
  name: 'GPT-Image-2.5',
  description: '与 GPT-Image-2.5 Flare 使用相同的参数配置',
  verification: {
    status: 'unverified',
    checkedAt: MODEL_DATA_CHECKED_AT,
    sources: [IMAGE_GENERATION_GUIDE, IMAGE_GENERATE_API, IMAGE_EDIT_API],
    unverifiedFields: ['id', 'referenceImageConstraints.mimeTypes', 'referenceImageConstraints.maxBytes'],
    notes: [
      '参数配置与 gpt-image-2.5-flare 相同，模型名称和请求 ID 保持 gpt-image-2.5。',
      '超过 2560×1440 的分辨率为实验性支持。',
      '参考图 PNG/JPEG/WEBP 是工作台栅格输入范围，不声称是官方完整 MIME 白名单。',
      '普通参考图单文件字节上限未确认；不将注释层文件的 50MB 上限外推到参考图。'
    ]
  }
};
