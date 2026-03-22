import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readDebugTelemetryUrlMock } = vi.hoisted(() => ({
  readDebugTelemetryUrlMock: vi.fn(),
}));

vi.mock('../../app/launchParams', () => ({
  readDebugTelemetryUrl: readDebugTelemetryUrlMock,
}));

async function loadPlayerDebugModule() {
  vi.resetModules();
  return import('./playerDebug');
}

const baseEvent = {
  type: 'play' as const,
  bvid: 'BV1xx411c7mD',
  cid: 12345,
  sourceUrl: 'https://example.com/video.m4s',
  quality: '1080P',
  codec: 'avc',
};

describe('playerDebug', () => {
  beforeEach(() => {
    readDebugTelemetryUrlMock.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('未配置 telemetry 地址时直接跳过上报', async () => {
    readDebugTelemetryUrlMock.mockReturnValue(null);
    const { reportPlayerDebugEvent } = await loadPlayerDebugModule();

    reportPlayerDebugEvent(baseEvent);
    await Promise.resolve();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('已配置 telemetry 地址时发送 POST，并缓存地址避免重复读取', async () => {
    readDebugTelemetryUrlMock.mockReturnValue('https://telemetry.example.com/log');
    const { reportPlayerDebugEvent } = await loadPlayerDebugModule();

    reportPlayerDebugEvent(baseEvent);
    reportPlayerDebugEvent({ ...baseEvent, type: 'progress', currentTime: 10 });
    await Promise.resolve();
    await Promise.resolve();

    expect(readDebugTelemetryUrlMock).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('https://telemetry.example.com/log', expect.objectContaining({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
    }));
  });
});
