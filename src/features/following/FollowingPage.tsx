import { useAppStore } from '../../app/AppStore';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchFollowingChannelData } from '../../services/api/bilibili';
import type { PlayerRoutePayload } from '../../app/routes';
import { createResolvedVideoListItem, mapFollowItemToVideoCard, resolveVideoPlayerPayload } from '../shared/videoListItems';
import { PageStatus } from '../shared/PageStatus';

type FollowingPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function FollowingPage({ onLogin, onOpenPlayer }: FollowingPageProps) {
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
  const items = data.items.map((item) => createResolvedVideoListItem(
    item.id,
    mapFollowItemToVideoCard(item),
    () => resolveVideoPlayerPayload({
      bvid: item.bvid,
      title: item.title,
    }),
  ));

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="following-grid"
        title="正在关注"
        description="统一改为点击卡片直接播放，保留关注账号摘要但不再绕去详情页。"
        actionLabel={`${data.items.length} 条`}
        items={items}
        onOpenPlayer={onOpenPlayer}
        beforeGrid={data.accounts.length > 0 ? (
          <div className="home-following-summary">
            {data.accounts.map((account) => (
              <span key={account.mid} className={account.hasUpdate ? 'home-following-summary__chip home-following-summary__chip--active' : 'home-following-summary__chip'}>
                {account.name}
              </span>
            ))}
          </div>
        ) : null}
        emptyState={(
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
      />
    </main>
  );
}
