import { readJsonStorage, writeJsonStorage } from '../storage/local';

export type RelaySettings = {
  enabled: boolean;
  host: string;
  port: number;
  accessToken: string;
  healthTimeoutMs: number;
  requestTimeoutMs: number;
};

export type RelayAuthMaterial = {
  loginUrl: string;
  refreshToken: string;
  completedAt: number;
  mid: number;
  uname: string;
  vip: boolean;
  capturedAt: number;
  csrfToken?: string;
};

const STORAGE_KEYS = {
  settings: 'bilibili_webos.relay_settings',
  authMaterial: 'bilibili_webos.relay_auth_material',
} as const;

const DEFAULT_SETTINGS: RelaySettings = {
  enabled: true,
  host: '',
  port: 19091,
  accessToken: '',
  healthTimeoutMs: 1800,
  requestTimeoutMs: 7000,
};

export function readRelaySettings(): RelaySettings {
  return normalizeRelaySettings(readJsonStorage<StoredRelaySettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
}

export function writeRelaySettings(next: Partial<RelaySettings>): RelaySettings {
  const merged = normalizeRelaySettings({
    ...readRelaySettings(),
    ...next,
  });
  writeJsonStorage(STORAGE_KEYS.settings, merged);
  return merged;
}

export function readRelayAuthMaterial(): RelayAuthMaterial | null {
  const stored = readJsonStorage<Partial<RelayAuthMaterial> | null>(STORAGE_KEYS.authMaterial, null);
  if (!stored) {
    return null;
  }

  const loginUrl = typeof stored.loginUrl === 'string' ? stored.loginUrl.trim() : '';
  const mid = Number(stored.mid ?? 0);
  if (!loginUrl || mid <= 0) {
    return null;
  }

  return {
    loginUrl,
    refreshToken: typeof stored.refreshToken === 'string' ? stored.refreshToken : '',
    completedAt: Number(stored.completedAt ?? 0) || Date.now(),
    mid,
    uname: typeof stored.uname === 'string' ? stored.uname : '',
    vip: Boolean(stored.vip),
    capturedAt: Number(stored.capturedAt ?? 0) || Date.now(),
    csrfToken: resolveStoredCsrfToken(stored) || undefined,
  };
}

export function writeRelayAuthMaterial(material: RelayAuthMaterial) {
  const csrfToken = material.csrfToken?.trim() || extractLoginUrlCookies(material.loginUrl).bili_jct || '';
  writeJsonStorage(STORAGE_KEYS.authMaterial, {
    ...material,
    loginUrl: material.loginUrl.trim(),
    refreshToken: material.refreshToken.trim(),
    ...(csrfToken ? { csrfToken } : {}),
  });
}

export function clearRelayAuthMaterial() {
  writeJsonStorage<RelayAuthMaterial | null>(STORAGE_KEYS.authMaterial, null);
}

export function hasRelayConfiguration(settings: RelaySettings) {
  return Boolean(settings.host);
}

export function getRelayBaseUrl(settings: RelaySettings) {
  if (!hasRelayConfiguration(settings)) {
    return '';
  }

  return `http://${settings.host}:${settings.port}`;
}

type StoredRelaySettings = Partial<RelaySettings> & {
  baseUrl?: unknown;
};

function normalizeRelaySettings(input: StoredRelaySettings): RelaySettings {
  const endpoint = resolveRelayEndpoint(input);

  return {
    enabled: true,
    host: endpoint.host,
    port: endpoint.port,
    accessToken: typeof input.accessToken === 'string' ? input.accessToken.trim() : '',
    healthTimeoutMs: clampNumber(input.healthTimeoutMs, 500, 10000, DEFAULT_SETTINGS.healthTimeoutMs),
    requestTimeoutMs: clampNumber(input.requestTimeoutMs, 1000, 20000, DEFAULT_SETTINGS.requestTimeoutMs),
  };
}

function resolveRelayEndpoint(input: StoredRelaySettings) {
  const directHost = normalizeRelayHostInput(input.host);
  if (directHost) {
    const hasExplicitPort = input.port !== undefined && input.port !== null && String(input.port).trim() !== '';
    return {
      host: directHost,
      port: hasExplicitPort ? clampPort(input.port) : DEFAULT_SETTINGS.port,
    };
  }

  return parseLegacyRelayBaseUrl(input.baseUrl);
}

function parseLegacyRelayBaseUrl(value: unknown) {
  return parseEndpointValue(value);
}

function parseEndpointValue(value: unknown) {
  if (typeof value !== 'string') {
    return {
      host: '',
      port: DEFAULT_SETTINGS.port,
    };
  }

  const normalized = value.trim().replace(/\/+$/, '');
  if (!normalized) {
    return {
      host: '',
      port: DEFAULT_SETTINGS.port,
    };
  }

  const candidates = normalized.includes('://')
    ? [normalized]
    : [`http://${normalized}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const host = normalizeRelayHost(parsed.hostname);
      if (!host) {
        continue;
      }
      return {
        host,
        port: clampPort(parsed.port),
      };
    } catch {
      continue;
    }
  }

  return {
    host: '',
    port: DEFAULT_SETTINGS.port,
  };
}

function normalizeRelayHost(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim();
}

function normalizeRelayHostInput(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .trim();
}

function clampPort(value: unknown) {
  return clampNumber(value, 1, 65535, DEFAULT_SETTINGS.port);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function resolveStoredCsrfToken(stored: Partial<RelayAuthMaterial>) {
  if (typeof stored.csrfToken === 'string' && stored.csrfToken.trim()) {
    return stored.csrfToken.trim();
  }

  const loginUrl = typeof stored.loginUrl === 'string' ? stored.loginUrl : '';
  return extractLoginUrlCookies(loginUrl).bili_jct || '';
}

export function extractLoginUrlCookies(loginUrl: string) {
  const trimmed = loginUrl.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = new URL(trimmed);
    const params = parsed.searchParams;
    const cookies: Record<string, string> = {};
    for (const name of ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'buvid3', 'buvid4']) {
      const value = params.get(name)?.trim();
      if (value) {
        cookies[name] = value;
      }
    }
    return cookies;
  } catch {
    return {};
  }
}
