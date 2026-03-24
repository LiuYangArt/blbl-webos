import { describe, expect, it } from 'vitest';
import {
  buildPlayerCodecCapability,
  buildPlaybackAttempts,
  formatAttemptResolution,
  getAutoCodecPriority,
  parseVideoCodec,
} from './playerCodec';
import type {
  PlayAudioStream,
  PlayCompatibleSource,
  PlayQualityOption,
  PlaySource,
  PlayVideoStream,
} from '../../services/api/types';

const qualities: PlayQualityOption[] = [
  {
    qn: 80,
    label: '1080P',
    limitReason: 0,
    codecs: ['avc', 'hevc'],
    tier: '1080p',
  },
];

const videoStreams: PlayVideoStream[] = [
  {
    id: 101,
    quality: 80,
    qualityLabel: '1080P',
    codec: 'avc',
    codecs: 'avc1.640028',
    url: 'https://upos-sz.bilivideo.com/video-avc.m4s',
    backupUrls: ['https://mcdn.example.com/video-avc.m4s'],
    mimeType: 'video/mp4',
    segmentBase: {
      initialization: '0-100',
      indexRange: '101-200',
    },
    width: 1920,
    height: 1080,
    bandwidth: 2_000_000,
    frameRate: 60,
  },
  {
    id: 102,
    quality: 80,
    qualityLabel: '1080P',
    codec: 'hevc',
    codecs: 'hvc1.1.6.L120.B0',
    url: 'https://upos-sz.bilivideo.com/video-hevc.m4s',
    backupUrls: [],
    mimeType: 'video/mp4',
    segmentBase: {
      initialization: '0-100',
      indexRange: '101-200',
    },
    width: 1920,
    height: 1080,
    bandwidth: 1_600_000,
    frameRate: 60,
  },
];

const videoStreamsWithAv1: PlayVideoStream[] = [
  ...videoStreams,
  {
    id: 103,
    quality: 80,
    qualityLabel: '1080P',
    codec: 'av1',
    codecs: 'av01.0.08M.08',
    url: 'https://upos-sz.bilivideo.com/video-av1.m4s',
    backupUrls: [],
    mimeType: 'video/mp4',
    segmentBase: {
      initialization: '0-100',
      indexRange: '101-200',
    },
    width: 1920,
    height: 1080,
    bandwidth: 1_300_000,
    frameRate: 60,
  },
];

const audioStreams: PlayAudioStream[] = [
  {
    id: 201,
    url: 'https://upos-sz.bilivideo.com/audio.m4s',
    backupUrls: ['https://mcdn.example.com/audio.m4s'],
    mimeType: 'audio/mp4',
    segmentBase: {
      initialization: '0-50',
      indexRange: '51-99',
    },
    bandwidth: 128_000,
    codecs: 'mp4a.40.2',
    kind: 'aac',
    label: 'AAC',
  },
];

const audioStreamsWithVariants: PlayAudioStream[] = [
  {
    id: 201,
    url: 'https://upos-sz.bilivideo.com/audio-128.m4s',
    backupUrls: ['https://mcdn.example.com/audio-128.m4s'],
    mimeType: 'audio/mp4',
    segmentBase: {
      initialization: '0-50',
      indexRange: '51-99',
    },
    bandwidth: 128_000,
    codecs: 'mp4a.40.2',
    kind: 'aac',
    label: 'AAC 128K',
  },
  {
    id: 202,
    url: 'https://upos-sz.bilivideo.com/audio-320.m4s',
    backupUrls: ['https://mcdn.example.com/audio-320.m4s'],
    mimeType: 'audio/mp4',
    segmentBase: {
      initialization: '0-50',
      indexRange: '51-99',
    },
    bandwidth: 320_000,
    codecs: 'mp4a.40.2',
    kind: 'aac',
    label: 'AAC 320K',
  },
];

const compatibleSources: PlayCompatibleSource[] = [
  {
    quality: 80,
    qualityLabel: '1080P',
    format: 'mp4',
    url: 'https://upos-sz.bilivideo.com/video-compatible.mp4',
    candidateUrls: ['https://upos-sz.bilivideo.com/video-compatible.mp4'],
  },
];

const playSource: PlaySource = {
  mode: 'dash',
  qualityLabel: '1080P',
  currentQuality: 80,
  returnedQuality: 80,
  returnedQualityLabel: '1080P',
  compatibleQuality: 80,
  compatibleQualityLabel: '1080P',
  requestedQuality: 80,
  requestedQualityLabel: '1080P',
  qualityLimitReason: 0,
  qualityReason: '接口已返回 1080P 播放源。',
  durationMs: 120_000,
  qualities,
  videoStreams,
  audioStreams,
  compatibleSources,
  candidateUrls: compatibleSources[0].candidateUrls,
  requestTrace: {
    dash: [],
    compatible: [],
  },
};

describe('playerCodec', () => {
  it('识别常见 B 站视频编码', () => {
    expect(parseVideoCodec('avc1.640028')).toBe('avc');
    expect(parseVideoCodec('hev1.1.6.L120.B0')).toBe('hevc');
    expect(parseVideoCodec('hvc1.1.6.L120.B0')).toBe('hevc');
    expect(parseVideoCodec('av01.0.08M.08')).toBe('av1');
    expect(parseVideoCodec('vp09.00.10.08')).toBe('unknown');
  });

  it('自动编码优先级会综合能力探测和历史成功结果', () => {
    const ordered = getAutoCodecPriority(
      { avc: true, hevc: true, av1: false },
      {
        lastSuccessfulCodec: 'hevc',
        lastFailedCodec: 'avc',
        lastSuccessfulMode: null,
        lastFailedMode: null,
        lastSuccessfulQuality: null,
        lastSuccessfulAudioStreamId: null,
        modeSuccessCount: { dash: 0, compatible: 0 },
        modeFailureCount: { dash: 0, compatible: 0 },
      },
    );

    expect(ordered).toEqual(['hevc', 'avc', 'av1']);
  });

  it('真实 webOS 设备优先尝试 DASH，并在有兼容流时附加 fallback', () => {
    const result = buildPlaybackAttempts(
      playSource,
      'auto',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: false },
      },
    );

    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts.some((item) => item.mode === 'compatible')).toBe(true);
    expect(result.warning).toContain('若 DASH 在当前电视设备上无法稳定起播');
    expect(formatAttemptResolution(result.attempts[0]!)).toBe('1920 x 1080');
  });

  it('显式选择 HEVC 时，会优先生成 HEVC 分轨的首个尝试', () => {
    const result = buildPlaybackAttempts(
      playSource,
      'hevc',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: false },
      },
    );

    expect(result.effectivePreference).toBe('hevc');
    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[0]?.codec).toBe('hevc');
  });

  it('显式选择 AV1 且当前分轨可用时，会优先生成 AV1 分轨的首个尝试', () => {
    const result = buildPlaybackAttempts(
      {
        ...playSource,
        qualities: [{
          ...qualities[0],
          codecs: ['avc', 'hevc', 'av1'],
        }],
        videoStreams: videoStreamsWithAv1,
      },
      'av1',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: true },
      },
    );

    expect(result.effectivePreference).toBe('av1');
    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[0]?.codec).toBe('av1');
  });

  it('真实 webOS 设备会优先沿用上次成功的 DASH 音轨记忆', () => {
    const result = buildPlaybackAttempts(
      {
        ...playSource,
        audioStreams: audioStreamsWithVariants,
      },
      'auto',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: false },
      },
      {
        lastSuccessfulCodec: 'hevc',
        lastFailedCodec: null,
        lastSuccessfulMode: 'dash',
        lastFailedMode: null,
        lastSuccessfulQuality: 80,
        lastSuccessfulAudioStreamId: 202,
        modeSuccessCount: { dash: 1, compatible: 0 },
        modeFailureCount: { dash: 0, compatible: 0 },
      },
    );

    expect(result.attempts[0]?.audioStream?.id).toBe(202);
  });

  it('兼容流档位较低时，真实 webOS 设备仍优先保留 DASH 的实际返回档位', () => {
    const result = buildPlaybackAttempts(
      {
        ...playSource,
        compatibleQuality: 64,
        compatibleQualityLabel: '720P',
        compatibleSources: [{
          quality: 64,
          qualityLabel: '720P',
          format: 'mp4',
          url: 'https://upos-sz.bilivideo.com/video-compatible-720.mp4',
          candidateUrls: ['https://upos-sz.bilivideo.com/video-compatible-720.mp4'],
        }],
        candidateUrls: ['https://upos-sz.bilivideo.com/video-compatible-720.mp4'],
        qualityReason: '接口已返回 1080P DASH 分轨；兼容流最高仅 720P，仅在 DASH 失败时作为回退。',
      },
      'auto',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: false },
      },
    );

    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[0]?.quality).toBe(80);
    expect(result.attempts.some((item) => item.mode === 'compatible' && item.quality === 64)).toBe(true);
  });

  it('真实 webOS 在已拿到目标 DASH 档位时，会先试完 DASH 编码再回退兼容流', () => {
    const result = buildPlaybackAttempts(
      playSource,
      'auto',
      {
        deviceKey: 'unknown:unknown',
        deviceLabel: 'unknown',
        deviceClass: 'webos-6',
        support: { avc: true, hevc: true, av1: true },
      },
      {
        lastSuccessfulCodec: 'avc',
        lastFailedCodec: null,
        lastSuccessfulMode: 'compatible',
        lastFailedMode: null,
        lastSuccessfulQuality: 64,
        lastSuccessfulAudioStreamId: null,
        modeSuccessCount: { dash: 2, compatible: 8 },
        modeFailureCount: { dash: 8, compatible: 2 },
      },
    );

    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[1]?.mode).toBe('dash');
    expect(result.attempts[2]?.mode).toBe('compatible');
  });

  it('真实 webOS 在 DASH 失败后，会先尝试同档位兼容流，再降到更低档位 html5 兼容流', () => {
    const result = buildPlaybackAttempts(
      {
        ...playSource,
        compatibleSources: [
          {
            quality: 80,
            qualityLabel: '1080P',
            format: 'mp4',
            url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
            candidateUrls: [
              'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
              'https://upos-sz-mirror08c.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
            ],
          },
          {
            quality: 64,
            qualityLabel: '720P',
            format: 'mp4',
            url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
            candidateUrls: [
              'https://upos-sz-estghw.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
              'https://upos-sz-mirror08c.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
            ],
          },
        ],
      },
      'auto',
      {
        deviceKey: 'unknown:unknown',
        deviceLabel: 'unknown',
        deviceClass: 'webos-6',
        support: { avc: true, hevc: true, av1: true },
      },
      {
        lastSuccessfulCodec: 'avc',
        lastFailedCodec: null,
        lastSuccessfulMode: 'compatible',
        lastFailedMode: null,
        lastSuccessfulQuality: 64,
        lastSuccessfulAudioStreamId: null,
        modeSuccessCount: { dash: 2, compatible: 8 },
        modeFailureCount: { dash: 8, compatible: 0 },
      },
    );

    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[1]?.mode).toBe('dash');
    expect(result.attempts[2]?.mode).toBe('compatible');
    expect(result.attempts[2]?.quality).toBe(80);
    expect(result.attempts[3]?.quality).toBe(64);
  });

  it('真实 webOS 设备会优先尝试更稳定的 html5 兼容流，而不是只盯住更高但不稳定的 pc 兼容流', () => {
    const result = buildPlaybackAttempts(
      {
        ...playSource,
        mode: 'durl',
        videoStreams: [],
        audioStreams: [],
        returnedQuality: 80,
        returnedQualityLabel: '1080P',
        compatibleQuality: 80,
        compatibleQualityLabel: '1080P',
        compatibleSources: [
          {
            quality: 80,
            qualityLabel: '1080P',
            format: 'mp4',
            url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
            candidateUrls: [
              'https://upos-sz-estghw.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
              'https://upos-sz-mirror08c.bilivideo.com/video-compatible-1080.mp4?platform=pc&f=u_0_0',
            ],
          },
          {
            quality: 64,
            qualityLabel: '720P',
            format: 'mp4',
            url: 'https://upos-sz-estghw.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
            candidateUrls: [
              'https://upos-sz-estghw.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
              'https://upos-sz-mirror08c.bilivideo.com/video-compatible-720.mp4?platform=html5&f=T_0_0',
            ],
          },
        ],
        candidateUrls: [],
      },
      'auto',
      {
        deviceKey: 'oled55c1:6.0',
        deviceLabel: 'LG C1',
        deviceClass: 'webos-2021',
        support: { avc: true, hevc: true, av1: false },
      },
    );

    expect(result.attempts[0]?.mode).toBe('compatible');
    expect(result.attempts[0]?.quality).toBe(64);
    expect(result.attempts[0]?.source?.url).toContain('platform=html5');
    expect(result.attempts[1]?.quality).toBe(80);
    expect(result.attempts[1]?.source?.url).toContain('platform=pc');
  });

  it('带有 WebAppManager 的 UA 会被识别为 webos-simulator', () => {
    const originalUserAgent = navigator.userAgent;
    const originalPalmSystem = window.PalmSystem;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
    });
    Object.defineProperty(window, 'PalmSystem', {
      configurable: true,
      value: undefined,
    });

    try {
      const capability = buildPlayerCodecCapability(null);
      expect(capability.deviceClass).toBe('webos-simulator');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: originalUserAgent,
      });
      Object.defineProperty(window, 'PalmSystem', {
        configurable: true,
        value: originalPalmSystem,
      });
    }
  });

  it('真实 webOS 环境带有 PalmSystem 时，不会被误识别为 webos-simulator', () => {
    const originalUserAgent = navigator.userAgent;
    const originalPalmSystem = window.PalmSystem;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
    });
    Object.defineProperty(window, 'PalmSystem', {
      configurable: true,
      value: {},
    });

    try {
      const capability = buildPlayerCodecCapability(null);
      expect(capability.deviceClass).toBe('webos-6');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: originalUserAgent,
      });
      Object.defineProperty(window, 'PalmSystem', {
        configurable: true,
        value: originalPalmSystem,
      });
    }
  });

  it('模拟器与电视共用同一套播放优先级，DASH 可用时仍先尝试 DASH', () => {
    const result = buildPlaybackAttempts(
      playSource,
      'auto',
      {
        deviceKey: 'browser-dev:simulator',
        deviceLabel: 'Simulator',
        deviceClass: 'webos-simulator',
        support: { avc: true, hevc: false, av1: false },
      },
      {
        lastSuccessfulCodec: 'avc',
        lastFailedCodec: null,
        lastSuccessfulMode: 'compatible',
        lastFailedMode: null,
        lastSuccessfulQuality: 64,
        lastSuccessfulAudioStreamId: null,
        modeSuccessCount: { dash: 0, compatible: 8 },
        modeFailureCount: { dash: 2, compatible: 0 },
      },
    );

    expect(result.attempts[0]?.mode).toBe('dash');
    expect(result.attempts[0]?.quality).toBe(80);
    expect(result.attempts.some((item) => item.mode === 'compatible')).toBe(true);
    expect(result.warning).toContain('若 DASH 在当前电视设备上无法稳定起播');
  });
});
