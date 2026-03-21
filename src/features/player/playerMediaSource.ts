import type { PlayerCodecCapability } from './playerCodec';

export type PlayerResolvedMediaSource = {
  mediaUrl: string;
  mimeType: string;
  sourceType: string;
  transportLabel: string;
  sourceTypeLabel: string;
  useMediaOption: boolean;
};

type ResolvePlayerMediaSourceOptions = {
  mediaUrl: string;
  format?: string;
  resumeSeconds: number;
  capability: PlayerCodecCapability | null;
  isWebOS: boolean;
};

export function resolvePlayerMediaSource(options: ResolvePlayerMediaSourceOptions): PlayerResolvedMediaSource {
  const mimeType = resolveMimeType(options.format, options.mediaUrl);
  const useMediaOption = shouldUseMediaOption(options);
  const mediaOption = useMediaOption ? buildMediaOption(options.resumeSeconds) : null;
  const sourceType = mediaOption ? `${mimeType};mediaOption=${mediaOption}` : mimeType;

  return {
    mediaUrl: options.mediaUrl,
    mimeType,
    sourceType,
    transportLabel: getTransportLabel(mimeType),
    sourceTypeLabel: mediaOption ? 'source[type + mediaOption]' : 'source[type]',
    useMediaOption,
  };
}

function resolveMimeType(format: string | undefined, mediaUrl: string): string {
  const normalizedFormat = String(format ?? '').trim().toLowerCase();
  const normalizedUrl = mediaUrl.toLowerCase();

  if (normalizedFormat.includes('m3u8') || normalizedFormat.includes('hls') || normalizedUrl.includes('.m3u8')) {
    return 'application/vnd.apple.mpegurl';
  }

  return 'video/mp4';
}

function shouldUseMediaOption(options: ResolvePlayerMediaSourceOptions): boolean {
  if (!options.isWebOS || !options.capability || options.resumeSeconds <= 0) {
    return false;
  }

  const label = options.capability.deviceLabel.toLowerCase();
  return !label.includes('simulator') && options.capability.deviceClass !== 'browser-dev';
}

function buildMediaOption(resumeSeconds: number): string {
  const option = {
    option: {
      mediaFormat: {
        type: 'video',
      },
      transmission: {
        playTime: {
          start: resumeSeconds * 1000,
        },
      },
    },
  };

  return encodeURIComponent(JSON.stringify(option));
}

function getTransportLabel(mimeType: string): string {
  if (mimeType === 'application/vnd.apple.mpegurl') {
    return 'HLS';
  }
  return 'MP4';
}

export function applyPlayerMediaSource(video: HTMLVideoElement, source: PlayerResolvedMediaSource): void {
  video.pause();
  video.removeAttribute('src');

  while (video.firstChild) {
    video.removeChild(video.firstChild);
  }

  const mediaNode = document.createElement('source');
  mediaNode.setAttribute('src', source.mediaUrl);
  mediaNode.setAttribute('type', source.sourceType);
  video.appendChild(mediaNode);
  video.load();
}
