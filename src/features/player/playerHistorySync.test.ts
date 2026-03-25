import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayApiError } from '../../services/relay/client';

const {
  reportVideoHeartbeatMock,
  reportVideoHistoryProgressMock,
  reportRelayHeartbeatMock,
  reportRelayHistoryProgressMock,
  readRelaySettingsMock,
  hasRelayConfigurationMock,
} = vi.hoisted(() => ({
  reportVideoHeartbeatMock: vi.fn(),
  reportVideoHistoryProgressMock: vi.fn(),
  reportRelayHeartbeatMock: vi.fn(),
  reportRelayHistoryProgressMock: vi.fn(),
  readRelaySettingsMock: vi.fn(),
  hasRelayConfigurationMock: vi.fn(),
}));

vi.mock('../../services/api/bilibili', () => ({
  reportVideoHeartbeat: reportVideoHeartbeatMock,
  reportVideoHistoryProgress: reportVideoHistoryProgressMock,
}));

vi.mock('../../services/relay/client', async () => {
  const actual = await vi.importActual<typeof import('../../services/relay/client')>('../../services/relay/client');
  return {
    ...actual,
    reportRelayHeartbeat: reportRelayHeartbeatMock,
    reportRelayHistoryProgress: reportRelayHistoryProgressMock,
  };
});

vi.mock('../../services/relay/settings', () => ({
  readRelaySettings: readRelaySettingsMock,
  hasRelayConfiguration: hasRelayConfigurationMock,
}));

async function loadHistorySyncModule() {
  vi.resetModules();
  return import('./playerHistorySync');
}

describe('playerHistorySync', () => {
  beforeEach(() => {
    reportVideoHeartbeatMock.mockReset();
    reportVideoHistoryProgressMock.mockReset();
    reportRelayHeartbeatMock.mockReset();
    reportRelayHistoryProgressMock.mockReset();
    readRelaySettingsMock.mockReset();
    hasRelayConfigurationMock.mockReset();

    readRelaySettingsMock.mockReturnValue({
      enabled: true,
      host: '',
      port: 19091,
      accessToken: '',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    });
    hasRelayConfigurationMock.mockReturnValue(false);
  });

  it('未配置 relay 时，heartbeat 直接走本地直写', async () => {
    const { syncPlayerHistoryHeartbeat } = await loadHistorySyncModule();

    const result = await syncPlayerHistoryHeartbeat({
      aid: 1001,
      bvid: 'BV1history',
      cid: 2002,
      playedTime: 15,
    });

    expect(reportRelayHeartbeatMock).not.toHaveBeenCalled();
    expect(reportVideoHeartbeatMock).toHaveBeenCalledWith({
      aid: 1001,
      bvid: 'BV1history',
      cid: 2002,
      playedTime: 15,
    });
    expect(result).toEqual({
      path: 'direct',
      relayAttempted: false,
      relayFallbackReason: 'relay not configured',
    });
  });

  it('已配置 relay 且 relay 成功时，history report 优先走 relay', async () => {
    hasRelayConfigurationMock.mockReturnValue(true);
    reportRelayHistoryProgressMock.mockResolvedValue(undefined);

    const { syncPlayerHistoryProgress } = await loadHistorySyncModule();
    const result = await syncPlayerHistoryProgress({
      aid: 1001,
      cid: 2002,
      progress: 88,
    });

    expect(reportRelayHistoryProgressMock).toHaveBeenCalledTimes(1);
    expect(reportVideoHistoryProgressMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      path: 'relay',
      relayAttempted: true,
      relayFallbackReason: null,
    });
  });

  it('relay heartbeat 失败时，会自动回退到本地直写', async () => {
    hasRelayConfigurationMock.mockReturnValue(true);
    reportRelayHeartbeatMock.mockRejectedValue(new RelayApiError('relay 无会话', 'auth_missing', 409));

    const { syncPlayerHistoryHeartbeat } = await loadHistorySyncModule();
    const result = await syncPlayerHistoryHeartbeat({
      bvid: 'BV1fallback',
      cid: 2002,
      playedTime: 22,
    });

    expect(reportRelayHeartbeatMock).toHaveBeenCalledTimes(1);
    expect(reportVideoHeartbeatMock).toHaveBeenCalledWith({
      bvid: 'BV1fallback',
      cid: 2002,
      playedTime: 22,
    });
    expect(result).toEqual({
      path: 'direct',
      relayAttempted: true,
      relayFallbackReason: 'relay auth missing',
    });
  });

  it('relay 与本地直写都失败时，会抛出合并后的错误信息', async () => {
    hasRelayConfigurationMock.mockReturnValue(true);
    reportRelayHistoryProgressMock.mockRejectedValue(new RelayApiError('relay 超时', 'timeout', 504));
    reportVideoHistoryProgressMock.mockRejectedValue(new Error('当前登录态缺少 csrf'));

    const { syncPlayerHistoryProgress } = await loadHistorySyncModule();

    await expect(syncPlayerHistoryProgress({
      aid: 1001,
      cid: 2002,
      progress: 99,
    })).rejects.toThrow('relay 历史上报失败后，本地兜底也失败');
  });
});
