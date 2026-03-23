import { describe, expect, it } from 'vitest';
import {
  readPlayerCodecMemory,
  readPlayerSettings,
  recordPlayerAttemptFailure,
  recordPlayerAttemptSuccess,
  writePlayerCodecPreference,
  writePlayerQualityPreference,
  writePlayerSubtitleEnabled,
  writePlayerSubtitleStyle,
} from './playerSettings';

describe('playerSettings', () => {
  it('默认返回自动编码和 1080P 画质偏好', () => {
    expect(readPlayerSettings()).toEqual({
      codecPreference: 'auto',
      qualityPreference: 80,
      subtitleEnabled: true,
      subtitleStyle: {
        fontSize: 'standard',
        bottomOffset: 'medium',
        backgroundOpacity: 'medium',
      },
    });
  });

  it('可以分别更新编码与清晰度偏好', () => {
    writePlayerCodecPreference('hevc');
    writePlayerQualityPreference(64);

    expect(readPlayerSettings()).toEqual({
      codecPreference: 'hevc',
      qualityPreference: 64,
      subtitleEnabled: true,
      subtitleStyle: {
        fontSize: 'standard',
        bottomOffset: 'medium',
        backgroundOpacity: 'medium',
      },
    });
  });

  it('可以持久化字幕开关与基础样式设置', () => {
    writePlayerSubtitleEnabled(false);
    writePlayerSubtitleStyle({
      fontSize: 'extra-large',
      backgroundOpacity: 'strong',
    });

    expect(readPlayerSettings()).toEqual({
      codecPreference: 'auto',
      qualityPreference: 80,
      subtitleEnabled: false,
      subtitleStyle: {
        fontSize: 'extra-large',
        bottomOffset: 'medium',
        backgroundOpacity: 'strong',
      },
    });
  });

  it('能兼容旧版本缺少 subtitle 字段的本地配置', () => {
    window.localStorage.setItem('bilibili_webos.player_settings', JSON.stringify({
      codecPreference: 'avc',
      qualityPreference: 112,
    }));

    expect(readPlayerSettings()).toEqual({
      codecPreference: 'avc',
      qualityPreference: 112,
      subtitleEnabled: true,
      subtitleStyle: {
        fontSize: 'standard',
        bottomOffset: 'medium',
        backgroundOpacity: 'medium',
      },
    });
  });

  it('能兼容部分或非法 subtitleStyle 字段并回退到默认值', () => {
    window.localStorage.setItem('bilibili_webos.player_settings', JSON.stringify({
      codecPreference: 'unknown',
      qualityPreference: 'invalid',
      subtitleEnabled: true,
      subtitleStyle: {
        fontSize: 'super-large',
        bottomOffset: 'low',
        backgroundOpacity: 'opaque',
      },
    }));

    expect(readPlayerSettings()).toEqual({
      codecPreference: 'auto',
      qualityPreference: 80,
      subtitleEnabled: true,
      subtitleStyle: {
        fontSize: 'standard',
        bottomOffset: 'low',
        backgroundOpacity: 'medium',
      },
    });
  });

  it('成功记录会累计成功次数并回落同模式失败计数', () => {
    recordPlayerAttemptFailure('tv-1', {
      codec: 'avc',
      mode: 'dash',
    });
    recordPlayerAttemptFailure('tv-1', {
      codec: 'avc',
      mode: 'dash',
    });

    recordPlayerAttemptSuccess('tv-1', {
      codec: 'hevc',
      mode: 'dash',
      quality: 80,
      audioStreamId: 201,
    });

    expect(readPlayerCodecMemory('tv-1')).toMatchObject({
      lastSuccessfulCodec: 'hevc',
      lastFailedCodec: null,
      lastSuccessfulMode: 'dash',
      lastFailedMode: null,
      lastSuccessfulQuality: 80,
      lastSuccessfulAudioStreamId: 201,
      modeSuccessCount: {
        dash: 1,
      },
      modeFailureCount: {
        dash: 1,
      },
    });
  });

  it('模式记忆次数会被限制在上限内', () => {
    for (let index = 0; index < 12; index += 1) {
      recordPlayerAttemptSuccess('tv-2', {
        codec: 'avc',
        mode: 'compatible',
        quality: 64,
        audioStreamId: null,
      });
    }

    for (let index = 0; index < 10; index += 1) {
      recordPlayerAttemptFailure('tv-2', {
        codec: 'hevc',
        mode: 'compatible',
      });
    }

    expect(readPlayerCodecMemory('tv-2')).toMatchObject({
      modeSuccessCount: {
        compatible: 8,
      },
      modeFailureCount: {
        compatible: 8,
      },
    });
  });
});
