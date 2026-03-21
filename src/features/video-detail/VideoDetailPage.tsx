import { useMemo } from 'react';
import { useAppStore } from '../../app/AppStore';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import { fetchRelatedVideos, fetchVideoDetail } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type VideoDetailPageProps = {
  bvid: string;
  fallbackTitle?: string;
  onPlay: (entry: { cid: number; title: string; part?: string }) => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
};

export function VideoDetailPage({ bvid, fallbackTitle, onPlay, onOpenDetail }: VideoDetailPageProps) {
  const { watchProgress } = useAppStore();
  const detail = useAsyncData(async () => {
    const [video, related] = await Promise.all([
      fetchVideoDetail(bvid),
      fetchRelatedVideos(bvid),
    ]);
    return { video, related };
  }, [bvid]);

  const continueEntry = useMemo(() => {
    if (detail.status !== 'success') {
      return null;
    }
    return detail.data.video.parts.find((part) => watchProgress[`${bvid}:${part.cid}`]);
  }, [bvid, detail, watchProgress]);

  if (detail.status !== 'success') {
    if (detail.status === 'error') {
      return (
        <PageStatus
          title="视频详情加载失败"
          description={detail.error}
          actionLabel="重新加载详情"
          onAction={() => void detail.reload()}
        />
      );
    }
    return <PageStatus title="正在加载视频详情" description={fallbackTitle ?? '准备视频简介、分 P 和相关推荐。'} />;
  }

  const { video, related } = detail.data;
  const parts: Array<{ cid: number; page: number; part: string; duration: number }> = video.parts.length
    ? video.parts
    : [{ cid: video.cid, page: 1, part: '正片', duration: video.duration }];

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="detail-hero-actions"
        group="content"
        className="detail-hero"
        leaveFor={{ left: '@side-nav', down: '@detail-episodes' }}
      >
        <div className="detail-hero__cover">
          <img src={video.cover} alt="" referrerPolicy="no-referrer" />
        </div>
        <div className="detail-hero__content">
          <span className="detail-hero__tag">{video.typeName || '视频详情'}</span>
          <h1>{video.title}</h1>
          <p className="detail-hero__meta">
            {video.owner.name} · {formatCount(video.stats.playCount)} 播放 · {formatCount(video.stats.likeCount)} 点赞
          </p>
          <p className="detail-hero__description">{video.description || '这个视频还没有公开简介。'}</p>
          <div className="detail-hero__actions">
            <FocusButton
              variant="primary"
              size="hero"
              sectionId="detail-hero-actions"
              focusId="detail-play-primary"
              defaultFocus
              onClick={() => onPlay({
                cid: continueEntry?.cid ?? video.parts[0]?.cid ?? video.cid,
                title: video.title,
                part: continueEntry?.part ?? video.parts[0]?.part,
              })}
            >
              {continueEntry ? '继续播放' : '立即播放'}
            </FocusButton>
            <FocusButton
              variant="secondary"
              size="hero"
              sectionId="detail-hero-actions"
              focusId="detail-play-from-start"
              onClick={() => onPlay({
                cid: video.parts[0]?.cid ?? video.cid,
                title: video.title,
                part: video.parts[0]?.part,
              })}
            >
              从头播放
            </FocusButton>
          </div>
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="detail-episodes"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@detail-hero-actions', down: '@detail-related-grid' }}
      >
        <SectionHeader
          title="分 P / 选集"
          description="首版详情页先支持基础分 P 切换，后续再扩展番剧和更多面板。"
          actionLabel={`${video.parts.length || 1} 个片段`}
        />
        <div className="chip-grid">
          {parts.map((part, index) => (
            <FocusButton
              key={part.cid}
              variant={continueEntry?.cid === part.cid ? 'primary' : 'glass'}
              className="detail-chip"
              sectionId="detail-episodes"
              focusId={`detail-part-${index}`}
              onClick={() => onPlay({ cid: part.cid, title: video.title, part: part.part })}
            >
              <span>{part.part || `P${part.page}`}</span>
              <small>{formatDuration(part.duration)}</small>
            </FocusButton>
          ))}
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="detail-related-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@detail-episodes' }}
      >
        <SectionHeader
          title="相关推荐"
          description="从详情继续跳详情，保持首页 -> 详情 -> 播放 的主链路稳定。"
          actionLabel="继续浏览"
        />
        <div className="media-grid">
          {related.slice(0, 6).map((item, index) => (
            <MediaCard
              key={item.bvid}
              sectionId="detail-related-grid"
              focusId={`detail-related-${index}`}
              item={item}
              onClick={() => onOpenDetail(item)}
            />
          ))}
        </div>
      </FocusSection>
    </main>
  );
}

function formatCount(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)} 万` : `${value}`;
}

function formatDuration(duration: number) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
