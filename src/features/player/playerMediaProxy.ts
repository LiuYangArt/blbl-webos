import { readMediaProxyOrigin } from '../../app/launchParams';
import { getRelayBaseUrl, hasRelayConfiguration, readRelaySettings } from '../../services/relay/settings';
import type { PlaybackSourceCandidate } from './playerCodec';

const DEFAULT_SIMULATOR_MEDIA_PROXY_ORIGIN = 'http://127.0.0.1:19033';

type ResolvePlayerMediaProxyOriginOptions = {
  preferRelayProxy?: boolean;
};

type ResolvePlaybackCandidateUrlsOptions = ResolvePlayerMediaProxyOriginOptions;

export function resolvePlayerMediaProxyOrigin(
  deviceClass: string,
  options: ResolvePlayerMediaProxyOriginOptions = {},
): string | null {
  const explicitOrigin = readMediaProxyOrigin();
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const relayOrigin = readRelayMediaProxyOrigin(options.preferRelayProxy === true);
  if (relayOrigin) {
    return relayOrigin;
  }

  if (deviceClass !== 'webos-simulator') {
    return null;
  }

  return DEFAULT_SIMULATOR_MEDIA_PROXY_ORIGIN;
}

export function resolvePlaybackCandidateUrls(
  candidate: PlaybackSourceCandidate | null,
  deviceClass: string | undefined,
  options: ResolvePlaybackCandidateUrlsOptions = {},
): PlaybackSourceCandidate | null {
  if (!candidate) {
    return null;
  }

  const mediaProxyOrigin = resolvePlayerMediaProxyOrigin(deviceClass ?? '', options);
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

function readRelayMediaProxyOrigin(preferRelayProxy: boolean): string | null {
  if (!preferRelayProxy) {
    return null;
  }

  const relaySettings = readRelaySettings();
  if (!relaySettings.enabled || !hasRelayConfiguration(relaySettings)) {
    return null;
  }

  return getRelayBaseUrl(relaySettings);
}
