import { describe, expect, it, vi } from 'vitest';

const {
  installAllMock,
  isBrowserSupportedMock,
  addEventListenerMock,
  removeEventListenerMock,
  configureMock,
  attachMock,
  loadMock,
  destroyMock,
} = vi.hoisted(() => ({
  installAllMock: vi.fn(),
  isBrowserSupportedMock: vi.fn(),
  addEventListenerMock: vi.fn(),
  removeEventListenerMock: vi.fn(),
  configureMock: vi.fn(),
  attachMock: vi.fn().mockResolvedValue(undefined),
  loadMock: vi.fn().mockResolvedValue(undefined),
  destroyMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('shaka-player/dist/shaka-player.dash.js', () => ({
  default: {
    polyfill: {
      installAll: installAllMock,
    },
    Player: class {
      static isBrowserSupported = isBrowserSupportedMock;
      addEventListener = addEventListenerMock;
      removeEventListener = removeEventListenerMock;
      configure = configureMock;
      attach = attachMock;
      load = loadMock;
      destroy = destroyMock;
    },
  },
}));

import { createShakaPlayer, formatShakaError } from './playerShaka';

describe('playerShaka', () => {
  it('formatShakaError 会拼接 code/data/message', () => {
    expect(formatShakaError({
      code: 3016,
      message: 'manifest error',
      data: ['segment', 403],
    })).toEqual({
      code: 3016,
      message: 'manifest error (segment, 403)',
    });

    expect(formatShakaError(null)).toEqual({
      code: null,
      message: 'Shaka 播放失败',
    });
  });

  it('createShakaPlayer 在支持环境下创建 session，并正确清理监听', async () => {
    installAllMock.mockReset();
    isBrowserSupportedMock.mockReset();
    addEventListenerMock.mockReset();
    removeEventListenerMock.mockReset();
    configureMock.mockReset();
    attachMock.mockReset();
    loadMock.mockReset();
    destroyMock.mockReset();

    isBrowserSupportedMock.mockReturnValue(true);
    attachMock.mockResolvedValue(undefined);
    loadMock.mockResolvedValue(undefined);
    destroyMock.mockResolvedValue(undefined);

    const video = document.createElement('video');
    const onError = vi.fn();
    const session = await createShakaPlayer(video, onError);

    expect(installAllMock).toHaveBeenCalled();
    expect(addEventListenerMock).toHaveBeenCalledWith('error', expect.any(Function));
    expect(configureMock).toHaveBeenCalled();

    await session.load('blob:manifest');
    expect(attachMock).toHaveBeenCalledWith(video);
    expect(loadMock).toHaveBeenCalledWith('blob:manifest');

    await session.destroy();
    expect(removeEventListenerMock).toHaveBeenCalledWith('error', expect.any(Function));
    expect(destroyMock).toHaveBeenCalled();
  });

  it('createShakaPlayer 在不支持环境下抛错', async () => {
    isBrowserSupportedMock.mockReturnValue(false);

    await expect(createShakaPlayer(document.createElement('video'), vi.fn()))
      .rejects
      .toThrow('当前设备不支持 Shaka 所需的 DASH/MSE 播放能力。');
  });
});
