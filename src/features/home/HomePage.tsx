import { useEffect, useMemo, useState } from 'react';
import { useAsyncData } from '../../app/useAsyncData';
import type { DetailRoutePayload, PgcDetailRoutePayload, PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { FocusButton } from '../../components/FocusButton';
import { HeroBanner } from '../../components/HeroBanner';
import { HomeChannelTabs } from '../../components/HomeChannelTabs';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import {
  fetchFollowingChannelData,
  fetchPgcSubscriptions,
  fetchPopularVideos,
  fetchRankingVideos,
  fetchRecommendedVideos,
} from '../../services/api/bilibili';
import { readJsonStorage, writeJsonStorage } from '../../services/storage/local';
import type {
  FollowingChannelData,
  FollowFeedItem,
  HomeChannelKey,
  PgcSubscriptionItem,
  VideoCardItem,
} from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';

type HomePageProps = {
  isLoggedIn: boolean;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
  onOpenPgcDetail: (item: PgcDetailRoutePayload) => void;
  onOpenSearch: () => void;
  onOpenHot: () => void;
};

type AsyncOptional<T> = {
  data: T;
  error: string | null;
};

type HomeFeedData = {
  recommended: VideoCardItem[];
  popular: VideoCardItem[];
  ranking: VideoCardItem[];
  following: AsyncOptional<FollowingChannelData>;
  subscriptions: {
    anime: AsyncOptional<PgcSubscriptionItem[]>;
    cinema: AsyncOptional<PgcSubscriptionItem[]>;
  };
};

const HOME_CHANNEL_STORAGE_KEY = 'bilibili_webos.home_channel';

const PUBLIC_CHANNELS: Array<{ key: HomeChannelKey; label: string; hint: string }> = [
  { key: 'personalized', label: '个性推荐', hint: '优先看推荐与首页主内容' },
  { key: 'hot', label: '热门视频', hint: '快速看全站热门内容' },
  { key: 'ranking', label: '排行', hint: '查看当前热视频排行' },
  { key: 'live', label: '直播', hint: '首版先保留入口占位' },
];

const AUTH_CHANNELS: Array<{ key: HomeChannelKey; label: string; hint: string }> = [
  { key: 'following', label: '正在关注', hint: '只看关注区最近更新的视频' },
  { key: 'subscriptions', label: '订阅剧集', hint: '最近追番和追剧入口' },
];

export function HomePage({
  isLoggedIn,
  onOpenPlayer,
  onOpenDetail,
  onOpenPgcDetail,
  onOpenSearch,
  onOpenHot,
}: HomePageProps) {
  const { auth } = useAppStore();
  const isAuthenticated = isLoggedIn && auth.status === 'authenticated';
  const viewerMid = auth.profile?.mid ?? 0;
  const [activeChannel, setActiveChannel] = useState<HomeChannelKey>(() => (
    readJsonStorage<HomeChannelKey>(HOME_CHANNEL_STORAGE_KEY, 'personalized')
  ));

  const tabs = useMemo(() => (
    isAuthenticated
      ? [PUBLIC_CHANNELS[0], ...AUTH_CHANNELS, ...PUBLIC_CHANNELS.slice(1)]
      : PUBLIC_CHANNELS
  ), [isAuthenticated]);

  useEffect(() => {
    if (tabs.some((tab) => tab.key === activeChannel)) {
      return;
    }
    setActiveChannel('personalized');
  }, [activeChannel, tabs]);

  useEffect(() => {
    writeJsonStorage(HOME_CHANNEL_STORAGE_KEY, activeChannel);
  }, [activeChannel]);

  const feed = useAsyncData<HomeFeedData>(async () => {
    const [recommended, popular, ranking, following, animeSubscriptions, cinemaSubscriptions] = await Promise.all([
      fetchRecommendedVideos(9, 1),
      fetchPopularVideos(1, 6),
      fetchRankingVideos(6),
      loadOptional(
        async () => (isAuthenticated ? fetchFollowingChannelData() : emptyFollowingChannelData()),
        emptyFollowingChannelData(),
      ),
      loadOptional(async () => (isAuthenticated && viewerMid ? fetchPgcSubscriptions('anime', viewerMid) : []), []),
      loadOptional(async () => (isAuthenticated && viewerMid ? fetchPgcSubscriptions('cinema', viewerMid) : []), []),
    ]);

    return {
      recommended,
      popular,
      ranking,
      following,
      subscriptions: {
        anime: animeSubscriptions,
        cinema: cinemaSubscriptions,
      },
    };
  }, [isAuthenticated, viewerMid]);

  if (feed.status !== 'success') {
    if (feed.status === 'error') {
      return (
        <PageStatus
          title="首页加载失败"
          description={feed.error}
          actionLabel="重试首页"
          onAction={() => void feed.reload()}
        />
      );
    }
    return <PageStatus title="正在加载首页" description="准备推荐流、排行和登录态频道，稍等片刻。" />;
  }

  const { recommended, popular, ranking, following, subscriptions } = feed.data;
  const hero = recommended[0] ?? popular[0] ?? ranking[0];

  return (
    <main className="page-shell">
      {hero ? (
        <FocusSection
          as="section"
          id="home-hero-actions"
          group="content"
          leaveFor={{ left: '@side-nav', down: '@home-channel-tabs' }}
        >
          <HeroBanner
            item={hero}
            sectionId="home-hero-actions"
            primaryFocusId="home-hero-primary"
            secondaryFocusId="home-hero-secondary"
            primaryLabel="立即播放"
            secondaryLabel="去搜索"
            onPrimaryAction={() => onOpenPlayer(hero)}
            onSecondaryAction={onOpenSearch}
          />
        </FocusSection>
      ) : null}

      <HomeChannelTabs
        tabs={tabs}
        activeKey={activeChannel}
        defaultFocus
        leaveDown="@home-channel-content"
        onChange={setActiveChannel}
      />

      {renderChannelContent({
        activeChannel,
        recommended,
        popular,
        ranking,
        following,
        subscriptions,
        onOpenPlayer,
        onOpenDetail,
        onOpenPgcDetail,
        onOpenSearch,
        onOpenHot,
      })}
    </main>
  );
}

function renderChannelContent(params: {
  activeChannel: HomeChannelKey;
  recommended: VideoCardItem[];
  popular: VideoCardItem[];
  ranking: VideoCardItem[];
  following: AsyncOptional<FollowingChannelData>;
  subscriptions: {
    anime: AsyncOptional<PgcSubscriptionItem[]>;
    cinema: AsyncOptional<PgcSubscriptionItem[]>;
  };
  onOpenPlayer: (item: PlayerRoutePayload) => void;
  onOpenDetail: (item: DetailRoutePayload) => void;
  onOpenPgcDetail: (item: PgcDetailRoutePayload) => void;
  onOpenSearch: () => void;
  onOpenHot: () => void;
}) {
  const {
    activeChannel,
    recommended,
    popular,
    ranking,
    following,
    subscriptions,
    onOpenPlayer,
    onOpenDetail,
    onOpenPgcDetail,
    onOpenSearch,
    onOpenHot,
  } = params;

  switch (activeChannel) {
    case 'personalized':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader
            title="个性推荐"
            description="延续首页主推荐流，首版先保留最直接的播放入口。"
            actionLabel={`${Math.max(0, recommended.length - 1)} 条`}
          />
          <div className="media-grid">
            {recommended.slice(1, 7).map((item, index) => (
              <MediaCard
                key={item.bvid}
                sectionId="home-channel-content"
                focusId={`home-personalized-${index}`}
                defaultFocus={index === 0}
                item={item}
                onClick={() => onOpenPlayer(item)}
              />
            ))}
          </div>
        </FocusSection>
      );
    case 'following':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader
            title="正在关注"
            description="首页首版只保留可直接进入详情的视频动态，避免把 TV 页面做成动态广场。"
            actionLabel={`${following.data.items.length} 条更新`}
          />
          {following.error ? (
            <>
              <InlineChannelNotice title="关注动态暂时不可用" description={following.error} />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-following-search"
                  defaultFocus
                  onClick={onOpenSearch}
                >
                  先去搜索内容
                </FocusButton>
              </div>
            </>
          ) : following.data.items.length > 0 ? (
            <>
              {following.data.accounts.length > 0 ? (
                <div className="home-following-summary">
                  {following.data.accounts.map((account) => (
                    <span key={account.mid} className={account.hasUpdate ? 'home-following-summary__chip home-following-summary__chip--active' : 'home-following-summary__chip'}>
                      {account.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="media-grid">
                {following.data.items.map((item, index) => (
                  <MediaCard
                    key={item.id}
                    sectionId="home-channel-content"
                    focusId={`home-following-${index}`}
                    defaultFocus={index === 0}
                    item={createFollowVideoCard(item)}
                    onClick={() => onOpenDetail({ bvid: item.bvid, title: item.title })}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              <InlineChannelNotice title="关注区还没有可直达的视频更新" description="当前先过滤掉文字动态和复杂卡片，后续再补更完整的动态形态。" />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-following-hot"
                  defaultFocus
                  onClick={onOpenHot}
                >
                  先看热门内容
                </FocusButton>
              </div>
            </>
          )}
        </FocusSection>
      );
    case 'subscriptions':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader
            title="订阅剧集"
            description="先按“最近追番 / 最近追剧”两段展示，点击后进入简化版剧集详情页。"
            actionLabel={`${subscriptions.anime.data.length + subscriptions.cinema.data.length} 条`}
          />
          {subscriptions.anime.error || subscriptions.cinema.error ? (
            <>
              <InlineChannelNotice
                title="订阅剧集暂时不可用"
                description={subscriptions.anime.error ?? subscriptions.cinema.error ?? '当前还没有有效登录态。'}
              />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-subscription-hot"
                  defaultFocus
                  onClick={onOpenHot}
                >
                  先看热门视频
                </FocusButton>
              </div>
            </>
          ) : subscriptions.anime.data.length === 0 && subscriptions.cinema.data.length === 0 ? (
            <>
              <InlineChannelNotice title="当前还没有订阅内容" description="等你在账号里追番或追剧后，这里会优先展示最近在看的条目。" />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-subscription-search"
                  defaultFocus
                  onClick={onOpenSearch}
                >
                  先去搜索剧集
                </FocusButton>
              </div>
            </>
          ) : (
            <div className="home-channel-stack">
              <div className="home-subscription-group">
                <div className="home-subscription-group__header">
                  <strong>最近追番</strong>
                  <span>{subscriptions.anime.data.length} 条</span>
                </div>
                <div className="media-grid">
                  {subscriptions.anime.data.slice(0, 6).map((item, index) => (
                    <PgcSubscriptionCard
                      key={`anime-${item.seasonId}`}
                      sectionId="home-channel-content"
                      focusId={`home-subscription-anime-${index}`}
                      defaultFocus={index === 0}
                      item={item}
                      onClick={() => onOpenPgcDetail({ seasonId: item.seasonId, title: item.title })}
                    />
                  ))}
                </div>
              </div>
              <div className="home-subscription-group">
                <div className="home-subscription-group__header">
                  <strong>最近追剧</strong>
                  <span>{subscriptions.cinema.data.length} 条</span>
                </div>
                <div className="media-grid">
                  {subscriptions.cinema.data.slice(0, 6).map((item, index) => (
                    <PgcSubscriptionCard
                      key={`cinema-${item.seasonId}`}
                      sectionId="home-channel-content"
                      focusId={`home-subscription-cinema-${index}`}
                      defaultFocus={subscriptions.anime.data.length === 0 && index === 0}
                      item={item}
                      onClick={() => onOpenPgcDetail({ seasonId: item.seasonId, title: item.title })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </FocusSection>
      );
    case 'hot':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader title="热门视频" description="首版继续复用可稳定直播的热门内容。" actionLabel={`${popular.length} 条`} />
          <div className="media-grid">
            {popular.slice(0, 6).map((item, index) => (
              <MediaCard
                key={item.bvid}
                sectionId="home-channel-content"
                focusId={`home-hot-${index}`}
                defaultFocus={index === 0}
                item={item}
                onClick={() => onOpenPlayer(item)}
              />
            ))}
          </div>
          <div className="page-inline-actions">
            <FocusButton
              variant="ghost"
              size="sm"
              className="page-inline-link"
              sectionId="home-channel-content"
              focusId="home-hot-more"
              onClick={onOpenHot}
            >
              查看完整热门页
            </FocusButton>
          </div>
        </FocusSection>
      );
    case 'ranking':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader title="排行" description="先接全站排行，后续再分区。" actionLabel={`${ranking.length} 条`} />
          <div className="media-grid">
            {ranking.map((item, index) => (
              <MediaCard
                key={item.bvid}
                sectionId="home-channel-content"
                focusId={`home-ranking-${index}`}
                defaultFocus={index === 0}
                item={item}
                onClick={() => onOpenPlayer(item)}
              />
            ))}
          </div>
        </FocusSection>
      );
    case 'live':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
        >
          <SectionHeader title="直播" description="直播链路会单独做 TV 化，本轮先把首页频道位和焦点流补齐。" />
          <InlineChannelNotice title="直播频道将在后续阶段接入" description="当前优先把关注、订阅剧集和高画质链路做完整，避免首页入口先有了却没有稳定播放能力。" />
          <div className="page-inline-actions">
            <FocusButton
              variant="ghost"
              size="sm"
              className="page-inline-link"
              sectionId="home-channel-content"
              focusId="home-live-search"
              defaultFocus
              onClick={onOpenSearch}
            >
              先去搜索内容
            </FocusButton>
          </div>
        </FocusSection>
      );
  }
}

function PgcSubscriptionCard(props: {
  item: PgcSubscriptionItem;
  sectionId: string;
  focusId: string;
  defaultFocus?: boolean;
  onClick: () => void;
}) {
  const { item, sectionId, focusId, defaultFocus = false, onClick } = props;
  return (
    <FocusButton
      variant="card"
      className="media-card media-card--pgc"
      sectionId={sectionId}
      focusId={focusId}
      defaultFocus={defaultFocus}
      onClick={onClick}
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
  );
}

function InlineChannelNotice({ title, description }: { title: string; description: string }) {
  return (
    <div className="home-channel-notice">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function createFollowVideoCard(item: FollowFeedItem): VideoCardItem {
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

function emptyFollowingChannelData(): FollowingChannelData {
  return {
    accounts: [],
    items: [],
  };
}

async function loadOptional<T>(loader: () => Promise<T>, fallback: T): Promise<AsyncOptional<T>> {
  try {
    return {
      data: await loader(),
      error: null,
    };
  } catch (error) {
    return {
      data: fallback,
      error: error instanceof Error ? error.message : '请求失败',
    };
  }
}
