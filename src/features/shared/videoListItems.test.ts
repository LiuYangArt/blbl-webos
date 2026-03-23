import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PgcSubscriptionItem } from '../../services/api/types';
import {
  mapHistoryItemToVideoCard,
  mapPgcSubscriptionToVideoCard,
  resolvePgcSubscriptionPlayerPayload,
  resolveVideoPlayerPayload,
} from './videoListItems';
import { fetchPgcSeasonDetail, fetchVideoDetail } from '../../services/api/bilibili';

vi.mock('../../services/api/bilibili', () => ({
  fetchPgcSeasonDetail: vi.fn(),
  fetchVideoDetail: vi.fn(),
}));

describe('videoListItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('已有 cid 的视频直接返回播放参数，不额外请求详情', async () => {
    const payload = await resolveVideoPlayerPayload({
      bvid: 'BV1test',
      cid: 123,
      title: '测试视频',
      part: '正片',
    });

    expect(payload).toEqual({
      bvid: 'BV1test',
      cid: 123,
      title: '测试视频',
      part: '正片',
    });
    expect(fetchVideoDetail).not.toHaveBeenCalled();
  });

  it('缺少 cid 时会补全视频详情并取首个分 P', async () => {
    vi.mocked(fetchVideoDetail).mockResolvedValue({
      aid: 1,
      bvid: 'BV1detail',
      cid: 456,
      title: '详情标题',
      cover: '',
      description: '',
      duration: 120,
      owner: {
        mid: 1,
        name: '作者',
        face: '',
      },
      stats: {
        playCount: 0,
        danmakuCount: 0,
        favoriteCount: 0,
        likeCount: 0,
        replyCount: 0,
        coinCount: 0,
        shareCount: 0,
      },
      parts: [
        { cid: 456, page: 1, part: 'P1', duration: 120 },
      ],
      publishAt: 0,
      typeName: '视频',
    });

    const payload = await resolveVideoPlayerPayload({
      bvid: 'BV1detail',
      title: '旧标题',
    });

    expect(fetchVideoDetail).toHaveBeenCalledWith('BV1detail');
    expect(payload).toEqual({
      bvid: 'BV1detail',
      cid: 456,
      title: '详情标题',
      part: 'P1',
    });
  });

  it('订阅条目会解析为首个可播分集', async () => {
    const subscription: PgcSubscriptionItem = {
      seasonId: 1001,
      title: '三体',
      cover: 'season-cover',
      badge: '追番',
      subtitle: '每周更新',
      progress: '看到第 3 集',
      seasonTypeLabel: '番剧',
      seasonKind: 'anime',
      latestEpisodeId: 3,
      latestEpisodeLabel: '更新至第 4 集',
      latestEpisodeTitle: '第四集',
      latestEpisodeCover: 'episode-cover',
      latestEpisodeDuration: 1440,
      url: 'https://example.com',
    };

    vi.mocked(fetchPgcSeasonDetail).mockResolvedValue({
      seasonId: 1001,
      title: '三体',
      cover: 'season-cover',
      evaluate: '',
      subtitle: '',
      badge: '追番',
      typeName: '番剧',
      newestEpisodeLabel: '更新至第 4 集',
      episodes: [
        {
          id: 10,
          cid: 0,
          bvid: '',
          title: '预告',
          longTitle: '不可播',
          cover: '',
          duration: 60,
          badge: '',
          isPlayable: false,
        },
        {
          id: 11,
          cid: 7788,
          bvid: 'BVpgc1',
          title: '第 1 集',
          longTitle: '宇宙闪烁',
          cover: '',
          duration: 1440,
          badge: '',
          isPlayable: true,
        },
      ],
    });

    const payload = await resolvePgcSubscriptionPlayerPayload(subscription);

    expect(fetchPgcSeasonDetail).toHaveBeenCalledWith(1001);
    expect(payload).toEqual({
      bvid: 'BVpgc1',
      cid: 7788,
      title: '三体',
      part: '宇宙闪烁',
    });
  });

  it('历史记录会映射出统一卡片元信息', () => {
    const card = mapHistoryItemToVideoCard({
      kid: 'history-1',
      title: '历史视频',
      bvid: 'BVhistory',
      cid: 66,
      cover: 'cover',
      author: 'UP主',
      duration: 620,
      progress: 75,
      viewAt: 0,
      part: '正片',
    });

    expect(card.metaText).toBe('看到 01:15 / 10:20');
    expect(card.ownerName).toBe('UP主');
  });

  it('订阅条目会映射为统一视频卡片字段', () => {
    const card = mapPgcSubscriptionToVideoCard({
      seasonId: 1001,
      title: '迷雾剧场',
      cover: 'season-cover',
      badge: '追剧',
      subtitle: '悬疑',
      progress: '',
      seasonTypeLabel: '影视',
      seasonKind: 'cinema',
      latestEpisodeId: 5,
      latestEpisodeLabel: '更新至第 5 集',
      latestEpisodeTitle: '第五集',
      latestEpisodeCover: 'episode-cover',
      latestEpisodeDuration: 2680,
      url: 'https://example.com',
    });

    expect(card.cover).toBe('episode-cover');
    expect(card.typeName).toBe('追剧');
    expect(card.metaText).toBe('更新至第 5 集');
  });
});
