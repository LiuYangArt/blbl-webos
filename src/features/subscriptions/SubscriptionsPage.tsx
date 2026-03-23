import { useAppStore } from '../../app/AppStore';
import { FocusButton } from '../../components/FocusButton';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchPgcSubscriptions } from '../../services/api/bilibili';
import type { PlayerRoutePayload } from '../../app/routes';
import {
  createResolvedVideoListItem,
  mapPgcSubscriptionToVideoCard,
  resolvePgcSubscriptionPlayerPayload,
} from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
import { PageStatus } from '../shared/PageStatus';

type SubscriptionsPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function SubscriptionsPage({ onLogin, onOpenPlayer }: SubscriptionsPageProps) {
  const { auth } = useAppStore();
  const viewerMid = auth.profile?.mid ?? 0;
  const subscriptions = usePagedCollection({
    deps: [viewerMid],
    enabled: viewerMid > 0,
    loadPage: async (page) => {
      const [anime, cinema] = await Promise.all([
        fetchPgcSubscriptions('anime', viewerMid, page, 12),
        fetchPgcSubscriptions('cinema', viewerMid, page, 12),
      ]);

      return [...anime, ...cinema];
    },
    getItemKey: (item) => `${item.seasonKind}:${item.seasonId}`,
  });

  if (auth.status !== 'authenticated' || !auth.profile) {
    return (
      <PageStatus
        title="还没有登录"
        description="扫码成功后，这里会展示你最近追番和追剧的订阅内容。"
        actionLabel="去扫码登录"
        onAction={onLogin}
      />
    );
  }

  if (subscriptions.status !== 'success') {
    if (subscriptions.status === 'error') {
      return (
        <PageStatus
          title="订阅剧集暂时不可用"
          description={subscriptions.error}
          actionLabel="重新加载订阅"
          onAction={() => void subscriptions.reload()}
        />
      );
    }
    return <PageStatus title="正在同步订阅剧集" description="准备最近追番和最近追剧列表。" />;
  }

  const items = subscriptions.items.map((item) => createResolvedVideoListItem(
    `${item.seasonKind}:${item.seasonId}`,
    mapPgcSubscriptionToVideoCard(item),
    () => resolvePgcSubscriptionPlayerPayload(item),
  ));

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="subscriptions-grid"
        title="订阅剧集"
        description="统一改为订阅卡片点击即播，番剧和影视共用同一套列表模板。"
        actionLabel={`${items.length} 条`}
        items={items}
        onOpenPlayer={onOpenPlayer}
        hasMore={subscriptions.hasMore}
        isLoadingMore={subscriptions.isLoadingMore}
        loadMoreError={subscriptions.loadMoreError}
        onRequestMore={() => void subscriptions.loadMore()}
        emptyState={(
          <div className="page-inline-actions">
            <FocusButton
              variant="ghost"
              size="sm"
              className="page-inline-link"
              sectionId="subscriptions-grid"
              focusId="subscriptions-empty"
              defaultFocus
              onClick={() => void subscriptions.reload()}
            >
              当前还没有订阅内容，按确认可重试
            </FocusButton>
          </div>
        )}
      />
    </main>
  );
}
