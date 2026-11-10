import type { ModelProfileDefinition } from '@/types/model';
import { GPT_IMAGE_25_CAPABILITIES, IMAGE_EDIT_API, IMAGE_GENERATE_API, IMAGE_GENERATION_GUIDE, MODEL_DATA_CHECKED_AT } from '../presets';

export const GPT_IMAGE_25_SUNBURST: ModelProfileDefinition = {
  ...GPT_IMAGE_25_CAPABILITIES,
  id: 'gpt-image-2.5-sunburst',
  name: 'GPT-Image-2.5 Sunburst',
  description: '侧重精确编辑的图像生成与编辑模型',
  verification: {
    status: 'verified',
    checkedAt: MODEL_DATA_CHECKED_AT,
    sources: ['https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst', IMAGE_GENERATION_GUIDE, IMAGE_GENERATE_API, IMAGE_EDIT_API],
    unverifiedFields: ['referenceImageConstraints.mimeTypes', 'referenceImageConstraints.maxBytes'],
    notes: [
      '超过 2560×1440 的分辨率为实验性支持。',
      '参考图 PNG/JPEG/WEBP 是工作台栅格输入范围，不声称是官方完整 MIME 白名单。',
      '普通参考图单文件字节上限未确认；不将注释层文件的 50MB 上限外推到参考图。',
    ]
  }
};
