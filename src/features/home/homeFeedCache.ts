import { readJsonStorage, writeJsonStorage } from '../../services/storage/local';
import type { VideoCardItem } from '../../services/api/types';

export type HomePublicFeedData = {
  recommended: VideoCardItem[];
  popular: VideoCardItem[];
  ranking: VideoCardItem[];
};

export type HomePublicFeedCacheSnapshot = {
  cachedAt: number;
  ageMs: number;
  isFresh: boolean;
  data: HomePublicFeedData;
};

type StoredHomePublicFeedCache = {
  cachedAt: number;
  data: HomePublicFeedData;
};

const STORAGE_KEY = 'bilibili_webos.home_public_feed_cache';
const HOME_PUBLIC_FEED_CACHE_TTL_MS = 3 * 60 * 1000;
const HOME_PUBLIC_FEED_STALE_MAX_AGE_MS = 30 * 60 * 1000;

let memoryCache: StoredHomePublicFeedCache | null = null;

function sanitizeItems(items: unknown): VideoCardItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item): item is VideoCardItem => Boolean(item && typeof item === 'object'));
}

function sanitizeStoredCache(value: unknown): StoredHomePublicFeedCache | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<StoredHomePublicFeedCache>;
  if (!raw.data || typeof raw.data !== 'object') {
    return null;
  }

  const cachedAt = Number(raw.cachedAt ?? 0);
  if (!Number.isFinite(cachedAt) || cachedAt <= 0) {
    return null;
  }

  return {
    cachedAt,
    data: {
      recommended: sanitizeItems(raw.data.recommended),
      popular: sanitizeItems(raw.data.popular),
      ranking: sanitizeItems(raw.data.ranking),
    },
  };
}

function readStoredCache() {
  if (memoryCache) {
    return memoryCache;
  }

  const stored = sanitizeStoredCache(readJsonStorage<StoredHomePublicFeedCache | null>(STORAGE_KEY, null));
  if (!stored) {
    return null;
  }

  memoryCache = stored;
  return stored;
}

export function readHomePublicFeedCache(options?: {
  allowStale?: boolean;
}): HomePublicFeedCacheSnapshot | null {
  const stored = readStoredCache();
  if (!stored) {
    return null;
  }

  const ageMs = Math.max(0, Date.now() - stored.cachedAt);
  const isFresh = ageMs <= HOME_PUBLIC_FEED_CACHE_TTL_MS;

  if (isFresh || (options?.allowStale && ageMs <= HOME_PUBLIC_FEED_STALE_MAX_AGE_MS)) {
    return {
      cachedAt: stored.cachedAt,
      ageMs,
      isFresh,
      data: stored.data,
    };
  }

  return null;
}

export function writeHomePublicFeedCache(data: HomePublicFeedData): HomePublicFeedCacheSnapshot | null {
  if (
    data.recommended.length === 0
    && data.popular.length === 0
    && data.ranking.length === 0
  ) {
    return null;
  }

  const stored: StoredHomePublicFeedCache = {
    cachedAt: Date.now(),
    data,
  };

  memoryCache = stored;
  writeJsonStorage(STORAGE_KEY, stored);

  return {
    cachedAt: stored.cachedAt,
    ageMs: 0,
    isFresh: true,
    data: stored.data,
  };
}

