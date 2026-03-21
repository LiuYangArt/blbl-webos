import type { ApiEnvelope } from './types';

type JsonRecord = Record<string, unknown>;

const BILI_API_ORIGIN = import.meta.env.DEV ? '/__bili_api' : 'https://api.bilibili.com';
const BILI_PASSPORT_ORIGIN = import.meta.env.DEV ? '/__bili_passport' : 'https://passport.bilibili.com';
const BILI_SEARCH_ORIGIN = import.meta.env.DEV ? '/__bili_search' : 'https://s.search.bilibili.com';

export class BiliApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'BiliApiError';
  }
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
    credentials: 'include',
    headers: {
      accept: 'application/json, text/plain, */*',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`网络请求失败（${response.status}）`);
  }

  return response.json() as Promise<T>;
}

export function unwrapData<T>(payload: ApiEnvelope<T>) {
  if (payload.code !== 0) {
    throw new BiliApiError(payload.message || '接口返回失败', payload.code, payload);
  }
  return payload.data;
}
