import { useSyncExternalStore } from 'react';
import { readJsonStorage, writeJsonStorage } from '../services/storage/local';

export type WatchProgressEntry = {
  bvid: string;
  cid: number;
  title: string;
  progress: number;
  duration: number;
  updatedAt: number;
};

type WatchProgressSnapshot = Record<string, WatchProgressEntry>;

const STORAGE_KEY = 'bilibili_webos.watch_progress';
const listeners = new Set<() => void>();

let watchProgressState: WatchProgressSnapshot = readJsonStorage<WatchProgressSnapshot>(STORAGE_KEY, {});

function buildWatchProgressKey(bvid: string, cid: number): string {
  return `${bvid}:${cid}`;
}

function isSameWatchProgressEntry(current: WatchProgressEntry | undefined, next: WatchProgressEntry) {
  return Boolean(
    current
    && current.title === next.title
    && current.progress === next.progress
    && current.duration === next.duration,
  );
}

function emitWatchProgressChange(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getWatchProgressSnapshot(): WatchProgressSnapshot {
  return watchProgressState;
}

export function readWatchProgressEntry(key: string): WatchProgressEntry | undefined {
  return watchProgressState[key];
}

export function setWatchProgress(entry: Omit<WatchProgressEntry, 'updatedAt'>): boolean {
  const nextEntry: WatchProgressEntry = {
    ...entry,
    updatedAt: Date.now(),
  };
  const key = buildWatchProgressKey(entry.bvid, entry.cid);
  const current = watchProgressState[key];
  if (isSameWatchProgressEntry(current, nextEntry)) {
    return false;
  }

  watchProgressState = {
    ...watchProgressState,
    [key]: nextEntry,
  };
  writeJsonStorage(STORAGE_KEY, watchProgressState);
  emitWatchProgressChange();
  return true;
}

export function useWatchProgressMap(): WatchProgressSnapshot {
  return useSyncExternalStore(subscribe, getWatchProgressSnapshot, getWatchProgressSnapshot);
}

export function useWatchProgressEntry(key: string): WatchProgressEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => watchProgressState[key],
    () => watchProgressState[key],
  );
}
