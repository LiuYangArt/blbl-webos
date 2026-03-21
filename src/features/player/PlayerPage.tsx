import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { usePageBackHandler } from '../../app/PageBackHandler';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { SectionHeader } from '../../components/SectionHeader';
import { isWebOSAvailable, readDeviceInfo } from '../../platform/webos';
import { fetchPlaySource, fetchRelatedVideos } from '../../services/api/bilibili';
import type { PlayAudioStream, VideoCodecPreference } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';
import {
  buildPlaybackAttempts,
  buildPlayerCodecCapability,
  formatAttemptResolution,
  getAvailableCodecsForQuality,
  getCodecLabel,
} from './playerCodec';
import { createDashManifestSource } from './playerDashManifest';
import { reportPlayerDebugEvent } from './playerDebug';
import {
  readPlayerCodecMemory,
  readPlayerSettings,
  writePlayerCodecPreference,
  writePlayerCodecResult,
} from './playerSettings';
import { createShakaPlayer, formatShakaError } from './playerShaka';

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
  const [activeCandidateUrlIndex, setActiveCandidateUrlIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
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

  const currentAttempt = playbackPlan.attempts[0] ?? null;
  const currentSourceUrl = currentAttempt?.candidateUrls[activeCandidateUrlIndex] ?? '';
  const availableCodecs = play && currentAttempt ? getAvailableCodecsForQuality(play, currentAttempt.quality) : [];
  const isWebOS = isWebOSAvailable();
  const engineLabel = currentAttempt?.mode === 'dash' ? 'Shaka Player + MSE' : 'HTML5 Video';
  const playbackModeLabel = currentAttempt?.mode === 'dash' ? 'App 内生成 DASH 清单' : '兼容流直连';
  const currentMimeType = currentAttempt?.videoStream?.mimeType ?? 'video/mp4';
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
    setActiveCandidateUrlIndex(0);
    setPlaybackError(null);
    setPlaybackNotice(playbackPlan.warning);
    setProgressView({ current: 0, duration: 0 });
    setReloadNonce(0);
  }, [bvid, cid, playbackPlan.warning, currentAttempt?.id]);

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
    let failed = false;
    let manifestRevoke: (() => void) | null = null;
    let destroyPlayer: (() => Promise<void>) | null = null;
    setPlaybackError(null);

    const getDebugSnapshot = () => ({
      currentTime: Math.floor(video.currentTime),
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      decodedVideoFrames: readDecodedVideoFrames(video),
      attemptId: currentAttempt.id,
      candidateUrlIndex: activeCandidateUrlIndex,
    });

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

    const finalizeFailure = (message: string, code: number | null = null) => {
      if (cancelled || failed) {
        return;
      }
      failed = true;

      const nextResumePoint = Math.floor(video.currentTime || resumeProgressRef.current);
      resumeProgressRef.current = nextResumePoint;

      const nextUrlIndex = activeCandidateUrlIndex + 1;
      if (nextUrlIndex < currentAttempt.candidateUrls.length) {
        setPlaybackNotice(`当前地址不可用，正在切换备选线路 #${nextUrlIndex + 1}`);
        setActiveCandidateUrlIndex(nextUrlIndex);
        failed = false;
        return;
      }

      writePlayerCodecResult(capability.deviceKey, {
        lastFailedCodec: currentAttempt.codec,
      });

      reportPlayerDebugEvent({
        type: 'error',
        bvid,
        cid,
        sourceUrl: currentSourceUrl,
        quality: currentAttempt.qualityLabel,
        codec: currentAttempt.codecLabel,
        mimeType: currentMimeType,
        sourceTypeLabel: engineLabel,
        message,
        code,
        ...getDebugSnapshot(),
      });

      const fallbackMessage = currentAttempt.mode === 'dash'
        ? '当前 DASH 线路在此设备上未能稳定播放，请优先尝试 AVC 编码。'
        : '当前兼容流暂时无法播放，请稍后重试。';
      setPlaybackError(message || fallbackMessage);
    };

    const handleLoadedMetadata = () => {
      reportPlayerDebugEvent({
        type: 'loadedmetadata',
        bvid,
        cid,
        sourceUrl: currentSourceUrl,
        quality: currentAttempt.qualityLabel,
        codec: currentAttempt.codecLabel,
        mimeType: currentMimeType,
        sourceTypeLabel: engineLabel,
        ...getDebugSnapshot(),
      });

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
      resumeProgressRef.current = current;

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

    const handlePlay = () => {
      setIsPlaying(true);
      markAttemptSuccess();
      reportPlayerDebugEvent({
        type: 'play',
        bvid,
        cid,
        sourceUrl: currentSourceUrl,
        quality: currentAttempt.qualityLabel,
        codec: currentAttempt.codecLabel,
        mimeType: currentMimeType,
        sourceTypeLabel: engineLabel,
        ...getDebugSnapshot(),
      });
    };

    const handlePause = () => setIsPlaying(false);

    const handleVideoError = () => {
      const mediaError = video.error;
      finalizeFailure(mediaError?.message ?? '媒体播放失败', mediaError?.code ?? null);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleVideoError);

    const bootPlayer = async () => {
      resetVideoElement(video);

      if (currentAttempt.mode === 'dash') {
        if (!currentAttempt.videoStream) {
          finalizeFailure('当前 DASH 视频轨为空，无法开始播放。');
          return;
        }

        const manifestSource = createDashManifestSource({
          durationMs: play.durationMs,
          videoStream: currentAttempt.videoStream,
          audioStream: currentAttempt.audioStream,
          videoUrl: currentSourceUrl,
          audioUrl: currentAttempt.audioStream?.url,
        });
        manifestRevoke = manifestSource.revoke;

        const shakaSession = await createShakaPlayer(video, (error) => {
          finalizeFailure(error.message, error.code);
        });
        destroyPlayer = () => shakaSession.destroy();
        await shakaSession.load(manifestSource.manifestUrl);
        return;
      }

      loadDirectVideoSource(video, currentSourceUrl);
    };

    void bootPlayer().catch((error) => {
      const shakaError = formatShakaError(error);
      finalizeFailure(shakaError.message, shakaError.code);
    });

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleVideoError);
      video.pause();
      if (destroyPlayer) {
        void destroyPlayer();
      }
      manifestRevoke?.();
    };
  }, [
    activeCandidateUrlIndex,
    bvid,
    capability,
    cid,
    currentAttempt,
    currentMimeType,
    currentSourceUrl,
    engineLabel,
    play,
    reloadNonce,
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
    return <PageStatus title="正在准备播放源" description="正在解析 DASH 轨道、编码信息和相关推荐。" />;
  }

  if (!currentAttempt) {
    return (
      <PageStatus
        title="暂无可用播放线路"
        description="当前没有可直接用于电视端的播放轨道，请稍后重试。"
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
              {currentAttempt.mode === 'dash' ? 'DASH' : '兼容流'}
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
              const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
              resumeProgressRef.current = currentTime;
              setPlaybackNotice('正在按当前策略重新加载播放器');
              setActiveCandidateUrlIndex(0);
              setReloadNonce((previous) => previous + 1);
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
                      const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                      resumeProgressRef.current = currentTime;
                      const previewPlan = play && capability
                        ? buildPlaybackAttempts(play, option, capability, codecMemory)
                        : null;
                      const effectivePreference = previewPlan?.effectivePreference ?? option;
                      setCodecPreference(effectivePreference);
                      setPlaybackNotice(
                        previewPlan?.warning
                          ?? `已切换到 ${getCodecLabel(effectivePreference)} 策略，正在重载播放器`,
                      );
                      setActiveCandidateUrlIndex(0);
                      setIsSettingsOpen(false);
                      setReloadNonce((previous) => previous + 1);
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
                  <span>编码偏好</span>
                  <strong>{getCodecLabel(codecPreference)}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前执行策略</span>
                  <strong>{getCodecLabel(playbackPlan.effectivePreference)}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前执行 codec</span>
                  <strong>{currentAttempt.codecLabel}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前分辨率</span>
                  <strong>{formatAttemptResolution(currentAttempt)}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>播放模式</span>
                  <strong>{playbackModeLabel}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>播放引擎</span>
                  <strong>{engineLabel}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>视频 MIME</span>
                  <strong>{currentMimeType}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>音频轨</span>
                  <strong>{formatAudioStreamLabel(currentAttempt.audioStream)}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>可切换地址</span>
                  <strong>{currentAttempt.candidateUrls.length}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>接口可选编码</span>
                  <strong>{availableCodecs.length ? availableCodecs.map((item) => getCodecLabel(item)).join(' / ') : '未返回'}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>运行环境</span>
                  <strong>{isWebOS ? 'webOS TV' : '浏览器开发环境'}</strong>
                </div>
              </div>
              {currentAttempt.codecNote ? (
                <p className="player-settings-drawer__hint">{currentAttempt.codecNote}</p>
              ) : null}
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
                    const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                    resumeProgressRef.current = currentTime;
                    setPlaybackNotice('正在按当前策略重新加载');
                    setActiveCandidateUrlIndex(0);
                    setReloadNonce((previous) => previous + 1);
                  }}
                >
                  重新加载当前策略
                </FocusButton>
                <FocusButton
                  row={3}
                  col={21}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                    resumeProgressRef.current = currentTime;
                    setCodecPreference('auto');
                    setPlaybackNotice('已恢复自动策略，正在重新尝试');
                    setActiveCandidateUrlIndex(0);
                    setIsSettingsOpen(false);
                    setReloadNonce((previous) => previous + 1);
                  }}
                >
                  恢复自动策略
                </FocusButton>
              </div>
            </div>

            <div className="player-settings-drawer__section">
              <span className="player-settings-drawer__label">当前候选顺序</span>
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
          description="播放器已经切到电视端自包含播放链路，下面继续验证页面跳转与返回。"
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

function queueFocus(selector: string): void {
  window.setTimeout(() => {
    const element = document.querySelector<HTMLElement>(selector);
    element?.focus();
  }, 0);
}

function getDurationSeconds(video: HTMLVideoElement, durationMs: number): number {
  return Math.floor(video.duration || durationMs / 1000);
}

function togglePlay(video: HTMLVideoElement | null): void {
  if (!video) {
    return;
  }
  if (video.paused) {
    void video.play();
  } else {
    video.pause();
  }
}

function seekVideo(video: HTMLVideoElement | null, seconds: number): void {
  if (!video || !video.duration) {
    return;
  }
  const nextTime = Math.min(video.duration, Math.max(0, video.currentTime + seconds));
  video.currentTime = nextTime;
}

function formatSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function loadDirectVideoSource(video: HTMLVideoElement, sourceUrl: string): void {
  resetVideoElement(video);
  const sourceNode = document.createElement('source');
  sourceNode.setAttribute('src', sourceUrl);
  sourceNode.setAttribute('type', 'video/mp4');
  video.appendChild(sourceNode);
  video.load();
}

function resetVideoElement(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute('src');
  while (video.firstChild) {
    video.removeChild(video.firstChild);
  }
  video.load();
}

function readDecodedVideoFrames(video: HTMLVideoElement): number | null {
  const quality = (video as HTMLVideoElement & {
    getVideoPlaybackQuality?: () => { totalVideoFrames: number };
    webkitDecodedFrameCount?: number;
  }).getVideoPlaybackQuality?.();
  if (quality) {
    return quality.totalVideoFrames;
  }

  const frameCount = (video as HTMLVideoElement & { webkitDecodedFrameCount?: number }).webkitDecodedFrameCount;
  return typeof frameCount === 'number' ? frameCount : null;
}

function formatAudioStreamLabel(audioStream: PlayAudioStream | null): string {
  if (!audioStream) {
    return '未提供独立音频轨';
  }

  const codecs = audioStream.codecs.toLowerCase();
  if (codecs.includes('mp4a')) {
    return 'AAC';
  }
  if (codecs.includes('ec-3') || codecs.includes('eac3')) {
    return 'E-AC3';
  }
  if (codecs.includes('flac')) {
    return 'FLAC';
  }
  return audioStream.codecs || '未知音频';
}
