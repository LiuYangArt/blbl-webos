import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadWatchProgressStoreModule() {
  vi.resetModules();
  return import('./watchProgressStore');
}

describe('watchProgressStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('会写入并读取播放记录', async () => {
    const store = await loadWatchProgressStoreModule();

    const changed = store.setWatchProgress({
      bvid: 'BV1test',
      cid: 123,
      title: '测试视频',
      progress: 42,
      duration: 120,
    });

    expect(changed).toBe(true);
    expect(store.readWatchProgressEntry('BV1test:123')).toMatchObject({
      bvid: 'BV1test',
      cid: 123,
      progress: 42,
      duration: 120,
    });
  });

  it('相同进度不会重复写入', async () => {
    const store = await loadWatchProgressStoreModule();

    store.setWatchProgress({
      bvid: 'BV1same',
      cid: 456,
      title: '同一条记录',
      progress: 18,
      duration: 90,
    });

    const firstUpdatedAt = store.readWatchProgressEntry('BV1same:456')?.updatedAt ?? 0;
    const changed = store.setWatchProgress({
      bvid: 'BV1same',
      cid: 456,
      title: '同一条记录',
      progress: 18,
      duration: 90,
    });

    expect(changed).toBe(false);
    expect(store.readWatchProgressEntry('BV1same:456')?.updatedAt).toBe(firstUpdatedAt);
  });
});
