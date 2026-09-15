/**
 * 以连续两个空行分隔输入框中的多段提示词。
 * 单个换行或单个空行仍视为同一段提示词；仅空白的片段会被丢弃。
 */
export function splitPromptBatches(raw: string): string[] {
  if (!raw) return [];
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized
    .split(/\n(?:[ \t]*\n){2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function isMultiPromptBatch(raw: string): boolean {
  return splitPromptBatches(raw).length > 1;
}

export function formatPromptBatchCountTip(batchCount: number, perBatchCount: number): string {
  const safeBatches = Math.max(0, batchCount);
  const safePerBatch = Math.max(0, perBatchCount);
  const total = safeBatches * safePerBatch;
  return `当前 ${safeBatches} 个批次，每批生成 ${safePerBatch} 张，共 ${total} 张`;
}
