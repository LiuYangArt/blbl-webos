import { describe, expect, it } from 'vitest';
import { decidePlayerChromeRemoteAction } from './playerRemoteMode';

describe('playerRemoteMode', () => {
  it('默认播放态下左右键直接 seek，确认键切换播放', () => {
    expect(decidePlayerChromeRemoteAction('left', false)).toBe('seek-backward');
    expect(decidePlayerChromeRemoteAction('right', false)).toBe('seek-forward');
    expect(decidePlayerChromeRemoteAction('enter', false)).toBe('toggle-play');
  });

  it('专用播放/暂停键直接映射到播放器动作', () => {
    expect(decidePlayerChromeRemoteAction('play', false)).toBe('play');
    expect(decidePlayerChromeRemoteAction('pause', false)).toBe('pause');
  });

  it('默认播放态下上下键进入 OSD 控件区', () => {
    expect(decidePlayerChromeRemoteAction('up', false)).toBe('focus-controls');
    expect(decidePlayerChromeRemoteAction('down', false)).toBe('focus-controls');
  });

  it('OSD 控件已聚焦时，上下键退出控件区，左右和确认交回默认焦点系统', () => {
    expect(decidePlayerChromeRemoteAction('up', true)).toBe('blur-controls');
    expect(decidePlayerChromeRemoteAction('down', true)).toBe('blur-controls');
    expect(decidePlayerChromeRemoteAction('left', true)).toBe('delegate');
    expect(decidePlayerChromeRemoteAction('right', true)).toBe('delegate');
    expect(decidePlayerChromeRemoteAction('enter', true)).toBe('delegate');
  });

  it('OSD 控件已聚焦时，专用播放/暂停键仍然生效', () => {
    expect(decidePlayerChromeRemoteAction('play', true)).toBe('play');
    expect(decidePlayerChromeRemoteAction('pause', true)).toBe('pause');
  });
});
