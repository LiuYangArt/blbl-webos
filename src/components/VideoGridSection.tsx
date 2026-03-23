import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { PlayerRoutePayload } from '../app/routes';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../platform/focus';
import type { UnifiedVideoListItem } from '../features/shared/videoListItems';
import { FocusButton } from './FocusButton';
import { MediaCard } from './MediaCard';
import { SectionHeader } from './SectionHeader';

type LoadMoreTrigger = 'prefetch' | 'manual';

type VideoGridSectionProps = {
  sectionId: string;
  title: string;
  description?: string;
  actionLabel?: string;
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
  visibilityMode?: 'loaded' | 'progressive';
};

export function VideoGridSection({
  sectionId,
  title,
  description,
  actionLabel,
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

  useEffect(() => {
    if (visibilityMode === 'progressive') {
      setVisibleCount(Math.min(items.length, initialVisibleCount));
    }
    setResolveError(null);
    setPendingTitle(null);
  }, [firstVisibleItemId, initialVisibleCount, items.length, resetKey, visibilityMode]);

  const visibleItems = useMemo(
    () => (visibilityMode === 'progressive' ? items.slice(0, visibleCount) : items),
    [items, visibilityMode, visibleCount],
  );
  const hasHiddenLocalItems = visibilityMode === 'progressive' && items.length > visibleCount;

  const revealOrRequestMore = (trigger: LoadMoreTrigger) => {
    if (hasHiddenLocalItems) {
      setVisibleCount((current) => Math.min(items.length, current + revealStep));
      return;
    }

    if (!hasMore || !onRequestMore || isLoadingMore) {
      return;
    }

    if (trigger === 'prefetch' && loadMoreError) {
      return;
    }

    onRequestMore(trigger);
  };

  const openPlayer = async (item: UnifiedVideoListItem) => {
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
  };

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
      <SectionHeader
        title={title}
        description={description}
        actionLabel={actionLabel}
      />
      {beforeGrid}
      {resolveError ? <p className="page-helper-text">{resolveError}</p> : null}
      {visibleItems.length > 0 ? (
        <div className="media-grid">
          {visibleItems.map((item, index) => (
            <MediaCard
              key={item.id}
              sectionId={sectionId}
              focusId={`${sectionId}-item-${index}`}
              defaultFocus={index === 0}
              item={item.card}
              onFocus={() => {
                if (index >= visibleItems.length - prefetchThreshold) {
                  revealOrRequestMore('prefetch');
                }
              }}
              onClick={() => void openPlayer(item)}
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
