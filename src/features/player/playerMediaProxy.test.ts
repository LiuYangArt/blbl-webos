import { beforeEach, describe, expect, it, vi } from 'vitest';
const {
  mockReadMediaProxyOrigin,
  mockGetRelayBaseUrl,
  mockHasRelayConfiguration,
  mockReadRelaySettings,
} = vi.hoisted(() => ({
  mockReadMediaProxyOrigin: vi.fn(),
  mockGetRelayBaseUrl: vi.fn(),
  mockHasRelayConfiguration: vi.fn(),
  mockReadRelaySettings: vi.fn(),
}));

vi.mock('../../app/launchParams', () => ({
  readMediaProxyOrigin: mockReadMediaProxyOrigin,
}));

vi.mock('../../services/relay/settings', () => ({
  getRelayBaseUrl: mockGetRelayBaseUrl,
  hasRelayConfiguration: mockHasRelayConfiguration,
  readRelaySettings: mockReadRelaySettings,
}));

import {
  resolvePlaybackCandidateUrls,
  resolvePlayerMediaProxyOrigin,
} from './playerMediaProxy';

describe('playerMediaProxy', () => {
  beforeEach(() => {
    mockReadMediaProxyOrigin.mockReset();
    mockGetRelayBaseUrl.mockReset();
    mockHasRelayConfiguration.mockReset();
    mockReadRelaySettings.mockReset();
    mockReadRelaySettings.mockReturnValue({
      enabled: true,
      host: '192.168.50.81',
      port: 19091,
      accessToken: '',
      healthTimeoutMs: 1800,
      requestTimeoutMs: 7000,
    });
    mockHasRelayConfiguration.mockReturnValue(true);
    mockGetRelayBaseUrl.mockReturnValue('http://192.168.50.81:19091');
  });

  it('模拟器未传配置时使用默认媒体代理地址', () => {
    mockReadMediaProxyOrigin.mockReturnValue(null);

    expect(resolvePlayerMediaProxyOrigin('webos-simulator')).toBe('http://127.0.0.1:19033');
  });

  it('非模拟器设备不走媒体代理', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19033');

    expect(resolvePlayerMediaProxyOrigin('webos-2021')).toBe('http://127.0.0.1:19033');
  });

  it('模拟器模式会把视频和音频候选地址改写为代理 URL', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19034');

    const resolved = resolvePlaybackCandidateUrls({
      id: 'dash-pair:1',
      videoUrl: 'https://upos-sz.bilivideo.com/video.m4s?foo=1',
      audioUrl: 'https://upos-sz.bilivideo.com/audio.m4s?bar=2',
    }, 'webos-simulator');

    expect(resolved).not.toBeNull();
    expect(new URL(resolved!.videoUrl).origin).toBe('http://127.0.0.1:19034');
    expect(new URL(resolved!.videoUrl).pathname).toBe('/media');
    expect(new URL(resolved!.videoUrl).searchParams.get('url')).toBe('https://upos-sz.bilivideo.com/video.m4s?foo=1');
    expect(new URL(resolved!.audioUrl ?? '').searchParams.get('url')).toBe('https://upos-sz.bilivideo.com/audio.m4s?bar=2');
  });

  it('启用 relay 媒体代理偏好时，真实设备会回落到 relay base url', () => {
    mockReadMediaProxyOrigin.mockReturnValue(null);

    const resolved = resolvePlaybackCandidateUrls({
      id: 'dash-pair:1',
      videoUrl: 'https://upos-sz.bilivideo.com/video.m4s?foo=1',
      audioUrl: 'https://upos-sz.bilivideo.com/audio.m4s?bar=2',
    }, 'webos-2021', {
      preferRelayProxy: true,
    });

    expect(mockReadRelaySettings).toHaveBeenCalled();
    expect(resolved).not.toBeNull();
    expect(new URL(resolved!.videoUrl).origin).toBe('http://192.168.50.81:19091');
    expect(new URL(resolved!.videoUrl).pathname).toBe('/media');
    expect(new URL(resolved!.videoUrl).searchParams.get('url')).toBe('https://upos-sz.bilivideo.com/video.m4s?foo=1');
    expect(new URL(resolved!.audioUrl ?? '').searchParams.get('url')).toBe('https://upos-sz.bilivideo.com/audio.m4s?bar=2');
  });

  it('非模拟器设备保留原始候选地址', () => {
    mockReadMediaProxyOrigin.mockReturnValue(null);
    const candidate = {
      id: 'compatible:80:0',
      videoUrl: 'https://example.com/video.mp4',
      audioUrl: null,
    };

    expect(resolvePlaybackCandidateUrls(candidate, 'webos-2021')).toEqual(candidate);
  });

  it('显式 launch param 提供媒体代理时，真实设备分类也会改写候选地址', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19034');

    const resolved = resolvePlaybackCandidateUrls({
      id: 'compatible:80:0',
      videoUrl: 'https://upos-sz.bilivideo.com/video.mp4',
      audioUrl: null,
    }, 'webos-2021');

    expect(resolved).not.toBeNull();
    expect(new URL(resolved!.videoUrl).origin).toBe('http://127.0.0.1:19034');
    expect(new URL(resolved!.videoUrl).pathname).toBe('/media');
    expect(new URL(resolved!.videoUrl).searchParams.get('url')).toBe('https://upos-sz.bilivideo.com/video.mp4');
  });

  it('显式 launch param 提供媒体代理时，会优先于 relay 自动代理', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19034');

    const origin = resolvePlayerMediaProxyOrigin('webos-2021', {
      preferRelayProxy: true,
    });

    expect(origin).toBe('http://127.0.0.1:19034');
    expect(mockReadRelaySettings).not.toHaveBeenCalled();
  });
});
