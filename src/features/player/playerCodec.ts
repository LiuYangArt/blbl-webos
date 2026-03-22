import type {
  ParsedVideoCodec,
  PlayAudioStream,
  PlayCompatibleSource,
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
  mode: 'dash' | 'compatible';
  quality: number;
  qualityLabel: string;
  codec: ParsedVideoCodec;
  codecLabel: string;
  codecNote: string | null;
  isCompatible: boolean;
  width: number;
  height: number;
  candidates: PlaybackSourceCandidate[];
  source: PlayCompatibleSource | null;
  videoStream: PlayVideoStream | null;
  audioStream: PlayAudioStream | null;
};

export type PlaybackSourceCandidate = {
  id: string;
  videoUrl: string;
  audioUrl: string | null;
};

const AUTO_CODEC_PRIORITY: ParsedVideoCodec[] = ['avc', 'hevc', 'av1'];

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

export function getCodecLabel(codec: ParsedVideoCodec | VideoCodecPreference): string {
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

function canPlay(video: HTMLVideoElement, mimeType: string): boolean {
  const result = video.canPlayType(mimeType);
  return result === 'probably' || result === 'maybe';
}

export function buildPlayerCodecCapability(deviceInfo: Record<string, unknown> | null): PlayerCodecCapability {
  const modelName = String(deviceInfo?.modelName ?? deviceInfo?.model_name ?? 'unknown');
  const platformVersion = String(deviceInfo?.platformVersion ?? deviceInfo?.platform_version ?? deviceInfo?.sdkVersion ?? 'unknown');
  return {
    deviceKey: `${modelName}:${platformVersion}`,
    deviceLabel: modelName,
    deviceClass: resolveDeviceClass(modelName, platformVersion, readNavigatorUserAgent()),
    support: probePlayerCodecSupport(),
  };
}

function readNavigatorUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

function resolveDeviceClass(modelName: string, platformVersion: string, userAgent: string): string {
  const normalizedModel = modelName.toLowerCase();
  const normalizedUserAgent = userAgent.toLowerCase();

  if (normalizedModel.includes('browser-dev') && isWebOsSimulatorUserAgent(userAgent)) {
    return 'webos-simulator';
  }
  if (normalizedModel.includes('browser-dev')) {
    return 'browser-dev';
  }
  if (normalizedModel.includes('simulator')) {
    return 'webos-simulator';
  }
  if (normalizedModel.includes('c1') || /^oled\d{0,2}c1/u.test(normalizedModel)) {
    return 'webos-2021';
  }
  if (platformVersion.startsWith('6')) {
    return 'webos-6';
  }
  if (normalizedUserAgent.includes('web0s') && normalizedUserAgent.includes('smarttv')) {
    return 'webos-6';
  }
  return 'webos-generic';
}

function isWebOsSimulatorUserAgent(userAgent: string): boolean {
  const normalizedUserAgent = userAgent.toLowerCase();
  return normalizedUserAgent.includes('web0s') && normalizedUserAgent.includes('webappmanager');
}

export function getAutoCodecPriority(
  support: PlayerCodecSupport,
  memory?: PlayerCodecMemory,
): ParsedVideoCodec[] {
  return [...AUTO_CODEC_PRIORITY].sort((left, right) => {
    return getCodecPriorityScore(right, support, memory) - getCodecPriorityScore(left, support, memory);
  });
}

function getCodecPriorityScore(
  codec: ParsedVideoCodec,
  support: PlayerCodecSupport,
  memory?: PlayerCodecMemory,
): number {
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
  if (capability.deviceClass === 'webos-simulator') {
    const compatibleResolution = buildCompatibleAttempts(playSource, codecPreference, capability);
    if (compatibleResolution.attempts.length > 0) {
      const warningMessages = [
        'Simulator 当前优先使用兼容 MP4 线路；媒体请求会走本地代理补充必要请求头，避免 bilivideo 403。',
      ];
      if (compatibleResolution.warning) {
        warningMessages.push(compatibleResolution.warning);
      }
      return {
        attempts: compatibleResolution.attempts,
        effectivePreference: compatibleResolution.effectivePreference,
        warning: warningMessages.join(' '),
      };
    }
  }

  const dashResolution = buildDashAttempts(playSource, codecPreference, capability, memory);
  if (dashResolution.attempts.length > 0) {
    return dashResolution;
  }

  return buildCompatibleAttempts(playSource, codecPreference, capability);
}

function buildDashAttempts(
  playSource: PlaySource,
  codecPreference: VideoCodecPreference,
  capability: PlayerCodecCapability,
  memory?: PlayerCodecMemory,
): {
  attempts: PlaybackAttempt[];
  effectivePreference: VideoCodecPreference;
  warning: string | null;
} {
  const targetStreams = getResolvedDashStreams(playSource);
  const quality = targetStreams[0]?.quality ?? playSource.currentQuality;
  const qualityLabel = targetStreams[0]?.qualityLabel
    ?? playSource.qualities.find((item) => item.qn === quality)?.label
    ?? playSource.qualityLabel;

  const uniqueStreams = pickBestStreamPerCodec(targetStreams);
  if (uniqueStreams.length === 0) {
    return {
      attempts: [],
      effectivePreference: codecPreference,
      warning: null,
    };
  }

  const audioStream = pickPreferredAudioStream(playSource.audioStreams, capability);
  const preferredCodecs = codecPreference === 'auto'
    ? getAutoCodecPriority(capability.support, memory)
    : [codecPreference];
  const orderedStreams = orderStreamsByCodec(uniqueStreams, preferredCodecs);
  const exactStream = codecPreference === 'auto'
    ? null
    : orderedStreams.find((stream) => stream.codec === codecPreference);
  const warningMessages: string[] = [];
  if (quality !== playSource.requestedQuality) {
    warningMessages.push(`当前接口未返回 ${playSource.requestedQualityLabel} 的实际 DASH 分轨，本次按 ${qualityLabel} 分轨播放。`);
  }
  if (codecPreference !== 'auto' && !exactStream) {
    warningMessages.push(`当前分轨没有 ${getCodecLabel(codecPreference)} 编码，已切换到本次实际返回的可用编码。`);
  }
  const effectivePreference = exactStream ? codecPreference : 'auto';

  return {
    attempts: orderedStreams.map((stream) => ({
      id: `${stream.quality}:${stream.codec}:${stream.url}`,
      mode: 'dash',
      quality: stream.quality,
      qualityLabel,
      codec: stream.codec,
      codecLabel: getCodecLabel(stream.codec),
      codecNote: audioStream
        ? `使用 ${getCodecLabel(stream.codec)} 视频轨与 ${formatAudioCodecLabel(audioStream.codecs)} 音频轨生成 DASH 清单。`
        : '当前只拿到视频轨，播放器可能无法正常输出声音。',
      isCompatible: false,
      width: stream.width,
      height: stream.height,
      candidates: buildDashCandidates(stream, audioStream),
      source: null,
      videoStream: stream,
      audioStream,
    })),
    effectivePreference,
    warning: warningMessages.length > 0 ? warningMessages.join(' ') : null,
  };
}

function buildCompatibleAttempts(
  playSource: PlaySource,
  codecPreference: VideoCodecPreference,
  capability: PlayerCodecCapability,
): {
  attempts: PlaybackAttempt[];
  effectivePreference: VideoCodecPreference;
  warning: string | null;
} {
  const source = playSource.compatibleSources.find((item) => item.quality === playSource.currentQuality)
    ?? playSource.compatibleSources[0]
    ?? null;

  if (!source) {
    return {
      attempts: [],
      effectivePreference: codecPreference,
      warning: null,
    };
  }

  const effectivePreference = codecPreference === 'auto' || codecPreference === 'avc'
    ? codecPreference
    : 'avc';
  const warning = effectivePreference !== codecPreference
    ? `当前只有兼容流，无法强制 ${getCodecLabel(codecPreference)}，已按 AVC 兼容流处理。`
    : null;
  const codec = capability.support.avc ? 'avc' : 'unknown';

  return {
    attempts: [{
      id: `${source.quality}:${source.url}`,
      mode: 'compatible',
      quality: source.quality,
      qualityLabel: source.qualityLabel,
      codec,
      codecLabel: getCodecLabel(codec),
      codecNote: '当前内容未提供可直接用于 DASH 的轨道信息，回退为兼容流直连。',
      isCompatible: true,
      width: 0,
      height: 0,
      candidates: source.candidateUrls.map((url, index) => ({
        id: `compatible:${source.quality}:${index}`,
        videoUrl: url,
        audioUrl: null,
      })),
      source,
      videoStream: null,
      audioStream: null,
    }],
    effectivePreference,
    warning,
  };
}

function pickBestStreamPerCodec(streams: PlayVideoStream[]): PlayVideoStream[] {
  const byCodec = new Map<ParsedVideoCodec, PlayVideoStream>();
  const ordered = [...streams].sort((left, right) => {
    if (right.bandwidth !== left.bandwidth) {
      return right.bandwidth - left.bandwidth;
    }
    if (right.width !== left.width) {
      return right.width - left.width;
    }
    return right.height - left.height;
  });

  for (const stream of ordered) {
    if (!byCodec.has(stream.codec)) {
      byCodec.set(stream.codec, stream);
    }
  }

  return Array.from(byCodec.values());
}

function getResolvedDashStreams(playSource: PlaySource): PlayVideoStream[] {
  const streamsAtCurrentQuality = playSource.videoStreams.filter((stream) => stream.quality === playSource.currentQuality);
  if (streamsAtCurrentQuality.length > 0) {
    return streamsAtCurrentQuality;
  }

  const highestAvailableQuality = [...playSource.videoStreams]
    .map((stream) => stream.quality)
    .sort((left, right) => right - left)[0];

  if (!highestAvailableQuality) {
    return [];
  }

  return playSource.videoStreams.filter((stream) => stream.quality === highestAvailableQuality);
}
function buildDashCandidates(
  videoStream: PlayVideoStream,
  audioStream: PlayAudioStream | null,
): PlaybackSourceCandidate[] {
  const rankedVideoUrls = rankCandidateUrls([videoStream.url, ...videoStream.backupUrls]);
  if (!audioStream) {
    return rankedVideoUrls.map((candidate, index) => ({
      id: `dash-video:${videoStream.id}:${index}`,
      videoUrl: candidate.url,
      audioUrl: null,
    }));
  }

  const rankedAudioUrls = rankCandidateUrls([audioStream.url, ...audioStream.backupUrls]);
  const pairs: Array<PlaybackSourceCandidate & { score: number }> = [];

  for (const videoCandidate of rankedVideoUrls) {
    for (const audioCandidate of rankedAudioUrls) {
      pairs.push({
        id: `dash-pair:${videoStream.id}:${audioStream.id}:${videoCandidate.index}:${audioCandidate.index}`,
        videoUrl: videoCandidate.url,
        audioUrl: audioCandidate.url,
        score: videoCandidate.score + audioCandidate.score,
      });
    }
  }

  return pairs
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map(({ id, videoUrl, audioUrl }) => ({
      id,
      videoUrl,
      audioUrl,
    }));
}

function rankCandidateUrls(urls: string[]) {
  return urls
    .map((url, index) => ({
      url,
      index,
      score: getCandidateScore(url) - index,
    }))
    .sort((left, right) => right.score - left.score);
}

function getCandidateScore(url: string) {
  try {
    const host = new URL(url).host.toLowerCase();
    let score = 0;
    if (host.includes('.bilivideo.com') || host.includes('.bilivideo.cn')) {
      score += 20;
    }
    if (host.includes('upos-')) {
      score += 8;
    }
    if (host.startsWith('cn-')) {
      score += 6;
    }
    if (host.includes('mcdn')) {
      score -= 20;
    }
    if (host.includes(':8082')) {
      score -= 4;
    }
    return score;
  } catch {
    return 0;
  }
}

function orderStreamsByCodec(
  streams: PlayVideoStream[],
  preferredCodecs: ParsedVideoCodec[],
): PlayVideoStream[] {
  const ordered: PlayVideoStream[] = [];
  const seen = new Set<string>();

  for (const codec of preferredCodecs) {
    const stream = streams.find((item) => item.codec === codec);
    if (stream) {
      ordered.push(stream);
      seen.add(stream.url);
    }
  }

  for (const stream of streams) {
    if (!seen.has(stream.url)) {
      ordered.push(stream);
    }
  }

  return ordered;
}

function pickPreferredAudioStream(
  audioStreams: PlayAudioStream[],
  capability: PlayerCodecCapability,
): PlayAudioStream | null {
  if (audioStreams.length === 0) {
    return null;
  }

  const preferred = [...audioStreams].sort((left, right) => {
    const rightScore = getAudioStreamScore(right, capability.deviceClass);
    const leftScore = getAudioStreamScore(left, capability.deviceClass);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const rightHostScore = getMediaHostPreferenceScore(right.url);
    const leftHostScore = getMediaHostPreferenceScore(left.url);
    if (rightHostScore !== leftHostScore) {
      return rightHostScore - leftHostScore;
    }

    if (shouldPreferStableAudioForDevice(capability.deviceClass)) {
      return left.bandwidth - right.bandwidth;
    }

    return right.bandwidth - left.bandwidth;
  });

  return preferred[0] ?? null;
}

function getAudioStreamScore(stream: PlayAudioStream, deviceClass: string): number {
  const codecs = stream.codecs.toLowerCase();
  if (codecs.includes('mp4a')) {
    return shouldPreferStableAudioForDevice(deviceClass) ? 5 : 3;
  }
  if (codecs.includes('ec-3') || codecs.includes('eac3')) {
    return 2;
  }
  if (codecs.includes('flac')) {
    return 1;
  }
  return 0;
}

function shouldPreferStableAudioForDevice(deviceClass: string) {
  return deviceClass === 'webos-6' || deviceClass === 'webos-2021' || deviceClass === 'webos-generic';
}

function getMediaHostPreferenceScore(url: string) {
  try {
    const host = new URL(url).host.toLowerCase();
    let score = 0;
    if (host.includes('.bilivideo.com') || host.includes('.bilivideo.cn')) {
      score += 20;
    }
    if (host.includes('upos-')) {
      score += 8;
    }
    if (host.includes('mcdn')) {
      score -= 30;
    }
    if (host.includes(':8082')) {
      score -= 10;
    }
    return score;
  } catch {
    return 0;
  }
}

function formatAudioCodecLabel(codecs: string): string {
  const normalized = codecs.toLowerCase();
  if (normalized.includes('mp4a')) {
    return 'AAC';
  }
  if (normalized.includes('ec-3') || normalized.includes('eac3')) {
    return 'E-AC3';
  }
  if (normalized.includes('flac')) {
    return 'FLAC';
  }
  return codecs || '未知音频';
}

export function getAvailableCodecsForQuality(playSource: PlaySource, quality: number): ParsedVideoCodec[] {
  const qualityMeta = playSource.qualities.find((item) => item.qn === quality);
  if (qualityMeta?.codecs.length) {
    return qualityMeta.codecs;
  }

  return Array.from(new Set(
    playSource.videoStreams
      .filter((stream) => stream.quality === quality)
      .map((stream) => stream.codec)
      .filter((codec) => codec !== 'unknown'),
  ));
}

export function getReturnedCodecsForQuality(playSource: PlaySource, quality: number): ParsedVideoCodec[] {
  return Array.from(new Set(
    playSource.videoStreams
      .filter((stream) => stream.quality === quality)
      .map((stream) => stream.codec)
      .filter((codec) => codec !== 'unknown'),
  ));
}

export function formatAttemptResolution(attempt: PlaybackAttempt): string {
  if (!attempt.width || !attempt.height) {
    return '分辨率待确认';
  }
  return `${attempt.width} x ${attempt.height}`;
}
