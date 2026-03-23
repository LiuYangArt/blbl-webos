import { useAppStore } from '../../app/AppStore';
import type { PgcDetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import { fetchPgcSubscriptions } from '../../services/api/bilibili';
import type { PgcSubscriptionItem } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';

type SubscriptionsPageProps = {
  onLogin: () => void;
  onOpenPgcDetail: (item: PgcDetailRoutePayload) => void;
};

export function SubscriptionsPage({ onLogin, onOpenPgcDetail }: SubscriptionsPageProps) {
  const { auth } = useAppStore();
  const viewerMid = auth.profile?.mid ?? 0;

  const subscriptions = useAsyncData(async () => {
    if (!viewerMid) {
      return {
        anime: [] as PgcSubscriptionItem[],
        cinema: [] as PgcSubscriptionItem[],
      };
    }

    const [anime, cinema] = await Promise.all([
      fetchPgcSubscriptions('anime', viewerMid),
      fetchPgcSubscriptions('cinema', viewerMid),
    ]);

    return { anime, cinema };
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

  const { anime, cinema } = subscriptions.data;

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="subscriptions-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="订阅剧集"
          description="这里会按“最近追番 / 最近追剧”拆开展示，并进入剧集详情页。"
          actionLabel={`${anime.length + cinema.length} 条`}
        />
        {anime.length === 0 && cinema.length === 0 ? (
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
        ) : (
          <div className="home-channel-stack">
            <SubscriptionGroup
              title="最近追番"
              items={anime}
              sectionId="subscriptions-grid"
              focusPrefix="subscriptions-anime"
              defaultFocus
              onOpen={onOpenPgcDetail}
            />
            <SubscriptionGroup
              title="最近追剧"
              items={cinema}
              sectionId="subscriptions-grid"
              focusPrefix="subscriptions-cinema"
              onOpen={onOpenPgcDetail}
            />
          </div>
        )}
      </FocusSection>
    </main>
  );
}

function SubscriptionGroup(props: {
  title: string;
  items: PgcSubscriptionItem[];
  sectionId: string;
  focusPrefix: string;
  defaultFocus?: boolean;
  onOpen: (item: PgcDetailRoutePayload) => void;
}) {
  const { title, items, sectionId, focusPrefix, defaultFocus = false, onOpen } = props;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="home-subscription-group">
      <div className="home-subscription-group__header">
        <strong>{title}</strong>
        <span>{items.length} 条</span>
      </div>
      <div className="media-grid">
        {items.slice(0, 6).map((item, index) => (
          <FocusButton
            key={item.seasonId}
            variant="card"
            className="media-card media-card--pgc"
            sectionId={sectionId}
            focusId={`${focusPrefix}-${index}`}
            defaultFocus={defaultFocus && index === 0}
            onClick={() => onOpen({ seasonId: item.seasonId, title: item.title })}
          >
            <div className="media-card__poster" aria-hidden="true">
              {item.cover ? <img src={item.cover} alt="" referrerPolicy="no-referrer" /> : null}
              {item.badge ? <span className="media-card__reason">{item.badge}</span> : null}
            </div>
            <div className="media-card__body">
              <strong>{item.title}</strong>
              <span>{item.progress || item.latestEpisodeLabel || item.seasonTypeLabel}</span>
              <small>{item.subtitle || item.latestEpisodeTitle || '点击进入剧集详情'}</small>
            </div>
          </FocusButton>
        ))}
      </div>
    </div>
  );
}
