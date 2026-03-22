import { readJsonStorage, writeJsonStorage } from '../storage/local';

export type RuntimeDiagnosticLevel = 'info' | 'warn' | 'error';

export type RuntimeDiagnosticEntry = {
  timestamp: string;
  channel: string;
  event: string;
  level: RuntimeDiagnosticLevel;
  detail: Record<string, unknown> | null;
};

type RuntimeDiagnosticsApi = {
  readRecent: (limit?: number) => RuntimeDiagnosticEntry[];
  clear: () => void;
};

const STORAGE_KEY = 'bilibili_webos.runtime_diagnostics';
const MAX_ENTRIES = 80;

function normalizeDetail(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (depth >= 3) {
    return '[truncated]';
  }

  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => normalizeDetail(item, depth + 1));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 24);
    return Object.fromEntries(entries.map(([key, item]) => [key, normalizeDetail(item, depth + 1)]));
  }

  return String(value);
}

function readEntries() {
  return readJsonStorage<RuntimeDiagnosticEntry[]>(STORAGE_KEY, []);
}

function writeEntries(entries: RuntimeDiagnosticEntry[]) {
  writeJsonStorage(STORAGE_KEY, entries.slice(-MAX_ENTRIES));
}

function getConsoleMethod(level: RuntimeDiagnosticLevel) {
  switch (level) {
    case 'warn':
      return console.warn;
    case 'error':
      return console.error;
    default:
      return console.info;
  }
}

export function appendRuntimeDiagnostic(
  channel: string,
  event: string,
  detail?: Record<string, unknown>,
  level: RuntimeDiagnosticLevel = 'info',
) {
  const entry: RuntimeDiagnosticEntry = {
    timestamp: new Date().toISOString(),
    channel,
    event,
    level,
    detail: detail ? (normalizeDetail(detail) as Record<string, unknown>) : null,
  };

  writeEntries([...readEntries(), entry]);
  getConsoleMethod(level)(`[runtime-diagnostics][${channel}] ${event}`, entry.detail ?? {});
}

export function readRecentRuntimeDiagnostics(limit = 20) {
  return readEntries().slice(-Math.max(1, limit));
}

export function clearRuntimeDiagnostics() {
  writeEntries([]);
}

function installRuntimeDiagnosticsApi() {
  if (typeof window === 'undefined') {
    return;
  }

  const runtimeDiagnosticsWindow = window as typeof window & {
    __biliRuntimeDiagnostics?: RuntimeDiagnosticsApi;
  };

  runtimeDiagnosticsWindow.__biliRuntimeDiagnostics = {
    readRecent: readRecentRuntimeDiagnostics,
    clear: clearRuntimeDiagnostics,
  };
}

installRuntimeDiagnosticsApi();
