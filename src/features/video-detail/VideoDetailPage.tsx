import { useMemo } from 'react';
import { useAppStore } from '../../app/AppStore';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
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
      <section className="detail-hero">
        <div className="detail-hero__cover">
          <img src={video.cover} alt="" />
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
              row={0}
              col={10}
              variant="primary"
              size="hero"
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
              row={0}
              col={11}
              variant="secondary"
              size="hero"
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
      </section>

      <section className="content-section">
        <SectionHeader
          title="分 P / 选集"
          description="首版详情页先支持基础分 P 切换，后续再扩展番剧和更多面板。"
          actionLabel={`${video.parts.length || 1} 个片段`}
        />
        <div className="chip-grid">
          {parts.map((part, index) => (
            <FocusButton
              key={part.cid}
              row={1 + Math.floor(index / 4)}
              col={10 + (index % 4)}
              variant={continueEntry?.cid === part.cid ? 'primary' : 'glass'}
              className="detail-chip"
              onClick={() => onPlay({ cid: part.cid, title: video.title, part: part.part })}
            >
              <span>{part.part || `P${part.page}`}</span>
              <small>{formatDuration(part.duration)}</small>
            </FocusButton>
          ))}
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          title="相关推荐"
          description="从详情继续跳详情，保持首页 -> 详情 -> 播放 的主链路稳定。"
          actionLabel="继续浏览"
        />
        <div className="media-grid">
          {related.slice(0, 6).map((item, index) => (
            <MediaCard key={item.bvid} row={4 + Math.floor(index / 3)} col={10 + (index % 3)} item={item} onClick={() => onOpenDetail(item)} />
          ))}
        </div>
      </section>
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
