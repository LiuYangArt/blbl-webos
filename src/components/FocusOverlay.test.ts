import { describe, expect, it } from 'vitest';
import { expandBorderRadius } from './focusOverlayRadius';

describe('expandBorderRadius', () => {
  it('会把像素圆角按 ring 厚度整体外扩', () => {
    expect(expandBorderRadius('22px', 4)).toBe('26px');
    expect(expandBorderRadius('22px 10px / 18px 6px', 4)).toBe('26px 14px / 22px 10px');
  });

  it('不会改动百分比圆角', () => {
    expect(expandBorderRadius('50%', 4)).toBe('50%');
  });

  it('会把结果钳制到非负值', () => {
    expect(expandBorderRadius('2px', -6)).toBe('0px');
  });
});
