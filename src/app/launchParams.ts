import type { AppRoute } from './routes';

export type AppLaunchParams = {
  route?: string;
  bvid?: string;
  cid?: number | string;
  title?: string;
  part?: string;
  debugTelemetryUrl?: string;
};

let cachedLaunchParams: AppLaunchParams | null | undefined;

function normalizeString(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function readLaunchParams(): AppLaunchParams | null {
  if (cachedLaunchParams !== undefined) {
    return cachedLaunchParams;
  }

  const raw = window.launchParams;
  if (!raw) {
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
  const launchParams = readLaunchParams();
  const bootRoute = normalizeString(launchParams?.route ?? import.meta.env.VITE_BOOT_ROUTE);
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
