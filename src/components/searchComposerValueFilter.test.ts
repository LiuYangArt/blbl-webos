import { describe, expect, it } from 'vitest';
import {
  applySearchComposerValueFilter,
  resolveSearchComposerInputMode,
  resolveSearchComposerMaxLength,
} from './searchComposerValueFilter';

describe('searchComposerValueFilter', () => {
  it('数字过滤器只保留数字', () => {
    expect(applySearchComposerValueFilter('19a09b1', 'digits')).toBe('19091');
  });

  it('IP 过滤器只保留数字和点，并限制为 4 段', () => {
    expect(applySearchComposerValueFilter('192a.168b.50c.81d', 'ip-address')).toBe('192.168.50.81');
    expect(applySearchComposerValueFilter('192.168.50.81.99', 'ip-address')).toBe('192.168.50.81');
  });

  it('IP 过滤器会限制每段最多 3 位', () => {
    expect(applySearchComposerValueFilter('1234.5678.9999.0000', 'ip-address')).toBe('123.567.999.000');
  });

  it('过滤器会推导统一 inputMode 和默认长度', () => {
    expect(resolveSearchComposerInputMode('digits')).toBe('numeric');
    expect(resolveSearchComposerInputMode('ip-address')).toBe('decimal');
    expect(resolveSearchComposerMaxLength('ip-address')).toBe(15);
    expect(resolveSearchComposerMaxLength('digits', 5)).toBe(5);
  });
});
