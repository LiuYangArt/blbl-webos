import type {
  ParsedVideoCodec,
  PlayCompatibleSource,
  PlayQualityOption,
  PlaySource,
  PlayVideoStream,
  VideoCodecPreference,
} from '../../services/api/types';

export type PlayerCodecSupport = Record<'avc' | 'hevc' | 'av1', boolean>;

export type PlayerCodecMemory = {
  lastSuccessfulCodec: ParsedVideoCodec | null;
  lastFailedCodec: ParsedVideoCodec | null;
};

export type PlayerCodecCapability = {
  deviceKey: string;
  deviceLabel: string;
  deviceClass: string;
  support: PlayerCodecSupport;
};

export type PlaybackAttempt = {
  id: string;
  quality: number;
  qualityLabel: string;
  source: PlayCompatibleSource;
  codec: ParsedVideoCodec;
  codecLabel: string;
  isCompatible: boolean;
  width: number;
  height: number;
};

const AUTO_CODEC_PRIORITY: ParsedVideoCodec[] = ['avc', 'hevc', 'av1'];
const QUALITY_FALLBACK_ORDER = [120, 116, 112, 80, 64, 32, 16];

export function parseVideoCodec(codecs: string): ParsedVideoCodec {
  const normalized = codecs.trim().toLowerCase();
  if (normalized.startsWith('avc')) {
    return 'avc';
  }
  if (normalized.startsWith('hev') || normalized.startsWith('hvc')) {
    return 'hevc';
  }
  if (normalized.startsWith('av01')) {
    return 'av1';
  }
  return 'unknown';
}

export function getCodecLabel(codec: ParsedVideoCodec | VideoCodecPreference) {
  switch (codec) {
    case 'auto':
      return '自动';
    case 'avc':
      return 'AVC';
    case 'hevc':
      return 'HEVC';
    case 'av1':
      return 'AV1';
    default:
      return '未知';
  }
}

export function probePlayerCodecSupport(): PlayerCodecSupport {
  const video = document.createElement('video');
  return {
    avc: canPlay(video, 'video/mp4; codecs="avc1.640028, mp4a.40.2"'),
    hevc: canPlay(video, 'video/mp4; codecs="hvc1.1.6.L120.B0, mp4a.40.2"'),
    av1: canPlay(video, 'video/mp4; codecs="av01.0.08M.08, mp4a.40.2"'),
  };
}

function canPlay(video: HTMLVideoElement, mimeType: string) {
  const result = video.canPlayType(mimeType);
  return result === 'probably' || result === 'maybe';
}

export function buildPlayerCodecCapability(deviceInfo: Record<string, unknown> | null): PlayerCodecCapability {
  const modelName = String(deviceInfo?.modelName ?? deviceInfo?.model_name ?? 'unknown');
  const platformVersion = String(deviceInfo?.platformVersion ?? deviceInfo?.platform_version ?? deviceInfo?.sdkVersion ?? 'unknown');
  return {
    deviceKey: `${modelName}:${platformVersion}`,
    deviceLabel: modelName,
    deviceClass: resolveDeviceClass(modelName, platformVersion),
    support: probePlayerCodecSupport(),
  };
}

function resolveDeviceClass(modelName: string, platformVersion: string) {
  const normalizedModel = modelName.toLowerCase();
  if (normalizedModel.includes('browser-dev')) {
    return 'browser-dev';
  }
  if (normalizedModel.includes('c1') || /^oled\d{0,2}c1/u.test(normalizedModel)) {
    return 'webos-2021';
  }
  if (platformVersion.startsWith('6')) {
    return 'webos-6';
  }
  return 'webos-generic';
}

export function getAutoCodecPriority(
  support: PlayerCodecSupport,
  memory?: PlayerCodecMemory,
): ParsedVideoCodec[] {
  return [...AUTO_CODEC_PRIORITY].sort((left, right) => {
    const leftScore = getCodecPriorityScore(left, support, memory);
    const rightScore = getCodecPriorityScore(right, support, memory);
    return rightScore - leftScore;
  });
}

function getCodecPriorityScore(
  codec: ParsedVideoCodec,
  support: PlayerCodecSupport,
  memory?: PlayerCodecMemory,
) {
  let score = 0;
  if (codec !== 'unknown') {
    score += support[codec] ? 4 : 0;
  }
  if (codec === 'avc') {
    score += 3;
  }
  if (codec === 'hevc') {
    score += 2;
  }
  if (codec === 'av1') {
    score += 1;
  }
  if (memory?.lastSuccessfulCodec === codec) {
    score += 2;
  }
  if (memory?.lastFailedCodec === codec) {
    score -= 4;
  }
  return score;
}

export function buildPlaybackAttempts(
  playSource: PlaySource,
  codecPreference: VideoCodecPreference,
  capability: PlayerCodecCapability,
  memory?: PlayerCodecMemory,
): {
  attempts: PlaybackAttempt[];
  effectivePreference: VideoCodecPreference;
  warning: string | null;
} {
  const qualityOrder = buildQualityFallbackOrder(playSource.qualities, playSource.currentQuality);
  const preferredCodecs = codecPreference === 'auto'
    ? getAutoCodecPriority(capability.support, memory)
    : [codecPreference];
  const qualityByQn = new Map(playSource.qualities.map((item) => [item.qn, item]));
  const streamIndex = indexVideoStreams(playSource.videoStreams);

  let warning: string | null = null;
  let effectivePreference = codecPreference;

  const attempts = qualityOrder
    .map((quality) => playSource.compatibleSources.find((item) => item.quality === quality))
    .filter((item): item is PlayCompatibleSource => Boolean(item))
    .map((source) => {
      const qualityMeta = qualityByQn.get(source.quality);
      const codec = pickCodecForQuality(qualityMeta, preferredCodecs, capability.support);
      const hasPreferredCodec = codecPreference !== 'auto' && Boolean(qualityMeta?.codecs.includes(codecPreference));
      if (!hasPreferredCodec && codecPreference !== 'auto' && !warning) {
        warning = `当前清晰度没有 ${getCodecLabel(codecPreference)} 编码，已自动切换到可用线路`;
        effectivePreference = 'auto';
      }
      const stream = pickVideoStream(streamIndex, source.quality, codec);
      return {
        id: `${source.quality}:${codec}:${source.url}`,
        quality: source.quality,
        qualityLabel: source.qualityLabel,
        source,
        codec,
        codecLabel: getCodecLabel(codec),
        isCompatible: true,
        width: stream?.width ?? 0,
        height: stream?.height ?? 0,
      };
    });

  return { attempts, effectivePreference, warning };
}

function buildQualityFallbackOrder(qualities: PlayQualityOption[], currentQuality: number) {
  const available = new Set(qualities.map((item) => item.qn));
  const preferred = QUALITY_FALLBACK_ORDER.filter((item) => item <= currentQuality && available.has(item));
  if (preferred.length > 0) {
    return preferred;
  }
  return [...available].sort((left, right) => right - left);
}

function pickCodecForQuality(
  quality: PlayQualityOption | undefined,
  preferredCodecs: ParsedVideoCodec[],
  support: PlayerCodecSupport,
) {
  const codecs = (quality?.codecs ?? []).filter((item) => item !== 'unknown');
  const orderedPreferred = preferredCodecs
    .filter((codec): codec is 'avc' | 'hevc' | 'av1' => codec !== 'unknown')
    .sort((left, right) => {
    return Number(support[right as keyof PlayerCodecSupport]) - Number(support[left as keyof PlayerCodecSupport]);
  });
  for (const codec of orderedPreferred) {
    if (codecs.includes(codec)) {
      return codec;
    }
  }
  return codecs[0] ?? 'unknown';
}

function indexVideoStreams(videoStreams: PlayVideoStream[]) {
  const index = new Map<number, Map<ParsedVideoCodec, PlayVideoStream>>();
  for (const stream of videoStreams) {
    const byCodec = index.get(stream.quality) ?? new Map<ParsedVideoCodec, PlayVideoStream>();
    byCodec.set(stream.codec, stream);
    index.set(stream.quality, byCodec);
  }
  return index;
}

function pickVideoStream(
  index: Map<number, Map<ParsedVideoCodec, PlayVideoStream>>,
  quality: number,
  codec: ParsedVideoCodec,
) {
  return index.get(quality)?.get(codec) ?? index.get(quality)?.values().next().value;
}

export function getAvailableCodecsForQuality(playSource: PlaySource, quality: number) {
  const qualityMeta = playSource.qualities.find((item) => item.qn === quality);
  return qualityMeta?.codecs ?? [];
}

export function formatAttemptResolution(attempt: PlaybackAttempt) {
  if (!attempt.width || !attempt.height) {
    return '分辨率待确认';
  }
  return `${attempt.width} x ${attempt.height}`;
}
