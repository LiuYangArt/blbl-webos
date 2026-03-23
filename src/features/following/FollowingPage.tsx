import { useAppStore } from '../../app/AppStore';
import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import { fetchFollowingChannelData } from '../../services/api/bilibili';
import type { FollowFeedItem, VideoCardItem } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';

type FollowingPageProps = {
  onLogin: () => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
};

export function FollowingPage({ onLogin, onOpenDetail }: FollowingPageProps) {
  const { auth } = useAppStore();

  const following = useAsyncData(async () => fetchFollowingChannelData(), []);

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

  if (following.status !== 'success') {
    if (following.status === 'error') {
      return (
        <PageStatus
          title="关注动态暂时不可用"
          description={following.error}
          actionLabel="重新加载关注区"
          onAction={() => void following.reload()}
        />
      );
    }
    return <PageStatus title="正在同步关注区" description="只保留适合电视端直接浏览的视频更新。" />;
  }

  const data = following.data;

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="following-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="正在关注"
          description="首版只保留可直接进入视频详情的关注更新，不把文字动态和复杂互动带进 TV 端。"
          actionLabel={`${data.items.length} 条`}
        />
        {data.accounts.length > 0 ? (
          <div className="home-following-summary">
            {data.accounts.map((account) => (
              <span key={account.mid} className={account.hasUpdate ? 'home-following-summary__chip home-following-summary__chip--active' : 'home-following-summary__chip'}>
                {account.name}
              </span>
            ))}
          </div>
        ) : null}

        {data.items.length > 0 ? (
          <div className="media-grid">
            {data.items.map((item, index) => (
              <MediaCard
                key={item.id}
                sectionId="following-grid"
                focusId={`following-item-${index}`}
                defaultFocus={index === 0}
                item={toVideoCard(item)}
                onClick={() => onOpenDetail({ bvid: item.bvid, title: item.title })}
              />
            ))}
          </div>
        ) : (
          <div className="page-inline-actions">
            <FocusButton
              variant="ghost"
              size="sm"
              className="page-inline-link"
              sectionId="following-grid"
              focusId="following-empty-reload"
              defaultFocus
              onClick={() => void following.reload()}
            >
              关注区暂时没有可展示的视频，按确认可重试
            </FocusButton>
          </div>
        )}
      </FocusSection>
    </main>
  );
}

function toVideoCard(item: FollowFeedItem): VideoCardItem {
  return {
    aid: 0,
    bvid: item.bvid,
    cid: 0,
    title: item.title,
    cover: item.cover,
    duration: item.duration,
    ownerName: item.ownerName,
    playCount: 0,
    danmakuCount: 0,
    description: item.description,
    reason: item.reason,
    publishAt: item.publishedAt,
  };
}
