import { describe, expect, it } from 'vitest';
import { shouldAutofocusContentAfterMutation } from './focusPolicy';

describe('focusPolicy', () => {
  it('普通内容页在后续长出可聚焦元素时仍允许自动补焦点', () => {
    expect(shouldAutofocusContentAfterMutation({ name: 'home' })).toBe(true);
    expect(shouldAutofocusContentAfterMutation({ name: 'search' })).toBe(true);
  });

  it('播放器沉浸页不应在 OSD 出现后自动把焦点塞到底部按钮区', () => {
    expect(shouldAutofocusContentAfterMutation({
      name: 'player',
      bvid: 'BV1debug001',
      cid: 1001,
      title: 'test',
    })).toBe(false);
  });
});
