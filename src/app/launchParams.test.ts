import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadLaunchParamsModule() {
  vi.resetModules();
  return import('./launchParams');
}

describe('launchParams', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    delete window.launchParams;
    delete window.PalmSystem;
  });

  it('从字符串 launch params 解析播放器首屏路由', async () => {
    window.launchParams = JSON.stringify({
      route: 'player',
      bvid: 'BV1xx411c7mD',
      cid: '12345',
      title: '播放器直达',
      part: 'P1',
    });

    const { resolveInitialRoute } = await loadLaunchParamsModule();

    expect(resolveInitialRoute()).toEqual({
      name: 'player',
      bvid: 'BV1xx411c7mD',
      cid: 12345,
      title: '播放器直达',
      part: 'P1',
    });
  });

  it('播放器参数不完整时回到首页', async () => {
    window.launchParams = {
      route: 'player',
      bvid: 'BV1xx411c7mD',
      title: '缺少 cid',
    };

    const { resolveInitialRoute } = await loadLaunchParamsModule();

    expect(resolveInitialRoute()).toEqual({ name: 'home' });
  });

  it('优先读取 URL 查询参数中的焦点调试开关', async () => {
    window.history.replaceState({}, '', '/?debugFocus=1');
    window.launchParams = {
      debugFocus: false,
    };

    const { readDebugFocusEnabled } = await loadLaunchParamsModule();

    expect(readDebugFocusEnabled()).toBe(true);
  });

  it('从 PalmSystem launch params 读取媒体代理地址', async () => {
    window.PalmSystem = {
      launchParams: JSON.stringify({
        mediaProxyOrigin: 'http://127.0.0.1:19033',
      }),
    };

    const { readMediaProxyOrigin } = await loadLaunchParamsModule();

    expect(readMediaProxyOrigin()).toBe('http://127.0.0.1:19033');
  });
});
