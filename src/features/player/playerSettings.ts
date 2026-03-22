import type { ParsedVideoCodec, VideoCodecPreference } from '../../services/api/types';
import { readJsonStorage, writeJsonStorage } from '../../services/storage/local';

type StoredPlayerSettings = {
  codecPreference: VideoCodecPreference;
  qualityPreference: number;
};

type StoredCodecMemory = Record<string, {
  lastSuccessfulCodec: ParsedVideoCodec | null;
  lastFailedCodec: ParsedVideoCodec | null;
}>;

const STORAGE_KEYS = {
  settings: 'bilibili_webos.player_settings',
  codecMemory: 'bilibili_webos.player_codec_memory',
} as const;

const DEFAULT_SETTINGS: StoredPlayerSettings = {
  codecPreference: 'auto',
  qualityPreference: 80,
};

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
  return allMemory[deviceKey] ?? {
    lastSuccessfulCodec: null,
    lastFailedCodec: null,
  };
}

export function writePlayerCodecResult(deviceKey: string, result: {
  lastSuccessfulCodec?: ParsedVideoCodec | null;
  lastFailedCodec?: ParsedVideoCodec | null;
}) {
  const allMemory = readJsonStorage<StoredCodecMemory>(STORAGE_KEYS.codecMemory, {});
  const current = allMemory[deviceKey] ?? {
    lastSuccessfulCodec: null,
    lastFailedCodec: null,
  };
  writeJsonStorage(STORAGE_KEYS.codecMemory, {
    ...allMemory,
    [deviceKey]: {
      ...current,
      ...result,
    },
  });
}
