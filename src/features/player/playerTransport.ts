import { readMediaProxyBase } from '../../app/launchParams';

export type PlayerTransportMode = 'direct' | 'dev-proxy' | 'external-proxy' | 'external-play-source';

export type PlayerTransportRequest = {
  rawUrl: string;
  bvid: string;
  cid: number;
  quality?: number;
  candidateIndex?: number;
  format?: string;
};

export type ResolvedPlayerTransport = {
  url: string;
  mode: PlayerTransportMode;
  label: string;
};

const DEV_MEDIA_PREFIX = '/__bili_media/';
const EXTERNAL_MEDIA_PROXY_BASE = normalizeProxyBase(import.meta.env.VITE_BILI_MEDIA_PROXY_BASE);
const STRUCTURED_PROXY_TOKENS = ['{bvid}', '{cid}', '{quality}', '{candidateIndex}', '{format}'];

function normalizeProxyBase(value: string | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function buildExternalProxyUrl(proxyBase: string, rawUrl: string) {
  const encodedUrl = encodeURIComponent(rawUrl);
  if (proxyBase.includes('{url}')) {
    return replaceToken(proxyBase, '{url}', encodedUrl);
  }
  if (/[?&=]$/.test(proxyBase)) {
    return `${proxyBase}${encodedUrl}`;
  }
  return `${proxyBase.replace(/\/+$/u, '')}/${encodedUrl}`;
}

function replaceToken(template: string, token: string, value: string) {
  return template.split(token).join(value);
}

function buildStructuredProxyUrl(proxyBase: string, request: PlayerTransportRequest) {
  if (!STRUCTURED_PROXY_TOKENS.some((token) => proxyBase.includes(token))) {
    return null;
  }

  if (!request.bvid || !request.cid) {
    return null;
  }

  let resolved = proxyBase;
  resolved = replaceToken(resolved, '{bvid}', encodeURIComponent(request.bvid));
  resolved = replaceToken(resolved, '{cid}', encodeURIComponent(String(request.cid)));
  resolved = replaceToken(resolved, '{quality}', encodeURIComponent(String(request.quality ?? 80)));
  resolved = replaceToken(resolved, '{candidateIndex}', encodeURIComponent(String(request.candidateIndex ?? 0)));
  resolved = replaceToken(resolved, '{format}', encodeURIComponent(String(request.format ?? 'mp4')));
  resolved = replaceToken(resolved, '{url}', encodeURIComponent(request.rawUrl));
  return resolved;
}

export function resolvePlayerTransport(request: PlayerTransportRequest): ResolvedPlayerTransport {
  if (import.meta.env.DEV && request.rawUrl) {
    return {
      url: `${DEV_MEDIA_PREFIX}${encodeURIComponent(request.rawUrl)}`,
      mode: 'dev-proxy',
      label: '开发态媒体代理',
    };
  }

  const runtimeProxyBase = normalizeProxyBase(readMediaProxyBase() ?? undefined);
  const proxyBase = runtimeProxyBase ?? EXTERNAL_MEDIA_PROXY_BASE;

  if (proxyBase) {
    const structuredProxyUrl = buildStructuredProxyUrl(proxyBase, request);
    if (structuredProxyUrl) {
      return {
        url: structuredProxyUrl,
        mode: 'external-play-source',
        label: '外部媒体网关',
      };
    }

    if (request.rawUrl) {
      return {
        url: buildExternalProxyUrl(proxyBase, request.rawUrl),
        mode: 'external-proxy',
        label: '外部媒体代理',
      };
    }
  }

  if (!request.rawUrl) {
    return {
      url: '',
      mode: 'direct',
      label: '媒体直连',
    };
  }

  return {
    url: request.rawUrl,
    mode: 'direct',
    label: '媒体直连',
  };
}

export function getPlayerTransportHint(mode: PlayerTransportMode, isWebOS: boolean) {
  if (!isWebOS || mode !== 'direct') {
    return null;
  }
  return '当前仍是媒体直连。真正稳定可播通常需要把请求头、Range 和播放源整理放到外部媒体网关处理；如果电视继续报 Format error，就不要继续依赖源站直连。';
}
