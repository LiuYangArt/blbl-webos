import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { usePageBackHandler } from '../../app/PageBackHandler';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { FocusSection, captureFocus, focusById, focusSection, releaseFocus } from '../../platform/focus';
import { REMOTE_INTENT_EVENT, type RemoteIntentDetail } from '../../platform/remote';
import { isWebOSAvailable, readDeviceInfo } from '../../platform/webos';
import { fetchPlaySource, fetchRelatedVideos, fetchVideoDetail } from '../../services/api/bilibili';
import type {
  PlayAudioStream,
  PlaySource,
  VideoCodecPreference,
  VideoPart,
} from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';
import {
  buildPlaybackAttempts,
  buildPlayerCodecCapability,
  formatAttemptResolution,
  getAvailableCodecsForQuality,
  getCodecLabel,
  getReturnedCodecsForQuality,
} from './playerCodec';
import type { PlaybackAttempt, PlayerCodecCapability } from './playerCodec';
import { createDashManifestSource } from './playerDashManifest';
import { reportPlayerDebugEvent } from './playerDebug';
import {
  readPlayerCodecMemory,
  readPlayerSettings,
  writePlayerCodecPreference,
  writePlayerCodecResult,
} from './playerSettings';
import { createShakaPlayer, formatShakaError } from './playerShaka';

type PlayerNavigationTarget = {
  bvid: string;
  cid: number;
  title: string;
  part?: string;
};

type PlayerOverlayMode = 'none' | 'settings' | 'recommendations' | 'episodes';
type PlayerStripMode = Exclude<PlayerOverlayMode, 'none' | 'settings'>;

type PendingStripFocus = {
  sectionId: string;
  focusId: string;
};

type OverlayCaptureConfig = {
  sectionId: string;
  restoreTarget: string;
};

type StripOverlayConfig = OverlayCaptureConfig & {
  focusPrefix: string;
};

type PlayerPageProps = {
  bvid: string;
  cid: number;
  title: string;
  part?: string;
  onBack: () => void;
  onOpenPlayer: (item: PlayerNavigationTarget) => void;
};

const CODEC_OPTIONS: VideoCodecPreference[] = ['auto', 'avc', 'hevc', 'av1'];
const PLAYER_CHROME_HIDE_DELAY_MS = 3000;
const STRIP_PAGE_SIZE = 6;
const PLAYER_CONTROL_SECTION_ID = 'player-controls';
const PLAYER_SETTINGS_SECTION_ID = 'player-settings-drawer';
const PLAYER_RECOMMENDATIONS_SECTION_ID = 'player-recommendations-strip';
const PLAYER_EPISODES_SECTION_ID = 'player-episodes-strip';
const OVERLAY_CAPTURE_CONFIG: Record<Exclude<PlayerOverlayMode, 'none'>, OverlayCaptureConfig> = {
  settings: {
    sectionId: PLAYER_SETTINGS_SECTION_ID,
    restoreTarget: 'player-open-settings',
  },
  recommendations: {
    sectionId: PLAYER_RECOMMENDATIONS_SECTION_ID,
    restoreTarget: 'player-open-recommendations',
  },
  episodes: {
    sectionId: PLAYER_EPISODES_SECTION_ID,
    restoreTarget: 'player-open-episodes',
  },
};
const STRIP_OVERLAY_CONFIG: Record<PlayerStripMode, StripOverlayConfig> = {
  recommendations: {
    ...OVERLAY_CAPTURE_CONFIG.recommendations,
    focusPrefix: 'player-recommendation-slot',
  },
  episodes: {
    ...OVERLAY_CAPTURE_CONFIG.episodes,
    focusPrefix: 'player-episode-slot',
  },
};

export function PlayerPage({ bvid, cid, title, part, onBack, onOpenPlayer }: PlayerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPersistedProgressRef = useRef(-1);
  const resumeProgressRef = useRef(0);
  const savedProgressRef = useRef(0);
  const recordedAttemptIdRef = useRef('');
  const reportedEnvironmentKeyRef = useRef('');
  const chromeFocusTimeoutRef = useRef<number | null>(null);
  const [codecPreference, setCodecPreference] = useState<VideoCodecPreference>(() => readPlayerSettings().codecPreference);
  const [overlayMode, setOverlayMode] = useState<PlayerOverlayMode>('none');
  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [chromeActivityTick, setChromeActivityTick] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressView, setProgressView] = useState({ current: 0, duration: 0 });
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [recommendationPage, setRecommendationPage] = useState(0);
  const [episodePage, setEpisodePage] = useState(0);
  const [pendingStripFocus, setPendingStripFocus] = useState<PendingStripFocus | null>(null);
  const { setWatchProgress, watchProgress } = useAppStore();

  const playerData = useAsyncData(async () => {
    const [play, related, detail, deviceInfo] = await Promise.all([
      fetchPlaySource(bvid, cid),
      fetchRelatedVideos(bvid),
      fetchVideoDetail(bvid),
      readDeviceInfo(),
    ]);
    return {
      play,
      related,
      detail,
      deviceInfo,
      capability: buildPlayerCodecCapability(deviceInfo),
    };
  }, [bvid, cid]);

  const progressKey = `${bvid}:${cid}`;
  const savedProgress = watchProgress[progressKey];
  const playerDataValue = playerData.status === 'success' ? playerData.data : null;
  const play = playerDataValue?.play ?? null;
  const related = playerDataValue?.related ?? [];
  const detail = playerDataValue?.detail ?? null;
  const deviceInfo = playerDataValue?.deviceInfo ?? null;
  const capability = playerDataValue?.capability ?? null;
  const codecMemory = useMemo(() => (
    capability ? readPlayerCodecMemory(capability.deviceKey) : {
      lastSuccessfulCodec: null,
      lastFailedCodec: null,
    }
  ), [capability]);

  const episodeEntries = useMemo<VideoPart[]>(() => {
    if (!detail) {
      return [];
    }
    if (detail.parts.length > 0) {
      return detail.parts;
    }
    return [{
      cid: detail.cid,
      page: 1,
      part: '正片',
      duration: detail.duration,
    }];
  }, [detail]);

  const currentEpisodeIndex = episodeEntries.findIndex((entry) => entry.cid === cid);
  const currentEpisodePage = currentEpisodeIndex >= 0 ? Math.floor(currentEpisodeIndex / STRIP_PAGE_SIZE) : 0;

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
  const currentCandidate = currentAttempt?.candidates[activeCandidateIndex] ?? null;
  const currentSourceUrl = currentCandidate?.videoUrl ?? '';
  const currentCandidateHost = getUrlHost(currentSourceUrl);
  const declaredCodecs = useMemo(() => (
    play && currentAttempt ? getAvailableCodecsForQuality(play, currentAttempt.quality) : []
  ), [currentAttempt, play]);
  const returnedCodecs = useMemo(() => (
    play && currentAttempt ? getReturnedCodecsForQuality(play, currentAttempt.quality) : []
  ), [currentAttempt, play]);
  const selectableCodecs = useMemo(() => {
    const codecs = new Set<VideoCodecPreference>(['auto']);
    if (currentAttempt?.mode === 'compatible') {
      codecs.add('avc');
      return codecs;
    }

    for (const codec of returnedCodecs) {
      if (codec !== 'unknown') {
        codecs.add(codec);
      }
    }
    return codecs;
  }, [currentAttempt?.mode, returnedCodecs]);

  const recommendationPageCount = getPageCount(related.length, STRIP_PAGE_SIZE);
  const episodePageCount = getPageCount(episodeEntries.length, STRIP_PAGE_SIZE);
  const recommendationItems = getPagedItems(related, recommendationPage, STRIP_PAGE_SIZE);
  const episodeItems = getPagedItems(episodeEntries, episodePage, STRIP_PAGE_SIZE);
  const isWebOS = isWebOSAvailable();
  const engineLabel = currentAttempt?.mode === 'dash' ? 'Shaka Player + MSE' : 'HTML5 Video';
  const playbackModeLabel = currentAttempt?.mode === 'dash' ? 'App 内生成 DASH 清单' : '兼容流直连';
  const currentMimeType = currentAttempt?.videoStream?.mimeType ?? 'video/mp4';
  const shouldShowPlayerChrome = overlayMode === 'none' && isChromeVisible;

  const isSettingsOpen = overlayMode === 'settings';
  const isRecommendationsOpen = overlayMode === 'recommendations';
  const isEpisodesOpen = overlayMode === 'episodes';
  const overlayCaptureConfig = getOverlayCaptureConfig(overlayMode);

  function revealPlayerChrome(focusControls: boolean): void {
    setOverlayMode('none');
    setIsChromeVisible(true);
    setChromeActivityTick((previous) => previous + 1);

    if (!focusControls) {
      return;
    }

    if (chromeFocusTimeoutRef.current !== null) {
      window.clearTimeout(chromeFocusTimeoutRef.current);
    }

    chromeFocusTimeoutRef.current = window.setTimeout(() => {
      focusSection(PLAYER_CONTROL_SECTION_ID);
      chromeFocusTimeoutRef.current = null;
    }, 0);
  }

  function hidePlayerChrome(): void {
    setIsChromeVisible(false);
    blurPlayerChromeFocus();
  }

  function openSettingsOverlay(): void {
    setOverlayMode('settings');
    setIsChromeVisible(false);
  }

  function openRecommendationsOverlay(): void {
    openStripOverlay('recommendations', 0, 0);
  }

  function openEpisodesOverlay(): void {
    const targetPage = currentEpisodePage;
    const pageSize = getPageItemCount(episodeEntries.length, targetPage, STRIP_PAGE_SIZE);
    const preferredSlot = currentEpisodeIndex >= 0 ? currentEpisodeIndex % STRIP_PAGE_SIZE : 0;
    const targetSlot = Math.min(preferredSlot, Math.max(0, pageSize - 1));
    openStripOverlay('episodes', targetPage, targetSlot);
  }

  function closeOverlayToChrome(): void {
    setOverlayMode('none');
    setIsChromeVisible(true);
    setChromeActivityTick((previous) => previous + 1);
  }

  function openStripOverlay(mode: PlayerStripMode, page: number, slot: number): void {
    const config = STRIP_OVERLAY_CONFIG[mode];

    if (mode === 'recommendations') {
      setRecommendationPage(page);
    } else {
      setEpisodePage(page);
    }

    setPendingStripFocus({
      sectionId: config.sectionId,
      focusId: buildStripFocusId(config.focusPrefix, slot),
    });
    setOverlayMode(mode);
    setIsChromeVisible(false);
  }

  usePageBackHandler(() => {
    if (overlayMode !== 'none') {
      closeOverlayToChrome();
      return true;
    }

    if (shouldShowPlayerChrome) {
      hidePlayerChrome();
      return true;
    }

    onBack();
    return true;
  });

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
    setActiveCandidateIndex(0);
    setPlaybackError(null);
    setPlaybackNotice(playbackPlan.warning);
    setProgressView({ current: 0, duration: 0 });
    setReloadNonce(0);
    setOverlayMode('none');
    setIsChromeVisible(false);
    setChromeActivityTick(0);
    setRecommendationPage(0);
    setEpisodePage(0);
    setPendingStripFocus(null);
  }, [bvid, cid, playbackPlan.warning, currentAttempt?.id]);

  useEffect(() => {
    if (!overlayCaptureConfig) {
      return undefined;
    }

    captureFocus({
      sectionId: overlayCaptureConfig.sectionId,
      restoreTarget: overlayCaptureConfig.restoreTarget,
    });

    return () => {
      releaseFocus(overlayCaptureConfig.sectionId);
    };
  }, [overlayCaptureConfig]);

  useEffect(() => {
    if (!pendingStripFocus) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const focused = focusById(pendingStripFocus.focusId);
      if (!focused) {
        focusSection(pendingStripFocus.sectionId);
      }
      setPendingStripFocus(null);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [episodeItems, pendingStripFocus, recommendationItems]);

  useEffect(() => {
    const handleRemoteIntent = (event: Event) => {
      const remoteEvent = event as CustomEvent<RemoteIntentDetail>;
      const { action } = remoteEvent.detail;

      if (action === 'back') {
        return;
      }

      if (isRecommendationsOpen) {
        const handled = paginateStripByRemote({
          action,
          page: recommendationPage,
          totalItems: related.length,
          sectionId: STRIP_OVERLAY_CONFIG.recommendations.sectionId,
          focusPrefix: STRIP_OVERLAY_CONFIG.recommendations.focusPrefix,
          setPage: setRecommendationPage,
          setPendingFocus: setPendingStripFocus,
        });

        if (handled) {
          remoteEvent.preventDefault();
        }
        return;
      }

      if (isEpisodesOpen) {
        const handled = paginateStripByRemote({
          action,
          page: episodePage,
          totalItems: episodeEntries.length,
          sectionId: STRIP_OVERLAY_CONFIG.episodes.sectionId,
          focusPrefix: STRIP_OVERLAY_CONFIG.episodes.focusPrefix,
          setPage: setEpisodePage,
          setPendingFocus: setPendingStripFocus,
        });

        if (handled) {
          remoteEvent.preventDefault();
        }
        return;
      }

      if (overlayMode !== 'none') {
        return;
      }

      if (!shouldShowPlayerChrome) {
        revealPlayerChrome(true);
        remoteEvent.preventDefault();
        return;
      }

      setChromeActivityTick((previous) => previous + 1);
    };

    window.addEventListener(REMOTE_INTENT_EVENT, handleRemoteIntent as EventListener);
    return () => {
      window.removeEventListener(REMOTE_INTENT_EVENT, handleRemoteIntent as EventListener);
    };
  }, [
    episodeEntries.length,
    episodePage,
    isEpisodesOpen,
    isRecommendationsOpen,
    overlayMode,
    recommendationPage,
    related.length,
    shouldShowPlayerChrome,
  ]);

  useEffect(() => {
    if (!isPlaying || !isChromeVisible || overlayMode !== 'none' || playbackError) {
      return undefined;
    }

    const hideTimer = window.setTimeout(() => {
      hidePlayerChrome();
    }, PLAYER_CHROME_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [chromeActivityTick, isChromeVisible, isPlaying, overlayMode, playbackError]);

  useEffect(() => () => {
    if (chromeFocusTimeoutRef.current !== null) {
      window.clearTimeout(chromeFocusTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!play || !capability) {
      return;
    }

    const reportKey = buildEnvironmentReportKey({
      bvid,
      cid,
      capability,
      play,
    });
    if (reportedEnvironmentKeyRef.current === reportKey) {
      return;
    }
    reportedEnvironmentKeyRef.current = reportKey;

    reportPlayerDebugEvent({
      type: 'environment',
      bvid,
      cid,
      sourceUrl: '',
      quality: play.qualityLabel,
      codec: playbackPlan.attempts[0]?.codecLabel ?? getCodecLabel(codecPreference),
      sourceTypeLabel: playbackPlan.attempts[0]?.mode === 'dash' ? 'Shaka Player + MSE' : 'HTML5 Video',
      details: buildEnvironmentDetails(capability, deviceInfo, play, playbackPlan.attempts, playbackPlan.warning),
    });
  }, [bvid, capability, cid, codecPreference, deviceInfo, play, playbackPlan]);

  useEffect(() => {
    if (!play || !currentAttempt || !currentCandidate || !currentSourceUrl || !capability) {
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
    let progressReported = false;
    setPlaybackError(null);

    const getDebugSnapshot = () => ({
      currentTime: Math.floor(video.currentTime),
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      decodedVideoFrames: readDecodedVideoFrames(video),
      attemptId: currentAttempt.id,
      candidateUrlIndex: activeCandidateIndex,
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

      const nextCandidateIndex = activeCandidateIndex + 1;
      if (nextCandidateIndex < currentAttempt.candidates.length) {
        setPlaybackNotice(`当前地址不可用，正在切换备选线路 #${nextCandidateIndex + 1}`);
        setActiveCandidateIndex(nextCandidateIndex);
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
      setIsPlaying(false);
      setPlaybackError(message || fallbackMessage);
      setIsChromeVisible(true);
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
        setIsChromeVisible(true);
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

      if (!progressReported && current >= 2) {
        progressReported = true;
        reportPlayerDebugEvent({
          type: 'progress',
          bvid,
          cid,
          sourceUrl: currentSourceUrl,
          quality: currentAttempt.qualityLabel,
          codec: currentAttempt.codecLabel,
          mimeType: currentMimeType,
          sourceTypeLabel: engineLabel,
          ...getDebugSnapshot(),
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

    const handlePause = () => {
      setIsPlaying(false);
      setIsChromeVisible(true);
    };

    const handleVideoError = () => {
      const mediaError = video.error;
      finalizeFailure(mediaError?.message ?? '媒体播放失败', mediaError?.code ?? null);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleVideoError);

    reportPlayerDebugEvent({
      type: 'attempt-switch',
      bvid,
      cid,
      sourceUrl: currentSourceUrl,
      quality: currentAttempt.qualityLabel,
      codec: currentAttempt.codecLabel,
      mimeType: currentMimeType,
      sourceTypeLabel: engineLabel,
      message: `准备加载 ${currentAttempt.mode === 'dash' ? 'DASH' : '兼容流'} 候选 #${activeCandidateIndex + 1}`,
      ...getDebugSnapshot(),
    });

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
          videoUrl: currentCandidate.videoUrl,
          audioUrl: currentCandidate.audioUrl ?? undefined,
        });
        manifestRevoke = manifestSource.revoke;

        const shakaSession = await createShakaPlayer(video, (error) => {
          finalizeFailure(error.message, error.code);
        });
        destroyPlayer = () => shakaSession.destroy();
        await shakaSession.load(manifestSource.manifestUrl);
        return;
      }

      loadDirectVideoSource(video, currentCandidate.videoUrl);
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
    activeCandidateIndex,
    currentCandidate,
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
    return <PageStatus title="正在准备播放源" description="正在解析播放器全屏播放所需的数据和轨道。" />;
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
    <main className="player-page">
      <FocusSection
        as="section"
        id="player-shell"
        group="content"
        className={[
          'player-hero',
          shouldShowPlayerChrome ? 'player-hero--chrome-visible' : '',
          overlayMode !== 'none' ? 'player-hero--overlay-open' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="player-hero__video">
          <video
            ref={videoRef}
            className="player-video"
            controls={false}
            playsInline
            preload="auto"
          />
        </div>

        {shouldShowPlayerChrome ? (
          <>
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
                sectionId={PLAYER_CONTROL_SECTION_ID}
                disabled={!shouldShowPlayerChrome}
                isPlaying={isPlaying}
                onBack={onBack}
                onReplay={() => seekVideo(videoRef.current, -10)}
                onTogglePlay={() => {
                  togglePlay(videoRef.current);
                  setChromeActivityTick((previous) => previous + 1);
                }}
                onForward={() => seekVideo(videoRef.current, 10)}
                onRestartFromBeginning={() => {
                  restartVideo(videoRef.current);
                  setChromeActivityTick((previous) => previous + 1);
                }}
                onRefresh={() => {
                  const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                  resumeProgressRef.current = currentTime;
                  setPlaybackNotice('正在按当前策略重新加载播放器');
                  setActiveCandidateIndex(0);
                  setReloadNonce((previous) => previous + 1);
                  revealPlayerChrome(false);
                }}
                onOpenEpisodes={openEpisodesOverlay}
                onOpenSettings={openSettingsOverlay}
                onOpenRecommendations={openRecommendationsOverlay}
              />
            </div>
          </>
        ) : null}

        {isSettingsOpen ? (
          <FocusSection
            as="aside"
            id={PLAYER_SETTINGS_SECTION_ID}
            group="overlay"
            enterTo="default-element"
            className="player-settings-drawer"
          >
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
                    className={!selectableCodecs.has(option) ? 'focus-button--disabled' : undefined}
                    disabled={!selectableCodecs.has(option)}
                    variant={codecPreference === option ? 'primary' : 'ghost'}
                    size="sm"
                    sectionId={PLAYER_SETTINGS_SECTION_ID}
                    focusId={`player-codec-${option}`}
                    defaultFocus={(codecPreference === option && selectableCodecs.has(option)) || (index === 0 && !selectableCodecs.has(codecPreference))}
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
                      setActiveCandidateIndex(0);
                      setOverlayMode('none');
                      setIsChromeVisible(true);
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
                  <span>BV 号</span>
                  <strong>{bvid}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>CID</span>
                  <strong>{cid}</strong>
                </div>
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
                  <strong>{currentAttempt.candidates.length}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前候选</span>
                  <strong>{activeCandidateIndex + 1} / {currentAttempt.candidates.length}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>当前 Host</span>
                  <strong>{currentCandidateHost}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>实际返回编码</span>
                  <strong>{returnedCodecs.length ? returnedCodecs.map((item) => getCodecLabel(item)).join(' / ') : '未返回'}</strong>
                </div>
                <div className="player-settings-drawer__info-row">
                  <span>接口宣称编码</span>
                  <strong>{declaredCodecs.length ? declaredCodecs.map((item) => getCodecLabel(item)).join(' / ') : '未返回'}</strong>
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
                  variant="glass"
                  size="sm"
                  sectionId={PLAYER_SETTINGS_SECTION_ID}
                  focusId="player-reload-current-strategy"
                  onClick={() => {
                    const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                    resumeProgressRef.current = currentTime;
                    setPlaybackNotice('正在按当前策略重新加载');
                    setActiveCandidateIndex(0);
                    setOverlayMode('none');
                    setIsChromeVisible(true);
                    setReloadNonce((previous) => previous + 1);
                  }}
                >
                  重新加载当前策略
                </FocusButton>
                <FocusButton
                  variant="ghost"
                  size="sm"
                  sectionId={PLAYER_SETTINGS_SECTION_ID}
                  focusId="player-reset-auto-strategy"
                  onClick={() => {
                    const currentTime = Math.floor(videoRef.current?.currentTime ?? resumeProgressRef.current);
                    resumeProgressRef.current = currentTime;
                    setCodecPreference('auto');
                    setPlaybackNotice('已恢复自动策略，正在重新尝试');
                    setActiveCandidateIndex(0);
                    setOverlayMode('none');
                    setIsChromeVisible(true);
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
          </FocusSection>
        ) : null}

        {isRecommendationsOpen ? (
          <PlayerStripOverlay
            sectionId={STRIP_OVERLAY_CONFIG.recommendations.sectionId}
            defaultElement={buildStripFocusId(STRIP_OVERLAY_CONFIG.recommendations.focusPrefix, 0)}
            badge="推荐视频"
            title="按左右切换视频，按下翻到下一屏 6 个"
            meta={formatPageMeta(recommendationPage, recommendationPageCount, related.length)}
          >
            {recommendationItems.map((item, index) => (
              <MediaCard
                key={buildStripFocusId(STRIP_OVERLAY_CONFIG.recommendations.focusPrefix, index)}
                sectionId={STRIP_OVERLAY_CONFIG.recommendations.sectionId}
                focusId={buildStripFocusId(STRIP_OVERLAY_CONFIG.recommendations.focusPrefix, index)}
                defaultFocus={index === 0}
                item={item}
                onClick={() => onOpenPlayer({
                  bvid: item.bvid,
                  cid: item.cid,
                  title: item.title,
                })}
              />
            ))}
          </PlayerStripOverlay>
        ) : null}

        {isEpisodesOpen ? (
          <PlayerStripOverlay
            sectionId={STRIP_OVERLAY_CONFIG.episodes.sectionId}
            defaultElement={buildStripFocusId(STRIP_OVERLAY_CONFIG.episodes.focusPrefix, 0)}
            badge="分P / 选集"
            title="按左右切换分P，按下翻到下一屏 6 个"
            meta={formatPageMeta(episodePage, episodePageCount, episodeEntries.length)}
          >
            {episodeItems.map((entry, index) => {
              const isActiveEpisode = entry.cid === cid;
              return (
                <FocusButton
                  key={buildStripFocusId(STRIP_OVERLAY_CONFIG.episodes.focusPrefix, index)}
                  variant={isActiveEpisode ? 'primary' : 'glass'}
                  className="player-strip-card"
                  sectionId={STRIP_OVERLAY_CONFIG.episodes.sectionId}
                  focusId={buildStripFocusId(STRIP_OVERLAY_CONFIG.episodes.focusPrefix, index)}
                  defaultFocus={index === 0}
                  onClick={() => onOpenPlayer({
                    bvid,
                    cid: entry.cid,
                    title,
                    part: entry.part,
                  })}
                >
                  <span className="player-strip-card__eyebrow">
                    {isActiveEpisode ? '当前播放' : `P${entry.page}`}
                  </span>
                  <strong>{entry.part || `P${entry.page}`}</strong>
                  <small>{formatDurationText(entry.duration)}</small>
                </FocusButton>
              );
            })}
          </PlayerStripOverlay>
        ) : null}
      </FocusSection>
    </main>
  );
}

type PlayerStripOverlayProps = {
  sectionId: string;
  defaultElement: string;
  badge: string;
  title: string;
  meta: string;
  children: ReactNode;
};

function PlayerStripOverlay({
  sectionId,
  defaultElement,
  badge,
  title,
  meta,
  children,
}: PlayerStripOverlayProps) {
  return (
    <FocusSection
      as="aside"
      id={sectionId}
      group="overlay"
      enterTo="last-focused"
      defaultElement={defaultElement}
      className="player-strip"
    >
      <div className="player-strip__header">
        <div>
          <span className="player-hero__badge">{badge}</span>
          <h2>{title}</h2>
        </div>
        <p>{meta}</p>
      </div>
      <div className="player-strip__grid">{children}</div>
    </FocusSection>
  );
}

function blurPlayerChromeFocus(): void {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return;
  }

  if (activeElement.dataset.focusSection === PLAYER_CONTROL_SECTION_ID) {
    activeElement.blur();
  }
}

function getOverlayCaptureConfig(mode: PlayerOverlayMode): OverlayCaptureConfig | null {
  if (mode === 'none') {
    return null;
  }

  return OVERLAY_CAPTURE_CONFIG[mode];
}

function getPageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

function getPageItemCount(totalItems: number, page: number, pageSize: number): number {
  const start = page * pageSize;
  return Math.max(0, Math.min(pageSize, totalItems - start));
}

function getPagedItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

function buildStripFocusId(prefix: string, slot: number): string {
  return `${prefix}-${slot}`;
}

function getActiveStripSlot(sectionId: string): number {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || activeElement.dataset.focusSection !== sectionId) {
    return 0;
  }

  const focusId = activeElement.dataset.focusId ?? '';
  const match = focusId.match(/-(\d+)$/);
  const slot = match ? Number(match[1]) : 0;
  return Number.isFinite(slot) ? slot : 0;
}

function paginateStripByRemote(input: {
  action: RemoteIntentDetail['action'];
  page: number;
  totalItems: number;
  sectionId: string;
  focusPrefix: string;
  setPage: (nextPage: number) => void;
  setPendingFocus: (value: PendingStripFocus | null) => void;
}): boolean {
  if (input.action !== 'up' && input.action !== 'down') {
    return false;
  }

  const pageCount = getPageCount(input.totalItems, STRIP_PAGE_SIZE);
  const currentSlot = getActiveStripSlot(input.sectionId);
  const nextPage = input.action === 'down'
    ? Math.min(pageCount - 1, input.page + 1)
    : Math.max(0, input.page - 1);

  if (nextPage === input.page) {
    return true;
  }

  const nextPageItemCount = getPageItemCount(input.totalItems, nextPage, STRIP_PAGE_SIZE);
  const nextSlot = Math.min(currentSlot, Math.max(0, nextPageItemCount - 1));
  input.setPage(nextPage);
  input.setPendingFocus({
    sectionId: input.sectionId,
    focusId: buildStripFocusId(input.focusPrefix, nextSlot),
  });
  return true;
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
    return;
  }

  video.pause();
}

function restartVideo(video: HTMLVideoElement | null): void {
  if (!video) {
    return;
  }

  video.currentTime = 0;
  void video.play();
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

function formatDurationText(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '00:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPageMeta(page: number, pageCount: number, total: number): string {
  return `第 ${page + 1} / ${pageCount} 屏 · 共 ${total} 项`;
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

function getUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '未知';
  }
}

function buildEnvironmentReportKey(input: {
  bvid: string;
  cid: number;
  capability: PlayerCodecCapability;
  play: PlaySource;
}): string {
  return [
    input.bvid,
    input.cid,
    input.capability.deviceKey,
    input.capability.deviceClass,
    input.play.videoStreams.length,
    input.play.compatibleSources.length,
  ].join(':');
}

function buildEnvironmentDetails(
  capability: PlayerCodecCapability,
  deviceInfo: Record<string, unknown> | null,
  play: PlaySource,
  attempts: PlaybackAttempt[],
  warning: string | null,
) {
  return {
    capability,
    deviceInfo,
    userAgent: navigator.userAgent,
    playMode: play.mode,
    currentQuality: play.currentQuality,
    videoStreamCount: play.videoStreams.length,
    audioStreamCount: play.audioStreams.length,
    compatibleSourceCount: play.compatibleSources.length,
    compatibleSourceHosts: play.compatibleSources.map((source) => getUrlHost(source.url)),
    compatibleCandidateHosts: play.compatibleSources.flatMap((source) => source.candidateUrls.map(getUrlHost)),
    dashVideoHosts: play.videoStreams.flatMap((stream) => [stream.url, ...stream.backupUrls].map(getUrlHost)),
    playbackAttemptModes: attempts.map((attempt) => attempt.mode),
    playbackAttemptIds: attempts.map((attempt) => attempt.id),
    playbackWarning: warning,
  };
}
