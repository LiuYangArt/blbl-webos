import { useEffect } from 'react';
import { useAppStore } from '../../app/AppStore';
import { useAsyncData } from '../../app/useAsyncData';
import { FollowingSummaryChips } from '../../components/FollowingSummaryChips';
import { FocusButton } from '../../components/FocusButton';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchFollowingChannelData, fetchFollowingFeedPage } from '../../services/api/bilibili';
import type { PlayerRoutePayload } from '../../app/routes';
import { pickImageUrls } from '../shared/videoListLoading';
import { createResolvedVideoListItem, mapFollowItemToVideoCard, resolveVideoPlayerPayload } from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
import { PageStatus } from '../shared/PageStatus';
import { appendRuntimeDiagnostic } from '../../services/debug/runtimeDiagnostics';
import { useVideoListPageLoading } from '../shared/useVideoListPageLoading';

type FollowingPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function FollowingPage({ onLogin, onOpenPlayer }: FollowingPageProps) {
  const { auth } = useAppStore();
  const followingSummary = useAsyncData(async () => fetchFollowingChannelData(12), []);
  const followingItems = usePagedCollection({
    deps: [],
    loadPage: (_page, cursor) => fetchFollowingFeedPage({
      offset: cursor,
      limit: 24,
    }),
    getItemKey: (item) => item.id,
  });
  const followingReady = followingSummary.status === 'success' && followingItems.status === 'success';
  const showLoadingGate = useVideoListPageLoading({
    ready: followingReady,
    imageUrls: pickImageUrls(followingItems.items, (item) => item.cover, 12),
    overlayVisible: followingSummary.status !== 'error'
      && followingItems.status !== 'error'
      && auth.status === 'authenticated'
      && Boolean(auth.profile),
  });

  useEffect(() => {
    appendRuntimeDiagnostic('following-feed', 'collection-state', {
      status: followingItems.status,
      itemCount: followingItems.items.length,
      currentPage: followingItems.currentPage,
      hasMore: followingItems.hasMore,
      isLoadingMore: followingItems.isLoadingMore,
      loadMoreError: followingItems.loadMoreError,
      cursor: followingItems.cursor,
    });
  }, [
    followingItems.status,
    followingItems.items.length,
    followingItems.currentPage,
    followingItems.hasMore,
    followingItems.isLoadingMore,
    followingItems.loadMoreError,
    followingItems.cursor,
  ]);

  const reloadFollowing = () => {
    void followingSummary.reload();
    void followingItems.reload();
  };

  if (auth.status !== 'authenticated' || !auth.profile) {
    return (
      <PageStatus
        title="还没有登录"
        description="扫码成功后，这里会集中展示你关注区最近更新的视频内容。"
        actionLabel="去扫码登录"
        onAction={onLogin}
      />
    );
  }

  if (followingSummary.status === 'error' || followingItems.status === 'error') {
    const error = followingSummary.status === 'error'
      ? followingSummary.error
      : followingItems.error ?? '关注区加载失败';
    return (
      <PageStatus
        title="关注动态暂时不可用"
        description={error}
        actionLabel="重新加载关注区"
        onAction={reloadFollowing}
      />
    );
  }

  if (showLoadingGate || !followingReady) {
    return null;
  }

  const data = followingSummary.data;
  const items = followingItems.items.map((item) => createResolvedVideoListItem(
    item.id,
    mapFollowItemToVideoCard(item),
    () => resolveVideoPlayerPayload({
      bvid: item.bvid,
      title: item.title,
    }),
  ));
  const followingSummaryChips = data.accounts.length > 0 ? (
    <FollowingSummaryChips
      items={data.accounts.map((account) => ({
        key: account.mid,
        label: account.name,
        active: account.hasUpdate,
      }))}
    />
  ) : undefined;
  const requestMoreFollowing = (trigger: 'prefetch' | 'manual') => {
    appendRuntimeDiagnostic('following-feed', 'request-more', {
      trigger,
      itemCount: followingItems.items.length,
      currentPage: followingItems.currentPage,
      hasMore: followingItems.hasMore,
      isLoadingMore: followingItems.isLoadingMore,
      cursor: followingItems.cursor,
    });
    void followingItems.loadMore();
  };

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="following-grid"
        title="正在关注"
        items={items}
        onOpenPlayer={onOpenPlayer}
        visibilityMode="progressive"
        hasMore={followingItems.hasMore}
        isLoadingMore={followingItems.isLoadingMore}
        loadMoreError={followingItems.loadMoreError}
        onRequestMore={requestMoreFollowing}
        beforeGrid={followingSummaryChips}
        emptyState={(
          <div className="page-inline-actions">
            <FocusButton
              variant="ghost"
              size="sm"
              className="page-inline-link"
              sectionId="following-grid"
              focusId="following-empty-reload"
              defaultFocus
              onClick={reloadFollowing}
            >
              关注区暂时没有可展示的视频，按确认可重试
            </FocusButton>
          </div>
        )}
      />
    </main>
  );
}
