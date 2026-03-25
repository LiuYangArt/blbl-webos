import type { UserProfile } from '../api/types';
import type { RelayAuthMaterial, RelaySettings } from './settings';
import { getRelayBaseUrl, hasRelayConfiguration } from './settings';

export type RelayHealth = {
  ok: boolean;
  loggedIn: boolean;
};

export type RelayAuthStatus = {
  ok: boolean;
  loggedIn: boolean;
  mid: number | null;
  uname: string | null;
  vip: boolean;
  vipLabel: string | null;
  cookieExpired: boolean;
  lastSyncedAt: number | null;
};

export type RelayPlayurlMeta = {
  quality: number | null;
  format: string | null;
  host: string | null;
  platformHint: string | null;
  formatHint: string | null;
};

export type RelayPlayurlResponse<T> = {
  ok: true;
  code: number;
  message: string;
  data: T;
  relay: RelayPlayurlMeta;
};

export type RelayMutationResponse = {
  ok: true;
  code: number;
  message: string;
  data?: unknown;
};

export type RelayEnsureResult = {
  usable: boolean;
  healthOk: boolean | null;
  authState:
    | 'disabled'
    | 'not-configured'
    | 'not-logged-in'
    | 'offline'
    | 'synced'
    | 'auth-missing'
    | 'auth-expired'
    | 'auth-mismatch'
    | 'sync-material-missing'
    | 'sync-failed';
  relayMid: number | null;
  expectedMid: number | null;
  autoSyncTriggered: boolean;
  autoSyncReason: string | null;
  fallbackReason: string | null;
  message: string | null;
};

type RelayErrorPayload = {
  ok?: false;
  error?: string;
  message?: string;
};

export class RelayApiError extends Error {
  constructor(
    message: string,
    public readonly kind: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'RelayApiError';
  }
}

export async function pingRelay(settings: RelaySettings): Promise<RelayHealth> {
  const response = await requestRelay<RelayHealth>(settings, '/health', {
    timeoutMs: settings.healthTimeoutMs,
    authenticated: false,
  });
  return {
    ok: Boolean(response.ok),
    loggedIn: Boolean(response.loggedIn),
  };
}

export async function fetchRelayAuthStatus(settings: RelaySettings): Promise<RelayAuthStatus> {
  const response = await requestRelay<Partial<RelayAuthStatus>>(settings, '/api/auth/status', {
    timeoutMs: settings.requestTimeoutMs,
  });
  return {
    ok: Boolean(response.ok),
    loggedIn: Boolean(response.loggedIn),
    mid: normalizeNumber(response.mid),
    uname: typeof response.uname === 'string' ? response.uname : null,
    vip: Boolean(response.vip),
    vipLabel: typeof response.vipLabel === 'string' && response.vipLabel ? response.vipLabel : null,
    cookieExpired: Boolean(response.cookieExpired),
    lastSyncedAt: normalizeNumber(response.lastSyncedAt),
  };
}

export async function syncRelayAuth(settings: RelaySettings, material: RelayAuthMaterial, profile: UserProfile) {
  return requestRelay<RelayAuthStatus>(settings, '/api/auth/sync', {
    method: 'POST',
    timeoutMs: settings.requestTimeoutMs,
    body: JSON.stringify({
      loginUrl: material.loginUrl,
      refreshToken: material.refreshToken,
      completedAt: material.completedAt,
      expectedMid: profile.mid,
      expectedUname: profile.name,
      expectedVip: Boolean(profile.vipLabel),
    }),
  });
}

export async function logoutRelayAuth(settings: RelaySettings) {
  await requestRelay(settings, '/api/auth/logout', {
    method: 'POST',
    timeoutMs: settings.requestTimeoutMs,
  });
}

export async function fetchRelayPlayurl<T>(settings: RelaySettings, params: URLSearchParams): Promise<RelayPlayurlResponse<T>> {
  const response = await requestRelay<RelayPlayurlResponse<T>>(settings, `/api/playurl?${params.toString()}`, {
    timeoutMs: settings.requestTimeoutMs,
  });
  return {
    ...response,
    relay: {
      quality: normalizeNumber(response.relay?.quality),
      format: typeof response.relay?.format === 'string' ? response.relay.format : null,
      host: typeof response.relay?.host === 'string' ? response.relay.host : null,
      platformHint: typeof response.relay?.platformHint === 'string' ? response.relay.platformHint : null,
      formatHint: typeof response.relay?.formatHint === 'string' ? response.relay.formatHint : null,
    },
  };
}

export async function reportRelayHeartbeat(settings: RelaySettings, payload: {
  aid?: number;
  bvid: string;
  cid: number;
  playedTime: number;
}) {
  return requestRelay<RelayMutationResponse>(settings, '/api/history/heartbeat', {
    method: 'POST',
    timeoutMs: settings.requestTimeoutMs,
    body: JSON.stringify({
      aid: payload.aid,
      bvid: payload.bvid,
      cid: payload.cid,
      playedTime: payload.playedTime,
    }),
  });
}

export async function reportRelayHistoryProgress(settings: RelaySettings, payload: {
  aid: number;
  cid: number;
  progress: number;
}) {
  return requestRelay<RelayMutationResponse>(settings, '/api/history/report', {
    method: 'POST',
    timeoutMs: settings.requestTimeoutMs,
    body: JSON.stringify({
      aid: payload.aid,
      cid: payload.cid,
      progress: payload.progress,
    }),
  });
}

export async function ensureRelaySession(
  settings: RelaySettings,
  profile: UserProfile | null,
  material: RelayAuthMaterial | null,
  reason: string,
): Promise<RelayEnsureResult> {
  if (!settings.enabled) {
    return {
      usable: false,
      healthOk: null,
      authState: 'disabled',
      relayMid: null,
      expectedMid: profile?.mid ?? null,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: null,
      message: null,
    };
  }

  if (!hasRelayConfiguration(settings)) {
    return {
      usable: false,
      healthOk: null,
      authState: 'not-configured',
      relayMid: null,
      expectedMid: profile?.mid ?? null,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: 'relay not configured',
      message: '代理服务器地址还没有配置完整。',
    };
  }

  if (!profile) {
    return {
      usable: false,
      healthOk: null,
      authState: 'not-logged-in',
      relayMid: null,
      expectedMid: null,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: 'relay auth missing',
      message: '当前还是游客模式，relay 不会代替 TV 当前账号。',
    };
  }

  try {
    await pingRelay(settings);
  } catch (error) {
    return {
      usable: false,
      healthOk: false,
      authState: 'offline',
      relayMid: null,
      expectedMid: profile.mid,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: 'relay unavailable',
      message: formatRelayErrorMessage(error, '代理服务器离线'),
    };
  }

  let status: RelayAuthStatus;
  try {
    status = await fetchRelayAuthStatus(settings);
  } catch (error) {
    return {
      usable: false,
      healthOk: true,
      authState: 'offline',
      relayMid: null,
      expectedMid: profile.mid,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: 'relay unavailable',
      message: formatRelayErrorMessage(error, '读取 relay 账号状态失败'),
    };
  }

  if (status.loggedIn && !status.cookieExpired && status.mid === profile.mid) {
    return {
      usable: true,
      healthOk: true,
      authState: 'synced',
      relayMid: status.mid,
      expectedMid: profile.mid,
      autoSyncTriggered: false,
      autoSyncReason: null,
      fallbackReason: null,
      message: null,
    };
  }

  const nextAuthState = !status.loggedIn
    ? 'auth-missing'
    : status.cookieExpired
      ? 'auth-expired'
      : 'auth-mismatch';

  if (!material || material.mid !== profile.mid) {
    return {
      usable: false,
      healthOk: true,
      authState: 'sync-material-missing',
      relayMid: status.mid,
      expectedMid: profile.mid,
      autoSyncTriggered: false,
      autoSyncReason: reason,
      fallbackReason: 'relay sync material missing',
      message: '当前登录态没有可复用的 relay 同步材料，需要重新扫码一次。',
    };
  }

  try {
    const synced = await syncRelayAuth(settings, material, profile);
    if (synced.loggedIn && synced.mid === profile.mid && !synced.cookieExpired) {
      return {
        usable: true,
        healthOk: true,
        authState: 'synced',
        relayMid: synced.mid,
        expectedMid: profile.mid,
        autoSyncTriggered: true,
        autoSyncReason: reason,
        fallbackReason: null,
        message: null,
      };
    }

    return {
      usable: false,
      healthOk: true,
      authState: 'auth-mismatch',
      relayMid: synced.mid,
      expectedMid: profile.mid,
      autoSyncTriggered: true,
      autoSyncReason: reason,
      fallbackReason: 'relay auth mismatch',
      message: 'relay 返回的账号和 TV 当前账号不一致。',
    };
  } catch (error) {
    return {
      usable: false,
      healthOk: true,
      authState: nextAuthState === 'auth-mismatch' ? 'auth-mismatch' : 'sync-failed',
      relayMid: status.mid,
      expectedMid: profile.mid,
      autoSyncTriggered: true,
      autoSyncReason: reason,
      fallbackReason: mapRelayErrorToFallback(error),
      message: formatRelayErrorMessage(error, '同步 relay 登录态失败'),
    };
  }
}

async function requestRelay<T>(
  settings: RelaySettings,
  path: string,
  options: {
    method?: string;
    body?: string;
    timeoutMs: number;
    authenticated?: boolean;
  },
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs);
  const baseUrl = getRelayBaseUrl(settings);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      body: options.body,
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': options.body ? 'application/json' : 'text/plain;charset=UTF-8',
        ...(options.authenticated === false || !settings.accessToken ? {} : { 'X-Relay-Token': settings.accessToken }),
      },
    });

    const payload = await response.json() as T | RelayErrorPayload;
    if (!response.ok) {
      const errorPayload = payload as RelayErrorPayload;
      throw new RelayApiError(
        errorPayload.message || `relay 请求失败（${response.status}）`,
        errorPayload.error || classifyRelayStatusCode(response.status),
        response.status,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof RelayApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RelayApiError('relay 请求超时', 'timeout', 504);
    }
    throw new RelayApiError(
      error instanceof Error ? error.message : 'relay 请求失败',
      'request_failed',
      502,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function classifyRelayStatusCode(statusCode: number) {
  switch (statusCode) {
    case 401:
      return 'unauthorized';
    case 409:
      return 'auth_expired';
    default:
      return 'request_failed';
  }
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRelayErrorMessage(error: unknown, fallback: string) {
  if (error instanceof RelayApiError) {
    return `${fallback}：${error.message}`;
  }
  return fallback;
}

function mapRelayErrorToFallback(error: unknown) {
  if (!(error instanceof RelayApiError)) {
    return 'relay request failed';
  }
  switch (error.kind) {
    case 'auth_missing':
      return 'relay auth missing';
    case 'auth_expired':
      return 'relay auth expired';
    case 'auth_mismatch':
      return 'relay auth mismatch';
    case 'bad_payload':
      return 'relay bad payload';
    case 'timeout':
      return 'relay timeout';
    default:
      return 'relay request failed';
  }
}
