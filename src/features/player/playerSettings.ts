import type { ParsedVideoCodec, VideoCodecPreference } from '../../services/api/types';
import { readJsonStorage, writeJsonStorage } from '../../services/storage/local';

type PlayerPlaybackMode = 'dash' | 'compatible';

type StoredPlayerSettings = {
  codecPreference: VideoCodecPreference;
  qualityPreference: number;
};

type StoredCodecMemoryEntry = {
  lastSuccessfulCodec: ParsedVideoCodec | null;
  lastFailedCodec: ParsedVideoCodec | null;
  lastSuccessfulMode: PlayerPlaybackMode | null;
  lastFailedMode: PlayerPlaybackMode | null;
  lastSuccessfulQuality: number | null;
  lastSuccessfulAudioStreamId: number | null;
  modeSuccessCount: Record<PlayerPlaybackMode, number>;
  modeFailureCount: Record<PlayerPlaybackMode, number>;
};

type StoredCodecMemory = Record<string, StoredCodecMemoryEntry>;
type CodecMemoryUpdate = {
  lastSuccessfulCodec?: ParsedVideoCodec | null;
  lastFailedCodec?: ParsedVideoCodec | null;
  lastSuccessfulMode?: PlayerPlaybackMode | null;
  lastFailedMode?: PlayerPlaybackMode | null;
  lastSuccessfulQuality?: number | null;
  lastSuccessfulAudioStreamId?: number | null;
  modeSuccessCount?: Partial<Record<PlayerPlaybackMode, number>>;
  modeFailureCount?: Partial<Record<PlayerPlaybackMode, number>>;
};

const STORAGE_KEYS = {
  settings: 'bilibili_webos.player_settings',
  codecMemory: 'bilibili_webos.player_codec_memory',
} as const;

const DEFAULT_SETTINGS: StoredPlayerSettings = {
  codecPreference: 'auto',
  qualityPreference: 80,
};

const DEFAULT_CODEC_MEMORY_ENTRY: StoredCodecMemoryEntry = {
  lastSuccessfulCodec: null,
  lastFailedCodec: null,
  lastSuccessfulMode: null,
  lastFailedMode: null,
  lastSuccessfulQuality: null,
  lastSuccessfulAudioStreamId: null,
  modeSuccessCount: {
    dash: 0,
    compatible: 0,
  },
  modeFailureCount: {
    dash: 0,
    compatible: 0,
  },
};

const MAX_MODE_MEMORY_COUNT = 8;

export function readPlayerSettings() {
  return readJsonStorage<StoredPlayerSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}

export function writePlayerCodecPreference(codecPreference: VideoCodecPreference) {
  writeJsonStorage(STORAGE_KEYS.settings, {
    ...readPlayerSettings(),
    codecPreference,
  });
}

export function writePlayerQualityPreference(qualityPreference: number) {
  writeJsonStorage(STORAGE_KEYS.settings, {
    ...readPlayerSettings(),
    qualityPreference,
  });
}

export function readPlayerCodecMemory(deviceKey: string) {
  const allMemory = readJsonStorage<StoredCodecMemory>(STORAGE_KEYS.codecMemory, {});
  return mergeCodecMemoryEntry(allMemory[deviceKey]);
}

export function createDefaultPlayerCodecMemory(): StoredCodecMemoryEntry {
  return mergeCodecMemoryEntry();
}

export function writePlayerCodecResult(deviceKey: string, result: CodecMemoryUpdate) {
  const allMemory = readJsonStorage<StoredCodecMemory>(STORAGE_KEYS.codecMemory, {});
  const current = readPlayerCodecMemory(deviceKey);
  writeJsonStorage(STORAGE_KEYS.codecMemory, {
    ...allMemory,
    [deviceKey]: mergeCodecMemoryEntry(current, result),
  });
}

export function recordPlayerAttemptSuccess(deviceKey: string, result: {
  codec: ParsedVideoCodec;
  mode: PlayerPlaybackMode;
  quality: number;
  audioStreamId: number | null;
}) {
  const current = readPlayerCodecMemory(deviceKey);
  const nextSuccessCount = current.modeSuccessCount[result.mode] + 1;
  const nextFailureCount = Math.max(0, current.modeFailureCount[result.mode] - 1);
  writePlayerCodecResult(deviceKey, {
    lastSuccessfulCodec: result.codec,
    lastFailedCodec: null,
    lastSuccessfulMode: result.mode,
    lastFailedMode: null,
    lastSuccessfulQuality: result.quality,
    lastSuccessfulAudioStreamId: result.audioStreamId,
    modeSuccessCount: {
      [result.mode]: clampModeMemoryCount(nextSuccessCount),
    },
    modeFailureCount: {
      [result.mode]: nextFailureCount,
    },
  });
}

export function recordPlayerAttemptFailure(deviceKey: string, result: {
  codec: ParsedVideoCodec;
  mode: PlayerPlaybackMode;
}) {
  const current = readPlayerCodecMemory(deviceKey);
  const nextFailureCount = current.modeFailureCount[result.mode] + 1;
  writePlayerCodecResult(deviceKey, {
    lastFailedCodec: result.codec,
    lastFailedMode: result.mode,
    modeFailureCount: {
      [result.mode]: clampModeMemoryCount(nextFailureCount),
    },
  });
}

function mergeCodecMemoryEntry(
  current?: Partial<StoredCodecMemoryEntry>,
  result?: CodecMemoryUpdate,
): StoredCodecMemoryEntry {
  return {
    ...DEFAULT_CODEC_MEMORY_ENTRY,
    ...current,
    ...result,
    modeSuccessCount: {
      ...DEFAULT_CODEC_MEMORY_ENTRY.modeSuccessCount,
      ...current?.modeSuccessCount,
      ...result?.modeSuccessCount,
    },
    modeFailureCount: {
      ...DEFAULT_CODEC_MEMORY_ENTRY.modeFailureCount,
      ...current?.modeFailureCount,
      ...result?.modeFailureCount,
    },
  };
}

function clampModeMemoryCount(value: number): number {
  return Math.min(value, MAX_MODE_MEMORY_COUNT);
}
