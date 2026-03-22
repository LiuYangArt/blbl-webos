import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoCardItem } from '../../services/api/types';

const baseNow = new Date('2026-03-22T00:00:00.000Z');

const sampleCard: VideoCardItem = {
  aid: 1,
  bvid: 'BV1xx411c7mD',
  cid: 2,
  title: '测试视频',
  cover: 'https://example.com/cover.jpg',
  duration: 120,
  ownerName: '测试 UP',
  playCount: 100,
  danmakuCount: 10,
};

async function loadHomeFeedCacheModule() {
  vi.resetModules();
  return import('./homeFeedCache');
}

describe('homeFeedCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    window.localStorage.clear();
  });

  it('写入后立即读取 fresh 缓存快照', async () => {
    const { writeHomePublicFeedCache, readHomePublicFeedCache } = await loadHomeFeedCacheModule();
    const data = {
      recommended: [sampleCard],
      popular: [],
      ranking: [],
    };

    const written = writeHomePublicFeedCache(data);
    const snapshot = readHomePublicFeedCache();

    expect(written).toMatchObject({
      cachedAt: baseNow.getTime(),
      ageMs: 0,
      isFresh: true,
      data,
    });
    expect(snapshot).toMatchObject({
      cachedAt: baseNow.getTime(),
      ageMs: 0,
      isFresh: true,
      data,
    });
  });

  it('过了 fresh TTL 后只在允许 stale 时返回缓存', async () => {
    const { writeHomePublicFeedCache, readHomePublicFeedCache } = await loadHomeFeedCacheModule();

    writeHomePublicFeedCache({
      recommended: [sampleCard],
      popular: [],
      ranking: [],
    });

    vi.setSystemTime(baseNow.getTime() + (5 * 60 * 1000));

    expect(readHomePublicFeedCache()).toBeNull();
    expect(readHomePublicFeedCache({ allowStale: true })).toMatchObject({
      ageMs: 5 * 60 * 1000,
      isFresh: false,
    });
  });

  it('超过 stale 最大时长后丢弃缓存', async () => {
    const { writeHomePublicFeedCache, readHomePublicFeedCache } = await loadHomeFeedCacheModule();

    writeHomePublicFeedCache({
      recommended: [sampleCard],
      popular: [],
      ranking: [],
    });

    vi.setSystemTime(baseNow.getTime() + (31 * 60 * 1000));

    expect(readHomePublicFeedCache({ allowStale: true })).toBeNull();
  });

  it('读取存储时会清洗非法结构，避免坏缓存污染首页', async () => {
    window.localStorage.setItem('bilibili_webos.home_public_feed_cache', JSON.stringify({
      cachedAt: baseNow.getTime(),
      data: {
        recommended: [sampleCard, null, 123],
        popular: 'invalid',
        ranking: [{ ...sampleCard, bvid: 'BV1abc411c7mD' }],
      },
    }));

    const { readHomePublicFeedCache } = await loadHomeFeedCacheModule();

    expect(readHomePublicFeedCache({ allowStale: true })).toMatchObject({
      data: {
        recommended: [sampleCard],
        popular: [],
        ranking: [{ ...sampleCard, bvid: 'BV1abc411c7mD' }],
      },
    });
  });

  it('空数据不写入缓存，避免把失败态覆盖掉旧快照', async () => {
    const { writeHomePublicFeedCache } = await loadHomeFeedCacheModule();

    expect(writeHomePublicFeedCache({
      recommended: [],
      popular: [],
      ranking: [],
    })).toBeNull();
    expect(window.localStorage.getItem('bilibili_webos.home_public_feed_cache')).toBeNull();
  });
});
