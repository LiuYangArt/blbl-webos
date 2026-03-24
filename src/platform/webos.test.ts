import { describe, expect, it, vi } from 'vitest';
import {
  getKeyboardVisible,
  isWebOSAvailable,
  observeKeyboardVisibility,
  platformBack,
  readDeviceInfo,
} from './webos';

describe('webos', () => {
  it('能识别 webOS 环境是否可用', () => {
    delete window.webOS;
    expect(isWebOSAvailable()).toBe(false);

    window.webOS = {};
    expect(isWebOSAvailable()).toBe(true);
  });

  it('platformBack 优先调用 webOS，其次 PalmSystem，最后回退 history', () => {
    const webOsBack = vi.fn();
    const palmBack = vi.fn();
    const historyBack = vi.fn();
    vi.spyOn(window.history, 'back').mockImplementation(historyBack);

    window.webOS = {
      platformBack: webOsBack,
    };
    window.PalmSystem = {
      platformBack: palmBack,
    };

    platformBack();
    expect(webOsBack).toHaveBeenCalledTimes(1);
    expect(palmBack).not.toHaveBeenCalled();
    expect(historyBack).not.toHaveBeenCalled();

    delete window.webOS.platformBack;
    platformBack();
    expect(palmBack).toHaveBeenCalledTimes(1);

    delete window.PalmSystem?.platformBack;
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(2);
    platformBack();
    expect(historyBack).toHaveBeenCalledTimes(1);
  });

  it('读取键盘显示状态并在无能力时回落 false', () => {
    delete window.webOS;
    expect(getKeyboardVisible()).toBe(false);

    window.webOS = {
      keyboard: {
        isShowing: () => true,
      },
    };
    expect(getKeyboardVisible()).toBe(true);
  });

  it('能监听官方 keyboardStateChange 事件', () => {
    const keyboardVisibilityChange = vi.fn();
    const stop = observeKeyboardVisibility(keyboardVisibilityChange);

    document.dispatchEvent(new CustomEvent('keyboardStateChange', {
      detail: { visibility: true },
    }));
    document.dispatchEvent(new CustomEvent('keyboardStateChange', {
      detail: { visibility: false },
    }));

    stop();

    expect(keyboardVisibilityChange).toHaveBeenNthCalledWith(1, true);
    expect(keyboardVisibilityChange).toHaveBeenNthCalledWith(2, false);
  });

  it('readDeviceInfo 在无能力时返回 null，有能力时返回设备信息', async () => {
    delete window.webOS;
    await expect(readDeviceInfo()).resolves.toBeNull();

    window.webOS = {
      deviceInfo: (callback) => callback({
        modelName: 'OLED55C1',
        platformVersion: '6.3.0',
      }),
    };

    await expect(readDeviceInfo()).resolves.toEqual({
      modelName: 'OLED55C1',
      platformVersion: '6.3.0',
    });
  });
});
