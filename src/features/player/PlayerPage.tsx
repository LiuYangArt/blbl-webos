import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { SectionHeader } from '../../components/SectionHeader';
import { fetchPlaySource, fetchRelatedVideos } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type PlayerPageProps = {
  bvid: string;
  cid: number;
  title: string;
  part?: string;
  onBack: () => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
};

export function PlayerPage({ bvid, cid, title, part, onBack, onOpenDetail }: PlayerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPersistedProgressRef = useRef(-1);
  const resumeProgressRef = useRef(0);
  const savedProgressRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressView, setProgressView] = useState({ current: 0, duration: 0 });
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const { setWatchProgress, watchProgress } = useAppStore();

  const playerData = useAsyncData(async () => {
    const [play, related] = await Promise.all([
      fetchPlaySource(bvid, cid),
      fetchRelatedVideos(bvid),
    ]);
    return { play, related };
  }, [bvid, cid]);

  const progressKey = `${bvid}:${cid}`;
  const savedProgress = watchProgress[progressKey];
  const play = playerData.status === 'success' ? playerData.data.play : null;
  const related = playerData.status === 'success' ? playerData.data.related : [];

  useEffect(() => {
    savedProgressRef.current = savedProgress?.progress ?? 0;
  }, [savedProgress?.progress]);

  useEffect(() => {
    const initialProgress = savedProgressRef.current;
    resumeProgressRef.current = initialProgress;
    lastPersistedProgressRef.current = initialProgress > 0 ? initialProgress : -1;
    setActiveSourceIndex(0);
    setPlaybackError(null);
    setProgressView({ current: 0, duration: 0 });
  }, [bvid, cid]);

  useEffect(() => {
    if (!play) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const sourceUrl = play.candidateUrls[activeSourceIndex] ?? play.url;
    if (!sourceUrl) {
      setPlaybackError('当前没有可用播放地址');
      return;
    }

    let cancelled = false;
    setPlaybackError(null);
    video.pause();
    video.setAttribute('referrerpolicy', 'no-referrer');
    video.src = sourceUrl;
    video.load();

    const handleLoaded = () => {
      const resumePoint = resumeProgressRef.current;
      if (resumePoint > 0) {
        video.currentTime = Math.min(resumePoint, video.duration || resumePoint);
      }
      setProgressView({
        current: video.currentTime,
        duration: video.duration || play.durationMs / 1000,
      });
      void video.play().catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : '自动播放失败';
        if (!message.includes('interrupted by a new load request')) {
          setPlaybackError(message);
        }
        setIsPlaying(false);
      });
    };

    const handleTimeUpdate = () => {
      const current = Math.floor(video.currentTime);
      const duration = getDurationSeconds(video, play.durationMs);
      setProgressView((previous) => (
        previous.current === current && previous.duration === duration
          ? previous
          : { current, duration }
      ));
      if (lastPersistedProgressRef.current !== current) {
        lastPersistedProgressRef.current = current;
        setWatchProgress({
          bvid,
          cid,
          title,
          progress: current,
          duration,
        });
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      if (cancelled) {
        return;
      }
      const nextIndex = activeSourceIndex + 1;
      if (nextIndex < play.candidateUrls.length) {
        setActiveSourceIndex(nextIndex);
        return;
      }
      const mediaError = video.error;
      setPlaybackError(mediaError?.message || '当前线路播放失败，已尝试所有备选地址。');
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoaded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [activeSourceIndex, bvid, cid, play, setWatchProgress, title]);

  if (playerData.status !== 'success') {
    if (playerData.status === 'error') {
      return (
        <PageStatus
          title="播放器加载失败"
          description={playerData.error}
          actionLabel="重新获取播放源"
          onAction={() => void playerData.reload()}
        />
      );
    }
    return <PageStatus title="正在准备播放源" description="加载真实视频地址和相关推荐。" />;
  }

  const playSource = playerData.data.play;
  const progressPercent = progressView.duration ? Math.min(100, (progressView.current / progressView.duration) * 100) : 0;

  return (
    <main className="page-shell">
      <section className="player-hero">
        <div className="player-hero__video">
          <video
            ref={videoRef}
            className="player-video"
            controls={false}
            playsInline
            crossOrigin="anonymous"
          />
        </div>

        <div className="player-hero__top">
          <div className="player-hero__title-group">
            <span className="player-hero__badge">正在播放</span>
            <h1>{title}</h1>
            <p>{part ? `${part} · ` : ''}{playSource.qualityLabel}</p>
            {playbackError ? <small>{playbackError}</small> : null}
          </div>
        </div>

        <div className="player-hero__bottom">
          <div className="player-progress">
            <div className="player-progress__meta">
              <span>{formatSeconds(progressView.current)} / {formatSeconds(progressView.duration)}</span>
              <span>{savedProgress?.progress ? '已同步本地播放记录' : '首次播放'}</span>
            </div>
            <div className="player-progress__track">
              <div className="player-progress__value" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <PlayerControlBar
            isPlaying={isPlaying}
            onBack={onBack}
            onReplay={() => seekVideo(videoRef.current, -10)}
            onTogglePlay={() => togglePlay(videoRef.current)}
            onForward={() => seekVideo(videoRef.current, 10)}
            onRefresh={() => void playerData.reload()}
          />
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          title="相关推荐"
          description="播放页继续沿用卡片体系，验证长链路的跳转与返回。"
          actionLabel="继续看"
        />
        <div className="media-grid">
          {related.slice(0, 6).map((item, index) => (
            <MediaCard key={item.bvid} row={1 + Math.floor(index / 3)} col={10 + (index % 3)} item={item} onClick={() => onOpenDetail(item)} />
          ))}
        </div>
      </section>
    </main>
  );
}

function getDurationSeconds(video: HTMLVideoElement, durationMs: number) {
  return Math.floor(video.duration || durationMs / 1000);
}

function togglePlay(video: HTMLVideoElement | null) {
  if (!video) {
    return;
  }
  if (video.paused) {
    void video.play();
  } else {
    video.pause();
  }
}

function seekVideo(video: HTMLVideoElement | null, delta: number) {
  if (!video) {
    return;
  }
  video.currentTime = Math.max(0, video.currentTime + delta);
}

function formatSeconds(value: number) {
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
