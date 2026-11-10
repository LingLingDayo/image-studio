import type { ModelProfileDefinition } from '@/types/model';
import { GPT_IMAGE_2_CAPABILITIES, IMAGE_EDIT_API, IMAGE_GENERATE_API, IMAGE_GENERATION_GUIDE, MODEL_DATA_CHECKED_AT } from '../presets';

export const GPT_IMAGE_2: ModelProfileDefinition = {
  ...GPT_IMAGE_2_CAPABILITIES,
  id: 'gpt-image-2',
  name: 'GPT-Image-2',
  description: '支持灵活尺寸和高保真参考图的图像生成与编辑模型',
  verification: {
    status: 'verified',
    checkedAt: MODEL_DATA_CHECKED_AT,
    sources: ['https://developers.openai.com/api/docs/models/gpt-image-2', IMAGE_GENERATION_GUIDE, IMAGE_GENERATE_API, IMAGE_EDIT_API],
    unverifiedFields: ['referenceImageConstraints.mimeTypes', 'referenceImageConstraints.maxBytes'],
    notes: [
      '透明背景在此模型上为预览能力，需使用 PNG/WEBP，是否开放取决于服务与权限。',
      'input_fidelity 必须省略，输入图像自动按高保真处理。',
      '超过 2560×1440 的分辨率为实验性支持。',
      '参考图 PNG/JPEG/WEBP 是工作台栅格输入范围，不声称是官方完整 MIME 白名单。',
      '普通参考图单文件字节上限未确认；不沿用注释层文件的 50MB 限制。'
    ]
  }
};
