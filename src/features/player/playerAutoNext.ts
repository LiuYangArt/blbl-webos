import type { VideoCardItem, VideoPart } from '../../services/api/types';

type PlayerAutoNextPayload = {
  aid?: number;
  bvid: string;
  cid: number;
  title: string;
  part?: string;
};

export type PlayerAutoNextTarget =
  | (PlayerAutoNextPayload & {
      kind: 'episode';
    })
  | (PlayerAutoNextPayload & {
      kind: 'related';
    });

type RelatedVideoCandidate = Partial<Pick<VideoCardItem, 'aid' | 'bvid' | 'cid' | 'title'>>;

type ResolvePlayerAutoNextTargetOptions = {
  aid?: number;
  bvid: string;
  cid: number;
  title: string;
  episodeEntries: VideoPart[];
  related: RelatedVideoCandidate[];
};

export function resolvePlayerAutoNextTarget({
  aid,
  bvid,
  cid,
  title,
  episodeEntries,
  related,
}: ResolvePlayerAutoNextTargetOptions): PlayerAutoNextTarget | null {
  const currentEpisodeIndex = episodeEntries.findIndex((entry) => entry.cid === cid);
  const nextEpisode = currentEpisodeIndex >= 0 ? episodeEntries[currentEpisodeIndex + 1] : null;

  if (nextEpisode) {
    return {
      kind: 'episode',
      aid,
      bvid,
      cid: nextEpisode.cid,
      title,
      part: nextEpisode.part,
    };
  }

  const nextRelated = related[0];
  if (!nextRelated?.bvid || !nextRelated.cid || !nextRelated.title) {
    return null;
  }

  return {
    kind: 'related',
    aid: nextRelated.aid,
    bvid: nextRelated.bvid,
    cid: nextRelated.cid,
    title: nextRelated.title,
  };
}

export function getPlayerAutoNextNotice(target: PlayerAutoNextTarget): string {
  if (target.kind === 'episode') {
    return `正在继续播放下一 P：${target.part || '下一集'}`;
  }

  return '当前视频已播完，正在为你播放下一条推荐视频';
}
