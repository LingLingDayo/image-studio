import type { ModelProfileDefinition } from '@/types/model';
import { GPT_IMAGE_26_CAPABILITIES, IMAGE_EDIT_API, IMAGE_GENERATE_API, IMAGE_GENERATION_GUIDE, MODEL_DATA_CHECKED_AT } from '../presets';

export const GPT_IMAGE_26_FLARE: ModelProfileDefinition = {
  ...GPT_IMAGE_26_CAPABILITIES,
  id: 'gpt-image-2.6-flare',
  name: 'GPT-Image-2.6 Flare',
  description: '侧重快速迭代的图像生成与编辑模型',
  verification: {
    status: 'partial',
    checkedAt: MODEL_DATA_CHECKED_AT,
    sources: ['https://developers.openai.com/api/docs/models/gpt-image-2.6-flare', IMAGE_GENERATION_GUIDE, IMAGE_GENERATE_API, IMAGE_EDIT_API],
    unverifiedFields: ['supportsTransparent', 'transparentFormats', 'supportsCustomSize', 'sizeConstraints', 'referenceImageConstraints.mimeTypes', 'referenceImageConstraints.maxBytes'],
    notes: [
      'xhigh/max 已由指南 Calculating costs 段明确确认，API 字段说明尚未同步点名 2.6。',
      '静态输出的边长/像素硬限制未单独确认；sizeConstraints 不外推 2.5 的限制。',
      '透明与自定义尺寸继续沿用工作台兼容行为；2.6 专属限制未确认，不能当作已核实的逐模型契约。',
      'GIF 需要模型预览权限；SVG 需要项目访问权限，且按明确指南仅允许文生图和 n=1。',
      '模型页只确认 Images 生成/编辑端点，Responses 端点不支持。',
      'GIF 时长 20–2000ms 是指南推荐范围；API 只说明最小 20ms 及编码延迟封顶 655350ms。',
      '参考图 PNG/JPEG/WEBP 是工作台栅格输入范围，不声称是官方完整 MIME 白名单。',
      '普通参考图单文件字节上限未确认；不将注释层文件的 50MB 上限外推到参考图。',
    ]
  }
};
