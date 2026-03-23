import type { PlayerRoutePayload } from '../../app/routes';
import { fetchPgcSeasonDetail, fetchVideoDetail } from '../../services/api/bilibili';
import type {
  FavoriteItem,
  FollowFeedItem,
  HistoryItem,
  LaterItem,
  PgcSubscriptionItem,
  VideoCardItem,
} from '../../services/api/types';

export type UnifiedVideoListItem = {
  id: string;
  card: VideoCardItem;
  resolvePlayer: () => Promise<PlayerRoutePayload>;
};

export function createDirectVideoListItem(
  id: string,
  card: VideoCardItem,
  payload: PlayerRoutePayload,
): UnifiedVideoListItem {
  return {
    id,
    card,
    resolvePlayer: async () => payload,
  };
}

export function createResolvedVideoListItem(
  id: string,
  card: VideoCardItem,
  resolver: () => Promise<PlayerRoutePayload>,
): UnifiedVideoListItem {
  return {
    id,
    card,
    resolvePlayer: resolver,
  };
}

export async function resolveVideoPlayerPayload(item: {
  bvid: string;
  cid?: number;
  title: string;
  part?: string;
}): Promise<PlayerRoutePayload> {
  if (item.cid && item.cid > 0) {
    return {
      bvid: item.bvid,
      cid: item.cid,
      title: item.title,
      part: item.part,
    };
  }

  const detail = await fetchVideoDetail(item.bvid);
  const firstPart = detail.parts[0];
  const targetCid = firstPart?.cid ?? detail.cid;

  if (!targetCid) {
    throw new Error('当前视频缺少有效 CID，暂时无法直接播放');
  }

  return {
    bvid: detail.bvid || item.bvid,
    cid: targetCid,
    title: detail.title || item.title,
    part: item.part || firstPart?.part,
  };
}

export async function resolvePgcSubscriptionPlayerPayload(item: PgcSubscriptionItem): Promise<PlayerRoutePayload> {
  const season = await fetchPgcSeasonDetail(item.seasonId);
  const firstPlayableEpisode = season.episodes.find((episode) => episode.isPlayable);

  if (!firstPlayableEpisode) {
    throw new Error('当前订阅剧集暂无可直接播放的分集');
  }

  return {
    bvid: firstPlayableEpisode.bvid,
    cid: firstPlayableEpisode.cid,
    title: season.title || item.title,
    part: firstPlayableEpisode.longTitle || firstPlayableEpisode.title,
  };
}

export function mapHistoryItemToVideoCard(item: HistoryItem): VideoCardItem {
  return {
    aid: 0,
    bvid: item.bvid,
    cid: item.cid,
    title: item.title,
    cover: item.cover,
    duration: item.duration,
    ownerName: item.author,
    playCount: 0,
    danmakuCount: 0,
    metaText: `看到 ${formatDuration(item.progress)} / ${formatDuration(item.duration)}`,
  };
}

export function mapLaterItemToVideoCard(item: LaterItem): VideoCardItem {
  return {
    aid: item.aid,
    bvid: item.bvid,
    cid: item.cid,
    title: item.title,
    cover: item.cover,
    duration: item.duration,
    ownerName: item.author,
    playCount: 0,
    danmakuCount: 0,
    metaText: `稍后再看 · ${formatDuration(item.duration)}`,
  };
}

export function mapFavoriteItemToVideoCard(item: FavoriteItem, folderTitle?: string): VideoCardItem {
  return {
    aid: item.aid,
    bvid: item.bvid,
    cid: item.cid,
    title: item.title,
    cover: item.cover,
    duration: item.duration,
    ownerName: item.author,
    playCount: 0,
    danmakuCount: 0,
    description: item.description,
    metaText: folderTitle ? `来自 ${folderTitle}` : '来自收藏夹',
  };
}

export function mapFollowItemToVideoCard(item: FollowFeedItem): VideoCardItem {
  return {
    aid: 0,
    bvid: item.bvid,
    cid: 0,
    title: item.title,
    cover: item.cover,
    duration: item.duration,
    ownerName: item.ownerName,
    playCount: 0,
    danmakuCount: 0,
    description: item.description,
    reason: item.reason,
    publishAt: item.publishedAt,
    metaText: item.reason || '关注更新',
  };
}

export function mapPgcSubscriptionToVideoCard(item: PgcSubscriptionItem): VideoCardItem {
  return {
    aid: 0,
    bvid: '',
    cid: 0,
    title: item.title,
    cover: item.latestEpisodeCover || item.cover,
    duration: item.latestEpisodeDuration,
    ownerName: item.seasonTypeLabel || '订阅剧集',
    playCount: 0,
    danmakuCount: 0,
    badge: item.badge || undefined,
    typeName: item.seasonKind === 'anime' ? '追番' : '追剧',
    metaText: item.progress || item.latestEpisodeLabel || item.subtitle || '订阅剧集',
  };
}

function formatDuration(duration: number): string {
  const value = Math.max(0, Math.floor(duration));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
