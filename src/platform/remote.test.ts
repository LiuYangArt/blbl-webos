import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_KEYS } from './webos';

const { moveFocusMock, activateFocusedMock } = vi.hoisted(() => ({
  moveFocusMock: vi.fn(),
  activateFocusedMock: vi.fn(),
}));

vi.mock('./focus', () => ({
  moveFocus: moveFocusMock,
  activateFocused: activateFocusedMock,
  isFocusableElement: (element: HTMLElement) => element.dataset.focusable === 'true',
}));

import { attachRemoteControl, REMOTE_INTENT_EVENT } from './remote';

describe('remote', () => {
  beforeEach(() => {
    moveFocusMock.mockReset();
    activateFocusedMock.mockReset();
    vi.spyOn(performance, 'now').mockReturnValue(1_000);
    document.body.innerHTML = '';
  });

  it('方向键和确认键会映射到焦点行为', () => {
    const detach = attachRemoteControl({ onBack: vi.fn() });

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.LEFT }));
    window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: REMOTE_KEYS.LEFT }));
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.ENTER }));

    expect(moveFocusMock).toHaveBeenCalledWith('left');
    expect(activateFocusedMock).toHaveBeenCalledTimes(1);

    detach();
  });

  it('返回键触发 onBack', () => {
    const onBack = vi.fn();
    const detach = attachRemoteControl({ onBack });

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.BACK }));

    expect(onBack).toHaveBeenCalledTimes(1);
    detach();
  });

  it('输入框聚焦时忽略方向键，但仍允许返回键', () => {
    const onBack = vi.fn();
    const detach = attachRemoteControl({ onBack });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.RIGHT }));
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.BACK }));

    expect(moveFocusMock).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
    detach();
  });

  it('接入焦点系统的输入框聚焦时，方向键仍然会参与遥控器导航', () => {
    const detach = attachRemoteControl({ onBack: vi.fn() });
    const input = document.createElement('input');
    input.dataset.focusable = 'true';
    input.dataset.focusId = 'relay-host-input';
    input.dataset.focusSection = 'relay-settings';
    document.body.appendChild(input);
    input.focus();

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.DOWN }));

    expect(moveFocusMock).toHaveBeenCalledWith('down');
    detach();
  });

  it('remote intent 事件被取消时，不继续执行默认动作', () => {
    const detach = attachRemoteControl({ onBack: vi.fn() });
    const blocker = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener(REMOTE_INTENT_EVENT, blocker);

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.DOWN }));

    expect(moveFocusMock).not.toHaveBeenCalled();

    window.removeEventListener(REMOTE_INTENT_EVENT, blocker);
    detach();
  });

  it('播放/暂停键会分发 remote intent 事件', () => {
    const detach = attachRemoteControl({ onBack: vi.fn() });
    const actions: string[] = [];
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ action: string }>).detail;
      actions.push(detail.action);
    };
    window.addEventListener(REMOTE_INTENT_EVENT, listener);

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.PLAY }));
    window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: REMOTE_KEYS.PLAY }));
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.PAUSE }));

    expect(actions).toEqual(['play', 'pause']);

    window.removeEventListener(REMOTE_INTENT_EVENT, listener);
    detach();
  });

  it('按键防抖会拦截连续重复触发，keyup 或 blur 后允许再次响应', () => {
    const detach = attachRemoteControl({ onBack: vi.fn() });

    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.UP }));
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.UP }));
    expect(moveFocusMock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: REMOTE_KEYS.UP }));
    vi.spyOn(performance, 'now').mockReturnValue(1_200);
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.UP }));
    expect(moveFocusMock).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event('blur'));
    vi.spyOn(performance, 'now').mockReturnValue(1_400);
    window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: REMOTE_KEYS.UP }));
    expect(moveFocusMock).toHaveBeenCalledTimes(3);

    detach();
  });
});
