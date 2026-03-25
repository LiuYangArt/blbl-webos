import type { ApiEnvelope } from './types';

type JsonRecord = Record<string, unknown>;
type FormPrimitive = string | number | boolean;
type FormValue = FormPrimitive | null | undefined;

const BILI_API_ORIGIN = import.meta.env.DEV ? '/__bili_api' : 'https://api.bilibili.com';
const BILI_PASSPORT_ORIGIN = import.meta.env.DEV ? '/__bili_passport' : 'https://passport.bilibili.com';
const BILI_SEARCH_ORIGIN = import.meta.env.DEV ? '/__bili_search' : 'https://s.search.bilibili.com';

export class BiliApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly payload?: unknown,
  ) {
    super(normalizeBiliApiMessage(code, message));
    this.name = 'BiliApiError';
  }
}

function normalizeBiliApiMessage(code: number, message: string) {
  const trimmed = message.trim();

  if (code === -352 || trimmed === '-352') {
    return '风控校验失败（-352）';
  }

  return trimmed || '接口返回失败';
}

export function getBiliApiUrl(pathWithQuery: string) {
  return `${BILI_API_ORIGIN}${pathWithQuery}`;
}

export function getBiliPassportUrl(pathWithQuery: string) {
  return `${BILI_PASSPORT_ORIGIN}${pathWithQuery}`;
}

export function getBiliSearchUrl(pathWithQuery: string) {
  return `${BILI_SEARCH_ORIGIN}${pathWithQuery}`;
}

export async function fetchJson<T extends JsonRecord | ApiEnvelope<unknown>>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json, text/plain, */*',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`网络请求失败（${response.status}）`);
  }

  return response.json() as Promise<T>;
}

export async function postForm<T extends JsonRecord | ApiEnvelope<unknown>>(
  url: string,
  body: Record<string, FormValue>,
  init?: RequestInit,
) {
  const form = new URLSearchParams();

  Object.entries(body).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    form.set(key, String(value));
  });

  return fetchJson<T>(url, {
    ...init,
    method: 'POST',
    body: form,
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...init?.headers,
    },
  });
}

export function readCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  const matched = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!matched) {
    return null;
  }

  const rawValue = matched.slice(prefix.length).trim();
  if (!rawValue) {
    return null;
  }

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function formatDisplayError(error: unknown, context?: string) {
  const detail = error instanceof Error ? error.message : '请求失败';
  return context ? `${context}失败：${detail}` : detail;
}

export function unwrapData<T>(payload: ApiEnvelope<T>) {
  if (payload.code !== 0) {
    throw new BiliApiError(payload.message || '接口返回失败', payload.code, payload);
  }
  return payload.data;
}
