import { useAppStore } from '../../app/AppStore';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchPgcSubscriptions } from '../../services/api/bilibili';
import type { PlayerRoutePayload } from '../../app/routes';
import {
  createResolvedVideoListItem,
  mapPgcSubscriptionToVideoCard,
  resolvePgcSubscriptionPlayerPayload,
} from '../shared/videoListItems';
import { PageStatus } from '../shared/PageStatus';

type SubscriptionsPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function SubscriptionsPage({ onLogin, onOpenPlayer }: SubscriptionsPageProps) {
  const { auth } = useAppStore();
  const viewerMid = auth.profile?.mid ?? 0;

  const subscriptions = useAsyncData(async () => {
    if (!viewerMid) {
      return [];
    }

    const [anime, cinema] = await Promise.all([
      fetchPgcSubscriptions('anime', viewerMid),
      fetchPgcSubscriptions('cinema', viewerMid),
    ]);

    return [...anime, ...cinema];
  }, [viewerMid]);

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

  const items = subscriptions.data.map((item) => createResolvedVideoListItem(
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
