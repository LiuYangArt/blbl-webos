export type PlayerTransportMode = 'direct' | 'dev-proxy' | 'external-proxy';

export type ResolvedPlayerTransport = {
  url: string;
  mode: PlayerTransportMode;
  label: string;
};

const DEV_MEDIA_PREFIX = '/__bili_media/';
const EXTERNAL_MEDIA_PROXY_BASE = normalizeProxyBase(import.meta.env.VITE_BILI_MEDIA_PROXY_BASE);

function normalizeProxyBase(value: string | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

function buildExternalProxyUrl(proxyBase: string, rawUrl: string) {
  const encodedUrl = encodeURIComponent(rawUrl);
  if (proxyBase.includes('{url}')) {
    return proxyBase.replace('{url}', encodedUrl);
  }
  if (/[?&=]$/.test(proxyBase)) {
    return `${proxyBase}${encodedUrl}`;
  }
  return `${proxyBase.replace(/\/+$/u, '')}/${encodedUrl}`;
}

export function resolvePlayerTransport(rawUrl: string): ResolvedPlayerTransport {
  if (!rawUrl) {
    return {
      url: '',
      mode: 'direct',
      label: '媒体直连',
    };
  }

  if (import.meta.env.DEV) {
    return {
      url: `${DEV_MEDIA_PREFIX}${encodeURIComponent(rawUrl)}`,
      mode: 'dev-proxy',
      label: '开发态媒体代理',
    };
  }

  if (EXTERNAL_MEDIA_PROXY_BASE) {
    return {
      url: buildExternalProxyUrl(EXTERNAL_MEDIA_PROXY_BASE, rawUrl),
      mode: 'external-proxy',
      label: '外部媒体代理',
    };
  }

  return {
    url: rawUrl,
    mode: 'direct',
    label: '媒体直连',
  };
}

export function getPlayerTransportHint(mode: PlayerTransportMode, isWebOS: boolean) {
  if (!isWebOS || mode !== 'direct') {
    return null;
  }
  return '当前仍是媒体直连。参考 youtube-webos 的经验，真正稳定可播通常依赖更底层的播放器执行层；如果电视继续报 Format error，需要改走媒体代理或原生播放器。';
}
