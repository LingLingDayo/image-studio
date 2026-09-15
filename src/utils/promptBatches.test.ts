import { describe, it, expect } from 'vitest';
import {
  splitPromptBatches,
  isMultiPromptBatch,
  formatPromptBatchCountTip
} from './promptBatches';

describe('promptBatches', () => {
  describe('splitPromptBatches', () => {
    it('空字符串与纯空白应得到空批次', () => {
      expect(splitPromptBatches('')).toEqual([]);
      expect(splitPromptBatches('   \n\n  ')).toEqual([]);
    });

    it('单段提示词即使含单换行或单个空行也不拆分', () => {
      expect(splitPromptBatches('一只赛博猫咪')).toEqual(['一只赛博猫咪']);
      expect(splitPromptBatches('一只猫\n站在屋顶上')).toEqual(['一只猫\n站在屋顶上']);
      expect(splitPromptBatches('一只猫\n\n一只狗')).toEqual(['一只猫\n\n一只狗']);
      expect(splitPromptBatches('  前置空格的提示词  ')).toEqual(['前置空格的提示词']);
    });

    it('连续两个空行应拆成多个非空批次', () => {
      expect(splitPromptBatches('一只猫\n\n\n一只狗')).toEqual(['一只猫', '一只狗']);
      expect(splitPromptBatches('A\n\n\nB\n\n\nC')).toEqual(['A', 'B', 'C']);
    });

    it('应忽略多于两个的空行、行内空格与首尾空白片段', () => {
      expect(splitPromptBatches('\n\n一只猫\n\n\n一只狗\n\n')).toEqual(['一只猫', '一只狗']);
      expect(splitPromptBatches('  一只猫  \n\n\n  一只狗  ')).toEqual(['一只猫', '一只狗']);
      expect(splitPromptBatches('一只猫\n  \n  \n一只狗')).toEqual(['一只猫', '一只狗']);
      expect(splitPromptBatches('一只猫\n\n\n\n一只狗')).toEqual(['一只猫', '一只狗']);
    });

    it('应兼容 Windows 与旧 Mac 换行', () => {
      expect(splitPromptBatches('一只猫\r\n\r\n\r\n一只狗')).toEqual(['一只猫', '一只狗']);
      expect(splitPromptBatches('一只猫\r\r\r一只狗')).toEqual(['一只猫', '一只狗']);
    });

    it('应保留批次内部的单换行与单个空行', () => {
      expect(splitPromptBatches('第一行\n第二行\n\n\n另一段')).toEqual(['第一行\n第二行', '另一段']);
      expect(splitPromptBatches('第一行\n\n第二行\n\n\n另一段')).toEqual(['第一行\n\n第二行', '另一段']);
    });
  });

  describe('isMultiPromptBatch', () => {
    it('仅在连续两个空行分隔出至少两段非空提示词时为批量模式', () => {
      expect(isMultiPromptBatch('')).toBe(false);
      expect(isMultiPromptBatch('一只猫')).toBe(false);
      expect(isMultiPromptBatch('一只猫\n站在屋顶')).toBe(false);
      expect(isMultiPromptBatch('一只猫\n\n一只狗')).toBe(false);
      expect(isMultiPromptBatch('一只猫\n\n\n')).toBe(false);
      expect(isMultiPromptBatch('一只猫\n\n\n一只狗')).toBe(true);
    });
  });

  describe('formatPromptBatchCountTip', () => {
    it('应说明当前批次数、每批张数与总张数', () => {
      expect(formatPromptBatchCountTip(2, 3)).toBe('当前 2 个批次，每批生成 3 张，共 6 张');
      expect(formatPromptBatchCountTip(4, 1)).toBe('当前 4 个批次，每批生成 1 张，共 4 张');
    });
  });
});
