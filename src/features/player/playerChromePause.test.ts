import { describe, expect, it } from 'vitest';
import { shouldRevealChromeAfterPause } from './playerChromePause';

describe('playerChromePause', () => {
  it('播放器重置阶段的程序化 pause 不应拉起 OSD', () => {
    expect(shouldRevealChromeAfterPause(true)).toBe(false);
  });

  it('普通 pause 仍应显示 OSD，便于继续操作', () => {
    expect(shouldRevealChromeAfterPause(false)).toBe(true);
  });
});
