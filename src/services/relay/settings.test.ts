import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRelayAuthMaterial,
  getRelayBaseUrl,
  readRelayAuthMaterial,
  readRelaySettings,
  writeRelayAuthMaterial,
  writeRelaySettings,
} from './settings';

describe('relay settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('会用默认值初始化 relay 配置', () => {
    expect(readRelaySettings()).toEqual({
      enabled: true,
      host: '',
      port: 19091,
      accessToken: '',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    });
  });

  it('会清理 host 并钳制端口与超时参数', () => {
    const result = writeRelaySettings({
      enabled: true,
      host: ' http://192.168.50.10:19091/relay ',
      port: 999999,
      accessToken: ' token ',
      healthTimeoutMs: 200,
      requestTimeoutMs: 999999,
    });

    expect(result).toEqual({
      enabled: true,
      host: '192.168.50.10',
      port: 65535,
      accessToken: 'token',
      healthTimeoutMs: 500,
      requestTimeoutMs: 20000,
    });
  });

  it('直接输入 host 时不会把未完成的 IP 段自动改写掉', () => {
    const result = writeRelaySettings({
      enabled: true,
      host: '192.168.0.',
      port: 19091,
    });

    expect(result.host).toBe('192.168.0.');
    expect(result.port).toBe(19091);
  });

  it('会兼容旧版 baseUrl 存储并迁移为 host 和 port', () => {
    window.localStorage.setItem('bilibili_webos.relay_settings', JSON.stringify({
      enabled: true,
      baseUrl: 'http://192.168.50.10:19092/',
      accessToken: 'legacy-token',
    }));

    expect(readRelaySettings()).toEqual({
      enabled: true,
      host: '192.168.50.10',
      port: 19092,
      accessToken: 'legacy-token',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    });
  });

  it('会根据 host 和 port 生成 relay base url', () => {
    expect(getRelayBaseUrl({
      enabled: true,
      host: '192.168.50.10',
      port: 19091,
      accessToken: '',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    })).toBe('http://192.168.50.10:19091');
  });

  it('会持久化和清空 relay 登录同步材料', () => {
    writeRelayAuthMaterial({
      loginUrl: 'https://passport.bilibili.com/login-done',
      refreshToken: 'refresh-token',
      completedAt: 1710000000000,
      mid: 12345,
      uname: '测试用户',
      vip: true,
      capturedAt: 1710000001000,
    });

    expect(readRelayAuthMaterial()).toEqual({
      loginUrl: 'https://passport.bilibili.com/login-done',
      refreshToken: 'refresh-token',
      completedAt: 1710000000000,
      mid: 12345,
      uname: '测试用户',
      vip: true,
      capturedAt: 1710000001000,
    });

    clearRelayAuthMaterial();
    expect(readRelayAuthMaterial()).toBeNull();
  });
});
