import type { AppRoute } from './routes';

export type AppLaunchParams = {
  route?: string;
  bvid?: string;
  cid?: number | string;
  title?: string;
  part?: string;
  debugFocus?: boolean | string | number;
  debugTelemetryUrl?: string;
  mediaProxyOrigin?: string;
};

let cachedLaunchParams: AppLaunchParams | null | undefined;

function readRawLaunchParams(): unknown {
  return window.launchParams ?? window.PalmSystem?.launchParams ?? null;
}

function normalizeString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on';
}

export function readLaunchParams(): AppLaunchParams | null {
  if (cachedLaunchParams !== undefined) {
    return cachedLaunchParams;
  }

  const raw = readRawLaunchParams();
  if (!raw) {
    cachedLaunchParams = null;
    return cachedLaunchParams;
  }

  if (typeof raw === 'object') {
    cachedLaunchParams = raw as AppLaunchParams;
    return cachedLaunchParams;
  }

  if (typeof raw !== 'string') {
    cachedLaunchParams = null;
    return cachedLaunchParams;
  }

  try {
    const parsed = JSON.parse(raw) as AppLaunchParams;
    cachedLaunchParams = parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    cachedLaunchParams = null;
  }

  return cachedLaunchParams;
}

export function resolveInitialRoute(): AppRoute {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const launchParams = readLaunchParams();
  const uiDebugEnabled = normalizeBoolean(search?.get('uiDebug'));
  const bootRoute = normalizeString(
    (uiDebugEnabled ? 'ui-debug' : null)
    ?? search?.get('route')
    ?? launchParams?.route
    ?? import.meta.env.VITE_BOOT_ROUTE,
  );

  if (bootRoute === 'ui-debug') {
    return { name: 'ui-debug' };
  }

  if (bootRoute !== 'player') {
    return { name: 'home' };
  }

  const bvid = normalizeString(launchParams?.bvid ?? import.meta.env.VITE_BOOT_PLAYER_BVID);
  const cid = normalizeNumber(launchParams?.cid ?? import.meta.env.VITE_BOOT_PLAYER_CID);
  const title = normalizeString(launchParams?.title ?? import.meta.env.VITE_BOOT_PLAYER_TITLE);
  const part = normalizeString(launchParams?.part ?? import.meta.env.VITE_BOOT_PLAYER_PART) ?? undefined;

  if (!bvid || !cid || !title) {
    return { name: 'home' };
  }

  return {
    name: 'player',
    bvid,
    cid,
    title,
    part,
  };
}

export function readDebugTelemetryUrl() {
  return normalizeString(readLaunchParams()?.debugTelemetryUrl ?? import.meta.env.VITE_DEBUG_TELEMETRY_URL);
}

export function readMediaProxyOrigin() {
  return normalizeString(readLaunchParams()?.mediaProxyOrigin ?? import.meta.env.VITE_MEDIA_PROXY_ORIGIN);
}

export function readDebugFocusEnabled() {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  return normalizeBoolean(
    search?.get('debugFocus')
    ?? readLaunchParams()?.debugFocus
    ?? import.meta.env.VITE_DEBUG_FOCUS,
  );
}
