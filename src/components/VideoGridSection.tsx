import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlayerRoutePayload } from '../app/routes';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../platform/focus';
import type { UnifiedVideoListItem } from '../features/shared/videoListItems';
import { FocusButton } from './FocusButton';
import { MediaCard } from './MediaCard';
import { SectionHeader } from './SectionHeader';

type LoadMoreTrigger = 'prefetch' | 'manual';
type VisibilityMode = 'loaded' | 'progressive';
const DEFAULT_REVEAL_FRAME_STEP = 6;

type VisibleResetSignature = {
  firstVisibleItemId: string | null;
  initialVisibleCount: number;
  resetKey: string | undefined;
  visibilityMode: VisibilityMode;
};

type VideoGridSectionProps = {
  sectionId: string;
  title: string;
  showHeader?: boolean;
  items: UnifiedVideoListItem[];
  onOpenPlayer: (item: PlayerRoutePayload) => void;
  beforeGrid?: ReactNode;
  emptyState?: ReactNode;
  leaveFor?: {
    left?: string;
    right?: string;
    up?: string;
    down?: string;
  };
  initialVisibleCount?: number;
  revealStep?: number;
  prefetchThreshold?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  loadMoreError?: string | null;
  onRequestMore?: (trigger: LoadMoreTrigger) => void;
  showEndHint?: boolean;
  resetKey?: string;
  visibilityMode?: VisibilityMode;
};

export function VideoGridSection({
  sectionId,
  title,
  showHeader = true,
  items,
  onOpenPlayer,
  beforeGrid,
  emptyState,
  leaveFor = { left: '@side-nav' },
  initialVisibleCount = 12,
  revealStep = 12,
  prefetchThreshold = 4,
  hasMore = false,
  isLoadingMore = false,
  loadMoreError = null,
  onRequestMore,
  showEndHint = true,
  resetKey,
  visibilityMode = 'loaded',
}: VideoGridSectionProps) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(items.length, initialVisibleCount));
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);
  const firstVisibleItemId = items[0]?.id ?? null;
  const previousResetSignatureRef = useRef<VisibleResetSignature | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  const visibleCountRef = useRef(visibleCount);
  const revealFrameStep = Math.min(revealStep, Math.max(1, Math.ceil(revealStep / 2), DEFAULT_REVEAL_FRAME_STEP));

  const stopRevealAnimation = useCallback(() => {
    if (revealFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(revealFrameRef.current);
    revealFrameRef.current = null;
  }, []);

  const commitVisibleCount = useCallback((nextCount: number) => {
    const clampedCount = clampVisibleCount(nextCount, items.length);
    stopRevealAnimation();
    visibleCountRef.current = clampedCount;
    setVisibleCount(clampedCount);
  }, [items.length, stopRevealAnimation]);

  const animateVisibleCountTo = useCallback((targetCount: number) => {
    const normalizedTarget = clampVisibleCount(targetCount, items.length);
    const currentVisibleCount = visibleCountRef.current;

    if (normalizedTarget <= currentVisibleCount) {
      commitVisibleCount(normalizedTarget);
      return;
    }

    if (normalizedTarget - currentVisibleCount <= revealFrameStep) {
      commitVisibleCount(normalizedTarget);
      return;
    }

    stopRevealAnimation();

    const advance = () => {
      const nextVisibleCount = Math.min(normalizedTarget, visibleCountRef.current + revealFrameStep);
      visibleCountRef.current = nextVisibleCount;
      setVisibleCount(nextVisibleCount);

      if (nextVisibleCount >= normalizedTarget) {
        revealFrameRef.current = null;
        return;
      }

      revealFrameRef.current = window.requestAnimationFrame(advance);
    };

    revealFrameRef.current = window.requestAnimationFrame(advance);
  }, [commitVisibleCount, items.length, revealFrameStep, stopRevealAnimation]);

  useEffect(() => {
    visibleCountRef.current = visibleCount;
  }, [visibleCount]);

  useEffect(() => {
    const previousSignature = previousResetSignatureRef.current;
    const nextSignature: VisibleResetSignature = {
      firstVisibleItemId,
      initialVisibleCount,
      resetKey,
      visibilityMode,
    };
    previousResetSignatureRef.current = nextSignature;

    if (visibilityMode === 'progressive') {
      if (isVisibleWindowResetRequired(previousSignature, nextSignature)) {
        commitVisibleCount(initialVisibleCount);
      } else {
        commitVisibleCount(visibleCountRef.current);
      }
    }
    setResolveError(null);
    setPendingTitle(null);
  }, [commitVisibleCount, firstVisibleItemId, initialVisibleCount, items.length, resetKey, visibilityMode]);

  useEffect(() => stopRevealAnimation, [stopRevealAnimation]);

  const visibleItems = useMemo(
    () => (visibilityMode === 'progressive' ? items.slice(0, visibleCount) : items),
    [items, visibilityMode, visibleCount],
  );
  const hasHiddenLocalItems = visibilityMode === 'progressive' && items.length > visibleCount;

  const revealOrRequestMore = useCallback((trigger: LoadMoreTrigger) => {
    if (hasHiddenLocalItems) {
      animateVisibleCountTo(visibleCountRef.current + revealStep);
      return;
    }

    if (!hasMore || !onRequestMore || isLoadingMore) {
      return;
    }

    if (trigger === 'prefetch' && loadMoreError) {
      return;
    }

    onRequestMore(trigger);
  }, [
    animateVisibleCountTo,
    hasHiddenLocalItems,
    hasMore,
    isLoadingMore,
    loadMoreError,
    onRequestMore,
    revealStep,
  ]);

  const openPlayer = useCallback(async (item: UnifiedVideoListItem) => {
    setResolveError(null);
    setPendingTitle(item.card.title);

    try {
      const payload = await item.resolvePlayer();
      onOpenPlayer(payload);
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : '补全视频播放信息失败');
    } finally {
      setPendingTitle(null);
    }
  }, [onOpenPlayer]);

  return (
    <FocusSection
      as="section"
      id={sectionId}
      group="content"
      enterTo="last-focused"
      className="content-section"
      leaveFor={leaveFor}
      scroll={CONTENT_FIRST_ROW_SCROLL}
    >
      {showHeader ? <SectionHeader title={title} /> : null}
      {beforeGrid}
      {resolveError ? <p className="page-helper-text">{resolveError}</p> : null}
      {visibleItems.length > 0 ? (
        <div className="media-grid">
          {visibleItems.map((item, index) => (
            <VideoGridCard
              key={item.id}
              item={item}
              index={index}
              sectionId={sectionId}
              defaultFocus={index === 0}
              visibleItemsLength={visibleItems.length}
              prefetchThreshold={prefetchThreshold}
              onPrefetch={revealOrRequestMore}
              onOpenPlayer={openPlayer}
            />
          ))}
        </div>
      ) : (
        emptyState ?? <p className="page-helper-text">当前还没有可展示的视频内容。</p>
      )}

      {pendingTitle ? <p className="page-helper-text">正在补全播放信息：{pendingTitle}</p> : null}
      {isLoadingMore ? <p className="page-helper-text">正在加载更多内容...</p> : null}
      {!isLoadingMore && loadMoreError ? (
        <div className="page-inline-actions">
          <FocusButton
            variant="ghost"
            size="sm"
            className="page-inline-link"
            sectionId={sectionId}
            focusId={`${sectionId}-retry-load-more`}
            onClick={() => revealOrRequestMore('manual')}
          >
            重试加载更多
          </FocusButton>
        </div>
      ) : null}
      {!hasHiddenLocalItems && !hasMore && !isLoadingMore && visibleItems.length > 0 && showEndHint ? (
        <p className="page-helper-text">已经到底了，稍后再来刷新内容。</p>
      ) : null}
    </FocusSection>
  );
}

function isVisibleWindowResetRequired(
  previous: VisibleResetSignature | null,
  next: VisibleResetSignature,
): boolean {
  if (!previous) {
    return true;
  }

  return previous.firstVisibleItemId !== next.firstVisibleItemId
    || previous.initialVisibleCount !== next.initialVisibleCount
    || previous.resetKey !== next.resetKey
    || previous.visibilityMode !== next.visibilityMode;
}

function clampVisibleCount(count: number, total: number): number {
  return Math.min(total, count);
}

type VideoGridCardProps = {
  item: UnifiedVideoListItem;
  index: number;
  sectionId: string;
  defaultFocus: boolean;
  visibleItemsLength: number;
  prefetchThreshold: number;
  onPrefetch: (trigger: LoadMoreTrigger) => void;
  onOpenPlayer: (item: UnifiedVideoListItem) => Promise<void>;
};

const VideoGridCard = memo(function VideoGridCard({
  item,
  index,
  sectionId,
  defaultFocus,
  visibleItemsLength,
  prefetchThreshold,
  onPrefetch,
  onOpenPlayer,
}: VideoGridCardProps) {
  const shouldPrefetchOnFocus = index >= visibleItemsLength - prefetchThreshold;
  const imageLoading = index < DEFAULT_REVEAL_FRAME_STEP ? 'eager' : 'lazy';

  const handleFocus = useCallback(() => {
    if (shouldPrefetchOnFocus) {
      onPrefetch('prefetch');
    }
  }, [onPrefetch, shouldPrefetchOnFocus]);

  const handleClick = useCallback(() => {
    void onOpenPlayer(item);
  }, [item, onOpenPlayer]);

  return (
    <MediaCard
      sectionId={sectionId}
      focusId={`${sectionId}-item-${index}`}
      defaultFocus={defaultFocus}
      item={item.card}
      imageLoading={imageLoading}
      onFocus={handleFocus}
      onClick={handleClick}
    />
  );
}, areVideoGridCardPropsEqual);

function areVideoGridCardPropsEqual(previous: VideoGridCardProps, next: VideoGridCardProps): boolean {
  return previous.item === next.item
    && previous.index === next.index
    && previous.sectionId === next.sectionId
    && previous.defaultFocus === next.defaultFocus
    && previous.visibleItemsLength === next.visibleItemsLength
    && previous.prefetchThreshold === next.prefetchThreshold
    && previous.onPrefetch === next.onPrefetch
    && previous.onOpenPlayer === next.onOpenPlayer;
}
