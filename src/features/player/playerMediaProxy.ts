import { readMediaProxyOrigin } from '../../app/launchParams';
import type { PlaybackSourceCandidate } from './playerCodec';

const DEFAULT_SIMULATOR_MEDIA_PROXY_ORIGIN = 'http://127.0.0.1:19033';

export function resolvePlayerMediaProxyOrigin(deviceClass: string): string | null {
  if (deviceClass !== 'webos-simulator') {
    return null;
  }

  return readMediaProxyOrigin() ?? DEFAULT_SIMULATOR_MEDIA_PROXY_ORIGIN;
}

export function resolvePlaybackCandidateUrls(
  candidate: PlaybackSourceCandidate | null,
  deviceClass: string | undefined,
): PlaybackSourceCandidate | null {
  if (!candidate) {
    return null;
  }

  const mediaProxyOrigin = resolvePlayerMediaProxyOrigin(deviceClass ?? '');
  if (!mediaProxyOrigin) {
    return candidate;
  }

  return {
    ...candidate,
    videoUrl: buildMediaProxyUrl(mediaProxyOrigin, candidate.videoUrl),
    audioUrl: candidate.audioUrl ? buildMediaProxyUrl(mediaProxyOrigin, candidate.audioUrl) : null,
  };
}

function buildMediaProxyUrl(mediaProxyOrigin: string, targetUrl: string) {
  const proxyUrl = new URL('/media', ensureTrailingSlash(mediaProxyOrigin));
  proxyUrl.searchParams.set('url', targetUrl);
  return proxyUrl.toString();
}

function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`;
}
