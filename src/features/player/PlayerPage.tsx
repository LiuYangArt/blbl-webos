import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { usePageBackHandler } from '../../app/PageBackHandler';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { SectionHeader } from '../../components/SectionHeader';
import { readDeviceInfo } from '../../platform/webos';
import { fetchPlaySource, fetchRelatedVideos } from '../../services/api/bilibili';
import type { VideoCodecPreference } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';
import {
  buildPlaybackAttempts,
  buildPlayerCodecCapability,
  formatAttemptResolution,
  getAvailableCodecsForQuality,
  getCodecLabel,
} from './playerCodec';
import {
  readPlayerCodecMemory,
  readPlayerSettings,
  writePlayerCodecPreference,
  writePlayerCodecResult,
} from './playerSettings';

type PlayerPageProps = {
  bvid: string;
  cid: number;
  title: string;
  part?: string;
  onBack: () => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
};

const CODEC_OPTIONS: VideoCodecPreference[] = ['auto', 'avc', 'hevc', 'av1'];

export function PlayerPage({ bvid, cid, title, part, onBack, onOpenDetail }: PlayerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPersistedProgressRef = useRef(-1);
  const resumeProgressRef = useRef(0);
  const savedProgressRef = useRef(0);
  const recordedAttemptIdRef = useRef('');
  const [codecPreference, setCodecPreference] = useState<VideoCodecPreference>(() => readPlayerSettings().codecPreference);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressView, setProgressView] = useState({ current: 0, duration: 0 });
  const [activeAttemptIndex, setActiveAttemptIndex] = useState(0);
  const [activeCandidateUrlIndex, setActiveCandidateUrlIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const { setWatchProgress, watchProgress } = useAppStore();

  const playerData = useAsyncData(async () => {
    const [play, related, deviceInfo] = await Promise.all([
      fetchPlaySource(bvid, cid),
      fetchRelatedVideos(bvid),
      readDeviceInfo(),
    ]);
    return {
      play,
      related,
      capability: buildPlayerCodecCapability(deviceInfo),
    };
  }, [bvid, cid]);

  const progressKey = `${bvid}:${cid}`;
  const savedProgress = watchProgress[progressKey];
  const play = playerData.status === 'success' ? playerData.data.play : null;
  const related = playerData.status === 'success' ? playerData.data.related : [];
  const capability = playerData.status === 'success' ? playerData.data.capability : null;
  const codecMemory = useMemo(() => (
    capability ? readPlayerCodecMemory(capability.deviceKey) : {
      lastSuccessfulCodec: null,
      lastFailedCodec: null,
    }
  ), [capability]);

  const playbackPlan = useMemo(() => {
    if (!play || !capability) {
      return {
        attempts: [],
        effectivePreference: codecPreference,
        warning: null as string | null,
      };
    }
    return buildPlaybackAttempts(play, codecPreference, capability, codecMemory);
  }, [capability, codecMemory, codecPreference, play]);

  const currentAttempt = playbackPlan.attempts[activeAttemptIndex] ?? null;
  const currentSourceUrl = currentAttempt?.source.candidateUrls[activeCandidateUrlIndex] ?? currentAttempt?.source.url ?? '';
  const availableCodecs = play && currentAttempt ? getAvailableCodecsForQuality(play, currentAttempt.quality) : [];

  usePageBackHandler(isSettingsOpen ? () => {
    setIsSettingsOpen(false);
    queueFocus('[data-focus-row="0"][data-focus-col="15"]');
    return true;
  } : null);

  useEffect(() => {
    savedProgressRef.current = savedProgress?.progress ?? 0;
  }, [savedProgress?.progress]);

  useEffect(() => {
    writePlayerCodecPreference(codecPreference);
  }, [codecPreference]);

  useEffect(() => {
    const initialProgress = savedProgressRef.current;
    resumeProgressRef.current = initialProgress;
    lastPersistedProgressRef.current = initialProgress > 0 ? initialProgress : -1;
    recordedAttemptIdRef.current = '';
    setActiveAttemptIndex(0);
    setActiveCandidateUrlIndex(0);
    setPlaybackError(null);
    setPlaybackNotice(playbackPlan.warning);
    setProgressView({ current: 0, duration: 0 });
  }, [bvid, cid, playbackPlan.warning, playbackPlan.attempts.length]);

  useEffect(() => {
    setActiveCandidateUrlIndex(0);
  }, [activeAttemptIndex]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }
    queueFocus('[data-focus-row="2"][data-focus-col="20"]');
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!play || !currentAttempt || !currentSourceUrl || !capability) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;
    setPlaybackError(null);
    video.pause();
    video.removeAttribute('crossorigin');
    video.removeAttribute('referrerpolicy');
    video.src = currentSourceUrl;
    video.load();

    const handleLoadedMetadata = () => {
      const resumePoint = resumeProgressRef.current;
      if (resumePoint > 0) {
        video.currentTime = Math.min(resumePoint, video.duration || resumePoint);
      }
      setProgressView({
        current: Math.floor(video.currentTime),
        duration: getDurationSeconds(video, play.durationMs),
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

    const markAttemptSuccess = () => {
      if (recordedAttemptIdRef.current === currentAttempt.id) {
        return;
      }
      recordedAttemptIdRef.current = currentAttempt.id;
      writePlayerCodecResult(capability.deviceKey, {
        lastSuccessfulCodec: currentAttempt.codec,
        lastFailedCodec: null,
      });
    };

    const handlePlay = () => {
      setIsPlaying(true);
      markAttemptSuccess();
    };

    const handlePause = () => setIsPlaying(false);

    const handleError = () => {
      if (cancelled) {
        return;
      }

      const nextUrlIndex = activeCandidateUrlIndex + 1;
      if (nextUrlIndex < currentAttempt.source.candidateUrls.length) {
        setPlaybackNotice(`当前线路不可用，正在切换 ${currentAttempt.qualityLabel} 备选地址`);
        setActiveCandidateUrlIndex(nextUrlIndex);
        return;
      }

      writePlayerCodecResult(capability.deviceKey, {
        lastFailedCodec: currentAttempt.codec,
      });

      const nextAttemptIndex = activeAttemptIndex + 1;
      if (nextAttemptIndex < playbackPlan.attempts.length) {
        const nextAttempt = playbackPlan.attempts[nextAttemptIndex];
        setPlaybackNotice(
          nextAttempt.quality === currentAttempt.quality
            ? '当前编码格式不可用，正在切换兼容线路'
            : `当前线路不可用，已降级到 ${nextAttempt.qualityLabel}`,
        );
        setActiveAttemptIndex(nextAttemptIndex);
        return;
      }

      const mediaError = video.error;
      setPlaybackError(mediaError?.message || '当前视频暂时无法在此设备播放，可尝试切换 AVC 或降低清晰度');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [
    activeAttemptIndex,
    activeCandidateUrlIndex,
    bvid,
    capability,
    cid,
    currentAttempt,
    currentSourceUrl,
    play,
    playbackPlan.attempts,
    setWatchProgress,
    title,
  ]);

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
    return <PageStatus title="正在准备播放源" description="加载兼容线路、编码信息和相关推荐。" />;
  }

  if (!currentAttempt) {
    return (
      <PageStatus
        title="暂无可用播放线路"
        description="当前没有可用的兼容流，请稍后重试。"
        actionLabel="重新获取播放源"
        onAction={() => void playerData.reload()}
      />
    );
  }

  const activeCapability = playerData.data.capability;
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
            preload="auto"
          />
        </div>

        <div className="player-hero__top">
          <div className="player-hero__title-group">
            <span className="player-hero__badge">正在播放</span>
            <h1>{title}</h1>
            <p>
              {part ? `${part} · ` : ''}
              {currentAttempt.qualityLabel}
              {' · '}
              {currentAttempt.codecLabel}
              {' · '}
              {currentAttempt.isCompatible ? '兼容流' : 'DASH'}
            </p>
            {playbackNotice ? <small className="player-hero__notice">{playbackNotice}</small> : null}
            {playbackError ? <small className="player-hero__error">{playbackError}</small> : null}
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
            onRefresh={() => {
              setPlaybackNotice('正在按当前策略重新获取播放源');
              void playerData.reload();
            }}
            onOpenSettings={() => setIsSettingsOpen((previous) => !previous)}
          />
        </div>

        {isSettingsOpen ? (
          <aside className="player-settings-drawer">
            <div className="player-settings-drawer__header">
              <span className="player-hero__badge">播放设置</span>
              <h2>编码策略</h2>
              <p>{activeCapability.deviceLabel} · {activeCapability.deviceClass}</p>
            </div>

            <div className="player-settings-drawer__section">
              <span className="player-settings-drawer__label">编码偏好</span>
              <div className="player-settings-drawer__chips">
                {CODEC_OPTIONS.map((option, index) => (
                  <FocusButton
                    key={option}
                    row={2}
                    col={20 + index}
                    variant={codecPreference === option ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setCodecPreference(option);
                      setPlaybackNotice(`已切换到 ${getCodecLabel(option)} 策略，正在重载线路`);
                      setIsSettingsOpen(false);
                    }}
                  >
                    {getCodecLabel(option)}
                  </FocusButton>
                ))}
              </div>
            </div>

            <div className="player-settings-drawer__section">
              <span className="player-settings-drawer__label">当前线路信息</span>
              <div className="player-settings-drawer__info">
                <div className="player-settings-drawer__info-row">
                  <span>当前画质</span>
                  <strong>{currentAttempt.qualityLabel}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前 codec</span>
                  <strong>{currentAttempt.codecLabel}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前分辨率</span>
                  <strong>{formatAttemptResolution(currentAttempt)}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>播放模式</span>
                  <strong>{currentAttempt.isCompatible ? '兼容流 durl/mp4' : 'DASH'}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>可用编码</span>
                  <strong>{availableCodecs.length ? availableCodecs.map((item) => getCodecLabel(item)).join(' / ') : '未返回'}</strong>
                </div>
              </div>
            </div>

            <div className="player-settings-drawer__section">
              <span className="player-settings-drawer__label">快捷操作</span>
              <div className="player-settings-drawer__actions">
                <FocusButton
                  row={3}
                  col={20}
                  variant="glass"
                  size="sm"
                  onClick={() => {
                    setPlaybackNotice('正在按当前策略重新加载');
                    void playerData.reload();
                  }}
                >
                  重新加载当前编码
                </FocusButton>
                <FocusButton
                  row={3}
                  col={21}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCodecPreference('auto');
                    setPlaybackNotice('已恢复自动策略，正在重新尝试');
                    setIsSettingsOpen(false);
                  }}
                >
                  恢复自动策略
                </FocusButton>
              </div>
            </div>

            <div className="player-settings-drawer__section">
              <span className="player-settings-drawer__label">回退顺序</span>
              <p className="player-settings-drawer__hint">
                {playbackPlan.attempts.map((attempt) => `${attempt.qualityLabel} ${attempt.codecLabel}`).join(' -> ')}
              </p>
            </div>
          </aside>
        ) : null}
      </section>

      <section className="content-section">
        <SectionHeader
          title="相关推荐"
          description="播放页继续沿用卡片体系，验证长链路的跳转与返回。"
          actionLabel={`默认策略 ${getCodecLabel(playbackPlan.effectivePreference)}`}
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

function queueFocus(selector: string) {
  window.setTimeout(() => {
    const element = document.querySelector<HTMLElement>(selector);
    element?.focus();
  }, 0);
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
