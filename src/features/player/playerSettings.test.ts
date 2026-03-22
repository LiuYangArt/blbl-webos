import { describe, expect, it } from 'vitest';
import {
  readPlayerCodecMemory,
  readPlayerSettings,
  recordPlayerAttemptFailure,
  recordPlayerAttemptSuccess,
  writePlayerCodecPreference,
  writePlayerQualityPreference,
} from './playerSettings';

describe('playerSettings', () => {
  it('默认返回自动编码和 1080P 画质偏好', () => {
    expect(readPlayerSettings()).toEqual({
      codecPreference: 'auto',
      qualityPreference: 80,
    });
  });

  it('可以分别更新编码与清晰度偏好', () => {
    writePlayerCodecPreference('hevc');
    writePlayerQualityPreference(64);

    expect(readPlayerSettings()).toEqual({
      codecPreference: 'hevc',
      qualityPreference: 64,
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
