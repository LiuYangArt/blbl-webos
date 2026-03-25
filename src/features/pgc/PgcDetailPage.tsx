import { useMemo } from 'react';
import { useWatchProgressMap } from '../../app/watchProgressStore';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import { fetchPgcSeasonDetail } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type PgcDetailPageProps = {
  seasonId: number;
  fallbackTitle?: string;
  onPlay: (item: PlayerRoutePayload) => void;
};

export function PgcDetailPage({ seasonId, fallbackTitle, onPlay }: PgcDetailPageProps) {
  const watchProgress = useWatchProgressMap();
  const detail = useAsyncData(async () => fetchPgcSeasonDetail(seasonId), [seasonId]);

  const continueEntry = useMemo(() => {
    if (detail.status !== 'success') {
      return null;
    }

    return detail.data.episodes.find((episode) => watchProgress[`${episode.bvid}:${episode.cid}`]);
  }, [detail, watchProgress]);

  if (detail.status !== 'success') {
    if (detail.status === 'error') {
      return (
        <PageStatus
          title="剧集详情加载失败"
          description={detail.error}
          actionLabel="重新加载详情"
          onAction={() => void detail.reload()}
        />
      );
    }
    return <PageStatus title="正在加载剧集详情" description={fallbackTitle ?? '准备剧集简介、选集与播放入口。'} />;
  }

  const season = detail.data;
  const playableEpisodes = season.episodes.filter((episode) => episode.isPlayable);
  const firstPlayableEpisode = playableEpisodes[0] ?? null;

  if (!firstPlayableEpisode) {
    return (
      <PageStatus
        title="当前剧集暂无可播放分集"
        description="接口已返回订阅数据，但当前还没有适合电视端直接播放的分集。"
        actionLabel="重新加载详情"
        onAction={() => void detail.reload()}
      />
    );
  }

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="pgc-detail-hero-actions"
        group="content"
        className="detail-hero"
        leaveFor={{ left: '@side-nav', down: '@pgc-detail-episodes' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <div className="detail-hero__cover">
          <img src={season.cover} alt="" referrerPolicy="no-referrer" />
        </div>
        <div className="detail-hero__content">
          <span className="detail-hero__tag">{season.typeName || '订阅剧集'}</span>
          <h1>{season.title}</h1>
          <p className="detail-hero__meta">
            {season.badge || '已订阅'}
            {season.subtitle ? ` · ${season.subtitle}` : ''}
            {season.newestEpisodeLabel ? ` · ${season.newestEpisodeLabel}` : ''}
          </p>
          <p className="detail-hero__description">{season.evaluate || '这个剧集还没有公开简介。'}</p>
          <div className="detail-hero__actions">
            <FocusButton
              variant="primary"
              size="hero"
              sectionId="pgc-detail-hero-actions"
              focusId="pgc-detail-play-primary"
              defaultFocus
              onClick={() => onPlay({
                bvid: continueEntry?.bvid ?? firstPlayableEpisode.bvid,
                cid: continueEntry?.cid ?? firstPlayableEpisode.cid,
                title: season.title,
                part: continueEntry?.longTitle || continueEntry?.title || firstPlayableEpisode.longTitle || firstPlayableEpisode.title,
              })}
            >
              {continueEntry ? '继续播放' : '立即播放'}
            </FocusButton>
            <FocusButton
              variant="secondary"
              size="hero"
              sectionId="pgc-detail-hero-actions"
              focusId="pgc-detail-play-first"
              onClick={() => onPlay({
                bvid: firstPlayableEpisode.bvid,
                cid: firstPlayableEpisode.cid,
                title: season.title,
                part: firstPlayableEpisode.longTitle || firstPlayableEpisode.title,
              })}
            >
              从第一集开始
            </FocusButton>
          </div>
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="pgc-detail-episodes"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@pgc-detail-hero-actions' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader title="选集" />
        <div className="chip-grid">
          {playableEpisodes.map((episode, index) => {
            const isContinueEpisode = continueEntry?.id === episode.id;
            return (
              <FocusButton
                key={episode.id}
                variant={isContinueEpisode ? 'primary' : 'glass'}
                className="detail-chip"
                sectionId="pgc-detail-episodes"
                focusId={`pgc-detail-episode-${index}`}
                onClick={() => onPlay({
                  bvid: episode.bvid,
                  cid: episode.cid,
                  title: season.title,
                  part: episode.longTitle || episode.title,
                })}
              >
                <span>{episode.title}</span>
                <small>{episode.longTitle || season.newestEpisodeLabel || formatDuration(episode.duration)}</small>
              </FocusButton>
            );
          })}
        </div>
      </FocusSection>
    </main>
  );
}

function formatDuration(duration: number) {
  if (!duration) {
    return '时长待确认';
  }
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
