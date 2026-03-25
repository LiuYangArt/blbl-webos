import type { PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchHistoryPage } from '../../services/api/bilibili';
import { pickImageUrls } from '../shared/videoListLoading';
import { createDirectVideoListItem, mapHistoryItemToVideoCard } from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
import { PageStatus } from '../shared/PageStatus';
import { useVideoListPageLoading } from '../shared/useVideoListPageLoading';

type HistoryPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function HistoryPage({ onLogin, onOpenPlayer }: HistoryPageProps) {
  const { auth } = useAppStore();
  const history = usePagedCollection({
    deps: [auth.profile?.mid ?? 0],
    enabled: auth.status === 'authenticated' && Boolean(auth.profile),
    loadPage: (_page, cursor) => fetchHistoryPage({
      cursor,
      pageSize: 24,
      type: 'all',
    }),
    getItemKey: (item) => item.kid,
  });
  const historyReady = history.status === 'success';
  const showLoadingGate = useVideoListPageLoading({
    ready: historyReady,
    imageUrls: pickImageUrls(history.items, (item) => item.cover, 12),
    overlayVisible: history.status !== 'error' && auth.status === 'authenticated' && Boolean(auth.profile),
  });

  if (auth.status !== 'authenticated' || !auth.profile) {
    return (
      <PageStatus
        title="还没有登录"
        description="扫码成功后，这里会同步你的云端观看历史。"
        actionLabel="去扫码登录"
        onAction={onLogin}
      />
    );
  }

  if (history.status === 'error') {
    return (
      <PageStatus
        title="历史记录暂不可用"
        description={history.error}
        actionLabel="重新加载"
        onAction={() => {
          void history.reload();
        }}
      />
    );
  }

  if (showLoadingGate || history.status !== 'success') {
    return null;
  }

  const items = history.items;
  const videoItems = items.map((item) => createDirectVideoListItem(
    item.kid,
    mapHistoryItemToVideoCard(item),
    {
      aid: item.aid,
      bvid: item.bvid,
      cid: item.cid,
      title: item.title,
      part: item.part,
    },
  ));

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="history-list"
        title="观看历史"
        items={videoItems}
        onOpenPlayer={onOpenPlayer}
        visibilityMode="progressive"
        hasMore={history.hasMore}
        isLoadingMore={history.isLoadingMore}
        loadMoreError={history.loadMoreError}
        onRequestMore={() => void history.loadMore()}
      />
    </main>
  );
}
