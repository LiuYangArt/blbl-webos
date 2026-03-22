import { beforeEach, describe, expect, it, vi } from 'vitest';
const { mockReadMediaProxyOrigin } = vi.hoisted(() => ({
  mockReadMediaProxyOrigin: vi.fn(),
}));

vi.mock('../../app/launchParams', () => ({
  readMediaProxyOrigin: mockReadMediaProxyOrigin,
}));

import {
  resolvePlaybackCandidateUrls,
  resolvePlayerMediaProxyOrigin,
} from './playerMediaProxy';

describe('playerMediaProxy', () => {
  beforeEach(() => {
    mockReadMediaProxyOrigin.mockReset();
  });

  it('模拟器未传配置时使用默认媒体代理地址', () => {
    mockReadMediaProxyOrigin.mockReturnValue(null);

    expect(resolvePlayerMediaProxyOrigin('webos-simulator')).toBe('http://127.0.0.1:19033');
  });

  it('非模拟器设备不走媒体代理', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19033');

    expect(resolvePlayerMediaProxyOrigin('webos-2021')).toBeNull();
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

  it('非模拟器设备保留原始候选地址', () => {
    mockReadMediaProxyOrigin.mockReturnValue('http://127.0.0.1:19034');
    const candidate = {
      id: 'compatible:80:0',
      videoUrl: 'https://example.com/video.mp4',
      audioUrl: null,
    };

    expect(resolvePlaybackCandidateUrls(candidate, 'webos-2021')).toEqual(candidate);
  });
});
