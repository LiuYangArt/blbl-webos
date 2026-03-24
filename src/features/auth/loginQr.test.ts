import { describe, expect, it } from 'vitest';
import { getLoginQrBitmapSize, getLoginQrDisplaySize } from './loginQr';

describe('loginQr', () => {
  it('在 1080p 电视视口下生成明显更大的二维码显示尺寸', () => {
    expect(getLoginQrDisplaySize(1920, 1080)).toBe(540);
    expect(getLoginQrBitmapSize(1920, 1080)).toBe(960);
  });

  it('在较小视口下仍保留足够可扫的最小尺寸', () => {
    expect(getLoginQrDisplaySize(1280, 720)).toBe(360);
    expect(getLoginQrDisplaySize(960, 540)).toBe(360);
    expect(getLoginQrBitmapSize(960, 540)).toBe(720);
  });

  it('在超大视口下限制二维码尺寸避免挤压文案区域', () => {
    expect(getLoginQrDisplaySize(3840, 2160)).toBe(560);
    expect(getLoginQrBitmapSize(3840, 2160)).toBe(960);
  });
});
