import { describe, it, expect } from 'vitest';
import {
  applyAspectRatioChange,
  applyHeightChange,
  applyResolutionChange,
  applySizeAuto,
  applySizePromptHint,
  applyWidthChange,
  buildSizePromptHint,
  calcMaxSize,
  createDefaultImageSizeState,
  formatQualityLabel,
  formatSizeParam,
  getResolutionDisplay,
  hydrateImageSizeFromAsset,
  hydrateImageSizeFromParams,
  inferResolutionTier,
  materializeSize,
  parseRatio,
  parseSizeString,
  formatDisplayRatio,
  type ImageSizeState
} from './imageSize';

function state(partial: Partial<ImageSizeState> = {}): ImageSizeState {
  return { ...createDefaultImageSizeState(), ...partial };
}

describe('imageSize (imageSize.ts)', () => {
  it('should parse common and decimal aspect ratios and strip prefix symbols', () => {
    expect(parseRatio('16:9')).toEqual({ w: 16, h: 9 });
    expect(parseRatio('1.91:1')).toEqual({ w: 1.91, h: 1 });
    expect(parseRatio('≈1.8:1')).toEqual({ w: 1.8, h: 1 });
    expect(parseRatio('~1.8:1')).toEqual({ w: 1.8, h: 1 });
    expect(parseRatio('#16:9')).toEqual({ w: 16, h: 9 });
    expect(parseRatio('auto')).toBeNull();
    expect(parseRatio('invalid')).toBeNull();
  });

  it('should format display ratio cleanly without approx symbol and with at most 1 decimal place', () => {
    expect(formatDisplayRatio('16:9')).toBe('16:9');
    expect(formatDisplayRatio('1:1')).toBe('1:1');
    expect(formatDisplayRatio('1.91:1')).toBe('1.91:1');
    expect(formatDisplayRatio('≈1.8:1')).toBe('1.8:1');
    expect(formatDisplayRatio('~1.8:1')).toBe('1.8:1');
    expect(formatDisplayRatio('#16:9')).toBe('16:9');
    expect(formatDisplayRatio('≈1.833:1')).toBe('1.8:1');
    expect(formatDisplayRatio('1.833:1')).toBe('1.8:1');
    expect(formatDisplayRatio('0.5625:1')).toBe('0.6:1');
    expect(formatDisplayRatio('auto')).toBe('1:1');
    expect(formatDisplayRatio(undefined)).toBe('1:1');
  });

  it('should compute max size using the long-side resolution cap', () => {
    expect(calcMaxSize('1k', '1:1')).toEqual({ width: 1024, height: 1024 });
    expect(calcMaxSize('1k', '16:9')).toEqual({ width: 1024, height: 576 });
    expect(calcMaxSize('1k', '9:16')).toEqual({ width: 576, height: 1024 });
    expect(calcMaxSize('2k', '16:9')).toEqual({ width: 2048, height: 1152 });
    expect(calcMaxSize('4k', '1:1')).toEqual({ width: 4096, height: 4096 });
    expect(calcMaxSize('auto', '16:9')).toBeNull();
    expect(calcMaxSize('1k', 'auto')).toBeNull();
  });

  it('should snap to max size when resolution is set with a concrete ratio', () => {
    const next = applyResolutionChange(state({ aspectRatio: '16:9' }), '1k');
    expect(next.resolution).toBe('1k');
    expect(next.width).toBe(1024);
    expect(next.height).toBe(576);
  });

  it('should snap to the new max size when changing ratio under a concrete resolution', () => {
    const current = state({ resolution: '2k', aspectRatio: '1:1', width: 2048, height: 2048 });
    const next = applyAspectRatioChange(current, '9:16');
    expect(next.aspectRatio).toBe('9:16');
    expect(next.width).toBe(1152);
    expect(next.height).toBe(2048);
  });

  it('should keep size auto when only one of resolution or ratio is set', () => {
    const onlyRes = applyResolutionChange(state(), '1k');
    expect(onlyRes.resolution).toBe('1k');
    expect(onlyRes.width).toBeNull();
    expect(onlyRes.height).toBeNull();

    const onlyRatio = applyAspectRatioChange(state(), '16:9');
    expect(onlyRatio.aspectRatio).toBe('16:9');
    expect(onlyRatio.width).toBeNull();
    expect(onlyRatio.height).toBeNull();
  });

  it('should lock the other dimension when a ratio is set', () => {
    const current = state({
      resolution: '1k',
      aspectRatio: '16:9',
      width: 1024,
      height: 576
    });
    const byWidth = applyWidthChange(current, 800);
    expect(byWidth.width).toBe(800);
    expect(byWidth.height).toBe(450);

    const byHeight = applyHeightChange(current, 720);
    expect(byHeight.height).toBe(720);
    expect(byHeight.width).toBe(1280);
  });

  it('should bump resolution up when a manual size exceeds the current cap', () => {
    const current = state({
      resolution: '1k',
      aspectRatio: '16:9',
      width: 1024,
      height: 576
    });
    const to2k = applyWidthChange(current, 1600);
    expect(to2k.width).toBe(1600);
    expect(to2k.height).toBe(900);
    expect(to2k.resolution).toBe('2k');

    const to4k = applyWidthChange(current, 3000);
    expect(to4k.resolution).toBe('4k');
    expect(to4k.width).toBe(3000);
    expect(to4k.height).toBe(1688);
  });

  it('should not auto-downgrade resolution when size shrinks', () => {
    const current = state({
      resolution: '2k',
      aspectRatio: '1:1',
      width: 2048,
      height: 2048
    });
    const next = applyWidthChange(current, 512);
    expect(next.width).toBe(512);
    expect(next.height).toBe(512);
    expect(next.resolution).toBe('2k');
  });

  it('should not bump resolution when it is auto', () => {
    const next = applyWidthChange(state({ aspectRatio: '1:1' }), 3000);
    expect(next.width).toBe(3000);
    expect(next.height).toBe(3000);
    expect(next.resolution).toBe('auto');
  });

  it('should scale an oversized custom size down when selecting a lower resolution without ratio', () => {
    const current = state({ width: 3000, height: 2000 });
    const next = applyResolutionChange(current, '1k');
    expect(next.resolution).toBe('1k');
    expect(next.width).toBe(1024);
    expect(next.height).toBe(683);
  });

  it('should allow switching concrete size back to auto without clearing resolution or ratio', () => {
    const current = state({
      resolution: '1k',
      aspectRatio: '16:9',
      width: 1024,
      height: 576
    });
    const next = applySizeAuto(current);
    expect(next.resolution).toBe('1k');
    expect(next.aspectRatio).toBe('16:9');
    expect(next.width).toBeNull();
    expect(next.height).toBeNull();
  });

  it('should materialize a starting size from the current constraints', () => {
    expect(materializeSize(state({ resolution: '2k', aspectRatio: '16:9' }))).toMatchObject({
      width: 2048,
      height: 1152
    });
    expect(materializeSize(state({ resolution: '2k' }))).toMatchObject({
      width: 2048,
      height: 2048
    });
    expect(materializeSize(state({ aspectRatio: '9:16' }))).toMatchObject({
      width: 576,
      height: 1024
    });
    expect(materializeSize(state())).toMatchObject({
      width: 1024,
      height: 1024
    });
  });

  it('should only add prompt constraints when there is no concrete size', () => {
    expect(buildSizePromptHint(state({ aspectRatio: '16:9' }))).toBe('16:9比例');
    expect(buildSizePromptHint(state({ resolution: '1k', aspectRatio: '16:9' }))).toBe('1K分辨率，16:9比例');
    expect(buildSizePromptHint(state({ resolution: '2k' }))).toBe('2K分辨率');
    expect(buildSizePromptHint(state())).toBeNull();
    expect(buildSizePromptHint(state({
      resolution: '1k',
      aspectRatio: '16:9',
      width: 1024,
      height: 576
    }))).toBeNull();
  });

  it('should append size hint after the original prompt', () => {
    expect(applySizePromptHint('一只猫', '16:9比例')).toBe('一只猫\n\n[输出要求: 16:9比例]');
    expect(applySizePromptHint('一只猫', null)).toBe('一只猫');
  });

  it('should format and parse size strings used by the API and gallery', () => {
    expect(formatSizeParam({ width: 1024, height: 576 })).toBe('1024x576');
    expect(formatSizeParam({ width: null, height: null })).toBe('auto');
    expect(parseSizeString('1024x576')).toEqual({ width: 1024, height: 576 });
    expect(parseSizeString('1024×1365')).toEqual({ width: 1024, height: 1365 });
    expect(parseSizeString('auto')).toBeNull();
    expect(inferResolutionTier(1024)).toBe('1k');
    expect(inferResolutionTier(1600)).toBe('2k');
    expect(inferResolutionTier(4096)).toBe('4k');
  });

  it('should restore size state from a gallery asset using generation settings', () => {
    // 设定为 2K 16:9 auto，即使实际图片下载尺寸是 2048x1152，复用生图设定时应保持 width/height 为 null
    const fromTargetSettings = hydrateImageSizeFromAsset({
      targetResolution: '2k',
      targetRatio: '16:9',
      targetSize: 'auto',
      size: '2048×1152',
      width: 2048,
      height: 1152,
      ratio: '16:9'
    });
    expect(fromTargetSettings).toEqual({
      resolution: '2k',
      aspectRatio: '16:9',
      width: null,
      height: null
    });

    // 设定为自动模式 auto/auto
    const fromAutoSettings = hydrateImageSizeFromAsset({
      targetResolution: 'auto',
      targetRatio: 'auto',
      targetSize: 'auto',
      size: '1024×1024',
      width: 1024,
      height: 1024,
      ratio: '1:1'
    });
    expect(fromAutoSettings).toEqual({
      resolution: 'auto',
      aspectRatio: 'auto',
      width: null,
      height: null
    });

    // 设定为明确自定义像素尺寸 1200x800
    const fromExplicitSettings = hydrateImageSizeFromAsset({
      targetResolution: '1k',
      targetRatio: 'auto',
      targetSize: '1200x800',
      size: '1200x800',
      width: 1200,
      height: 800
    });
    expect(fromExplicitSettings).toEqual({
      resolution: '1k',
      aspectRatio: '3:2',
      width: 1200,
      height: 800
    });

    // 向后兼容旧数据（无 target* 参数时回退到实际图片尺寸）
    const legacyRestored = hydrateImageSizeFromAsset({
      size: '1024x576',
      width: 1024,
      height: 576,
      ratio: '16:9'
    });
    expect(legacyRestored).toEqual({
      resolution: '1k',
      aspectRatio: '16:9',
      width: 1024,
      height: 576
    });
  });

  it('should restore size state from generation task params', () => {
    const fromAuto = hydrateImageSizeFromParams({
      size: 'auto',
      resolution: '2k',
      aspectRatio: '16:9'
    });
    expect(fromAuto).toEqual({
      resolution: '2k',
      aspectRatio: '16:9',
      width: null,
      height: null
    });

    const fromExplicit = hydrateImageSizeFromParams({
      size: '1024x1024',
      resolution: '1k',
      aspectRatio: '1:1'
    });
    expect(fromExplicit).toEqual({
      resolution: '1k',
      aspectRatio: '1:1',
      width: 1024,
      height: 1024
    });
  });

  it('should format quality labels into friendly Chinese text', () => {
    expect(formatQualityLabel('low')).toBe('低');
    expect(formatQualityLabel('medium')).toBe('中');
    expect(formatQualityLabel('high')).toBe('高');
    expect(formatQualityLabel('auto')).toBe('自动');
    expect(formatQualityLabel('hd')).toBe('高清');
    expect(formatQualityLabel('中')).toBe('中');
    expect(formatQualityLabel(undefined)).toBe('中');
  });

  it('should get resolution display string accurately', () => {
    expect(getResolutionDisplay({ resolution: '2k' })).toBe('2K');
    expect(getResolutionDisplay({ width: 1024, height: 1024 })).toBe('1K');
    expect(getResolutionDisplay({ width: 1920, height: 1080 })).toBe('2K');
    expect(getResolutionDisplay({ width: 4096, height: 2160 })).toBe('4K');
    expect(getResolutionDisplay({ size: '1254×1254' })).toBe('2K');
    expect(getResolutionDisplay({ size: '1024x1024' })).toBe('1K');
    expect(getResolutionDisplay({})).toBe('1K');
  });
});

