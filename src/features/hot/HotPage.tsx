import type { PlayerRoutePayload } from '../../app/routes';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchPopularVideos } from '../../services/api/bilibili';
import { pickImageUrls } from '../shared/videoListLoading';
import { createResolvedVideoListItem, resolveVideoPlayerPayload } from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
import { PageStatus } from '../shared/PageStatus';
import { useVideoListPageLoading } from '../shared/useVideoListPageLoading';

type HotPageProps = {
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function HotPage({ onOpenPlayer }: HotPageProps) {
  const hot = usePagedCollection({
    deps: [],
    loadPage: (page) => fetchPopularVideos(page, 24),
    getItemKey: (item) => `${item.bvid}:${item.cid}`,
  });
  const hotReady = hot.status === 'success';
  const showLoadingGate = useVideoListPageLoading({
    ready: hotReady,
    imageUrls: pickImageUrls(hot.items, (item) => item.cover, 12),
    overlayVisible: hot.status !== 'error',
  });

  if (hot.status === 'error') {
    return (
      <PageStatus
        title="热门页加载失败"
        description={hot.error}
        actionLabel="重试热门页"
        onAction={() => void hot.reload()}
      />
    );
  }

  if (showLoadingGate || hot.status !== 'success') {
    return null;
  }

  const items = hot.items;
  const videoItems = items.map((item) => createResolvedVideoListItem(
    item.bvid,
    item,
    () => resolveVideoPlayerPayload(item),
  ));

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="hot-grid"
        title="热门精选"
        items={videoItems}
        onOpenPlayer={onOpenPlayer}
        visibilityMode="progressive"
        hasMore={hot.hasMore}
        isLoadingMore={hot.isLoadingMore}
        loadMoreError={hot.loadMoreError}
        onRequestMore={() => void hot.loadMore()}
      />
    </main>
  );
}
