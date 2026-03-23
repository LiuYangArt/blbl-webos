import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncData } from '../../app/useAsyncData';
import type { DetailRoutePayload, PgcDetailRoutePayload, PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { FocusButton } from '../../components/FocusButton';
import { HomeChannelTabs } from '../../components/HomeChannelTabs';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection, focusById } from '../../platform/focus';
import {
  fetchFollowingChannelData,
  fetchPgcSubscriptions,
  fetchPopularVideos,
  fetchRankingVideos,
  fetchRecommendedVideos,
} from '../../services/api/bilibili';
import { BiliApiError } from '../../services/api/http';
import { appendRuntimeDiagnostic } from '../../services/debug/runtimeDiagnostics';
import { readHomePublicFeedCache, writeHomePublicFeedCache } from './homeFeedCache';
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
  recommended: AsyncOptional<VideoCardItem[]>;
  popular: AsyncOptional<VideoCardItem[]>;
  ranking: AsyncOptional<VideoCardItem[]>;
  following: AsyncOptional<FollowingChannelData>;
  subscriptions: {
    anime: AsyncOptional<PgcSubscriptionItem[]>;
    cinema: AsyncOptional<PgcSubscriptionItem[]>;
  };
};

const HOME_CHANNEL_STORAGE_KEY = 'bilibili_webos.home_channel';
const HOME_RECOMMEND_FETCH_COUNT = 24;
const HOME_RECOMMEND_AUTO_LOAD_THRESHOLD = 6;

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
const EMPTY_VIDEO_OPTIONAL: AsyncOptional<VideoCardItem[]> = {
  data: [],
  error: null,
};

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
  const [personalizedItems, setPersonalizedItems] = useState<VideoCardItem[]>([]);
  const [nextRecommendFreshIndex, setNextRecommendFreshIndex] = useState(2);
  const [isLoadingMorePersonalized, setIsLoadingMorePersonalized] = useState(false);
  const [hasMorePersonalized, setHasMorePersonalized] = useState(true);
  const [personalizedLoadMoreError, setPersonalizedLoadMoreError] = useState<string | null>(null);
  const [pendingPersonalizedFocusId, setPendingPersonalizedFocusId] = useState<string | null>(null);
  const initialPersonalizedPrefetchDoneRef = useRef(false);
  const initialHomeSnapshotRef = useRef({
    activeChannel,
    isAuthenticated,
    viewerMid,
  });

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

  useEffect(() => {
    appendRuntimeDiagnostic('home', 'mounted', {
      ...initialHomeSnapshotRef.current,
    });

    return () => {
      appendRuntimeDiagnostic('home', 'unmounted');
    };
  }, []);

  useEffect(() => {
    appendRuntimeDiagnostic('home', 'channel-changed', {
      activeChannel,
      isAuthenticated,
    });
  }, [activeChannel, isAuthenticated]);

  const feed = useAsyncData<HomeFeedData>(async () => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    const freshPublicCache = readHomePublicFeedCache();
    const stalePublicCache = freshPublicCache ?? readHomePublicFeedCache({ allowStale: true });

    appendRuntimeDiagnostic('home', 'feed-load-start', {
      requestId,
      activeChannel,
      isAuthenticated,
      viewerMid,
      cacheState: freshPublicCache ? 'fresh-hit' : stalePublicCache ? 'stale-available' : 'miss',
    });

    try {
      const [recommended, popular, ranking, following, animeSubscriptions, cinemaSubscriptions] = await Promise.all([
        freshPublicCache
          ? Promise.resolve(createCachedOptional(freshPublicCache.data.recommended))
          : loadOptional(() => fetchRecommendedVideos(HOME_RECOMMEND_FETCH_COUNT, 1), [], '首页推荐', requestId),
        freshPublicCache
          ? Promise.resolve(createCachedOptional(freshPublicCache.data.popular))
          : loadOptional(() => fetchPopularVideos(1, 12), [], '首页热门', requestId),
        freshPublicCache
          ? Promise.resolve(createCachedOptional(freshPublicCache.data.ranking))
          : loadOptional(() => fetchRankingVideos(12), [], '首页排行', requestId),
        loadOptional(
          async () => (isAuthenticated ? fetchFollowingChannelData() : emptyFollowingChannelData()),
          emptyFollowingChannelData(),
          isAuthenticated ? '关注更新' : '关注更新（未登录跳过）',
          requestId,
        ),
        loadOptional(
          async () => (isAuthenticated && viewerMid ? fetchPgcSubscriptions('anime', viewerMid) : []),
          [],
          isAuthenticated && viewerMid ? '订阅番剧' : '订阅番剧（未登录跳过）',
          requestId,
        ),
        loadOptional(
          async () => (isAuthenticated && viewerMid ? fetchPgcSubscriptions('cinema', viewerMid) : []),
          [],
          isAuthenticated && viewerMid ? '订阅影视' : '订阅影视（未登录跳过）',
          requestId,
        ),
      ]);

      if (freshPublicCache) {
        appendRuntimeDiagnostic('home-cache', 'public-feed-hit', {
          requestId,
          ageMs: freshPublicCache.ageMs,
          recommendedCount: freshPublicCache.data.recommended.length,
          popularCount: freshPublicCache.data.popular.length,
          rankingCount: freshPublicCache.data.ranking.length,
        });
      }

      const mergedRecommended = mergePublicFeedSection('首页推荐', recommended, stalePublicCache?.data.recommended, requestId);
      const mergedPopular = mergePublicFeedSection('首页热门', popular, stalePublicCache?.data.popular, requestId);
      const mergedRanking = mergePublicFeedSection('首页排行', ranking, stalePublicCache?.data.ranking, requestId);

      if (
        mergedRecommended.data.length === 0
        && mergedPopular.data.length === 0
        && mergedRanking.data.length === 0
      ) {
        throw new Error(buildHomePublicFeedError([mergedRecommended.error, mergedPopular.error, mergedRanking.error]));
      }

      const storedCache = writeHomePublicFeedCache({
        recommended: mergedRecommended.data,
        popular: mergedPopular.data,
        ranking: mergedRanking.data,
      });

      if (storedCache) {
        appendRuntimeDiagnostic('home-cache', 'public-feed-write', {
          requestId,
          recommendedCount: storedCache.data.recommended.length,
          popularCount: storedCache.data.popular.length,
          rankingCount: storedCache.data.ranking.length,
        });
      }

      appendRuntimeDiagnostic('home', 'feed-load-success', {
        requestId,
        durationMs: Date.now() - startedAt,
        recommendedCount: mergedRecommended.data.length,
        popularCount: mergedPopular.data.length,
        rankingCount: mergedRanking.data.length,
        recommendedError: mergedRecommended.error,
        popularError: mergedPopular.error,
        rankingError: mergedRanking.error,
        followingCount: following.data.items.length,
        animeCount: animeSubscriptions.data.length,
        cinemaCount: cinemaSubscriptions.data.length,
      });

      return {
        recommended: mergedRecommended,
        popular: mergedPopular,
        ranking: mergedRanking,
        following,
        subscriptions: {
          anime: animeSubscriptions,
          cinema: cinemaSubscriptions,
        },
      };
    } catch (error) {
      appendRuntimeDiagnostic('home', 'feed-load-error', {
        requestId,
        durationMs: Date.now() - startedAt,
        ...extractErrorDiagnostic(error),
      }, 'error');
      throw error;
    }
  }, [isAuthenticated, viewerMid]);

  const recommendedFeed = feed.status === 'success' ? feed.data.recommended : EMPTY_VIDEO_OPTIONAL;
  const personalizedBaseKey = useMemo(
    () => `${recommendedFeed.data[0]?.bvid ?? 'empty'}:${recommendedFeed.data.length}:${isAuthenticated ? 'auth' : 'guest'}`,
    [isAuthenticated, recommendedFeed.data],
  );

  useEffect(() => {
    if (feed.status !== 'success') {
      return;
    }

    setPersonalizedItems(recommendedFeed.data);
    setNextRecommendFreshIndex(2);
    setIsLoadingMorePersonalized(false);
    setHasMorePersonalized(recommendedFeed.data.length > 0);
    setPersonalizedLoadMoreError(null);
    setPendingPersonalizedFocusId(null);
    initialPersonalizedPrefetchDoneRef.current = false;
  }, [feed.status, personalizedBaseKey, recommendedFeed.data]);

  useEffect(() => {
    if (!pendingPersonalizedFocusId) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (focusById(pendingPersonalizedFocusId)) {
        setPendingPersonalizedFocusId(null);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [pendingPersonalizedFocusId, personalizedItems.length]);

  const loadMorePersonalized = useCallback(async (trigger: 'initial' | 'prefetch' | 'manual') => {
    if (isLoadingMorePersonalized || !hasMorePersonalized) {
      return;
    }

    const requestId = createRequestId();
    const startedAt = Date.now();
    const previousCount = personalizedItems.length;
    setIsLoadingMorePersonalized(true);
    setPersonalizedLoadMoreError(null);

    appendRuntimeDiagnostic('home-recommend', 'load-more-start', {
      requestId,
      trigger,
      freshIndex: nextRecommendFreshIndex,
      previousCount,
    });

    try {
      const nextBatch = await fetchRecommendedVideos(HOME_RECOMMEND_FETCH_COUNT, nextRecommendFreshIndex);
      const mergedItems = mergeUniqueVideoCards(personalizedItems, nextBatch);
      const addedCount = mergedItems.length - personalizedItems.length;

      appendRuntimeDiagnostic('home-recommend', 'load-more-success', {
        requestId,
        trigger,
        freshIndex: nextRecommendFreshIndex,
        durationMs: Date.now() - startedAt,
        fetchedCount: nextBatch.length,
        addedCount,
        totalCount: mergedItems.length,
      });

      setPersonalizedItems(mergedItems);
      setNextRecommendFreshIndex((current) => current + 1);
      setHasMorePersonalized(nextBatch.length > 0 && addedCount > 0);

      if (addedCount > 0 && trigger === 'manual') {
        setPendingPersonalizedFocusId(`home-personalized-${previousCount}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载更多推荐失败';
      setPersonalizedLoadMoreError(message);
      appendRuntimeDiagnostic('home-recommend', 'load-more-error', {
        requestId,
        trigger,
        freshIndex: nextRecommendFreshIndex,
        durationMs: Date.now() - startedAt,
        ...extractErrorDiagnostic(error),
      }, 'error');
    } finally {
      setIsLoadingMorePersonalized(false);
    }
  }, [hasMorePersonalized, isLoadingMorePersonalized, nextRecommendFreshIndex, personalizedItems]);

  useEffect(() => {
    if (activeChannel !== 'personalized' || feed.status !== 'success') {
      return;
    }

    if (initialPersonalizedPrefetchDoneRef.current || personalizedItems.length === 0) {
      return;
    }

    initialPersonalizedPrefetchDoneRef.current = true;
    void loadMorePersonalized('initial');
  }, [activeChannel, feed.status, loadMorePersonalized, personalizedItems.length]);

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

  return (
    <main className="page-shell page-shell--home">
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
        personalizedItems,
        hasMorePersonalized,
        isLoadingMorePersonalized,
        personalizedLoadMoreError,
        onLoadMorePersonalized: loadMorePersonalized,
      })}
    </main>
  );
}

function renderChannelContent(params: {
  activeChannel: HomeChannelKey;
  recommended: AsyncOptional<VideoCardItem[]>;
  popular: AsyncOptional<VideoCardItem[]>;
  ranking: AsyncOptional<VideoCardItem[]>;
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
  personalizedItems: VideoCardItem[];
  hasMorePersonalized: boolean;
  isLoadingMorePersonalized: boolean;
  personalizedLoadMoreError: string | null;
  onLoadMorePersonalized: (trigger: 'initial' | 'prefetch' | 'manual') => void;
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
    personalizedItems,
    hasMorePersonalized,
    isLoadingMorePersonalized,
    personalizedLoadMoreError,
    onLoadMorePersonalized,
  } = params;

  switch (activeChannel) {
    case 'personalized': {
      const autoLoadStartIndex = Math.max(0, personalizedItems.length - HOME_RECOMMEND_AUTO_LOAD_THRESHOLD);
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <SectionHeader
            title="个性推荐"
            description="首页直接展示推荐视频列表，继续向下会自动补更多内容。"
            actionLabel={`${personalizedItems.length} 条`}
          />
          {recommended.error && personalizedItems.length === 0 ? (
            <>
              <InlineChannelNotice title="个性推荐暂时不可用" description={recommended.error} />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-personalized-hot"
                  defaultFocus
                  onClick={onOpenHot}
                >
                  先看热门视频
                </FocusButton>
              </div>
            </>
          ) : (
            <>
              <div className="media-grid">
                {personalizedItems.map((item, index) => (
                  <MediaCard
                    key={item.bvid}
                    sectionId="home-channel-content"
                    focusId={`home-personalized-${index}`}
                    defaultFocus={index === 0}
                    item={item}
                    onFocus={() => {
                      if (hasMorePersonalized && index >= autoLoadStartIndex) {
                        void onLoadMorePersonalized('prefetch');
                      }
                    }}
                    onClick={() => onOpenPlayer(item)}
                  />
                ))}
              </div>
              {isLoadingMorePersonalized ? (
                <p className="page-helper-text">正在加载更多推荐...</p>
              ) : null}
              {personalizedLoadMoreError ? (
                <div className="page-inline-actions">
                  <FocusButton
                    variant="ghost"
                    size="sm"
                    className="page-inline-link"
                    sectionId="home-channel-content"
                    focusId="home-personalized-retry-load-more"
                    onClick={() => void onLoadMorePersonalized('manual')}
                  >
                    重试加载更多推荐
                  </FocusButton>
                </div>
              ) : !hasMorePersonalized ? (
                <p className="page-helper-text">已经到底了，稍后再来刷新推荐。</p>
              ) : null}
            </>
          )}
        </FocusSection>
      );
    }
    case 'following':
      return (
        <FocusSection
          as="section"
          id="home-channel-content"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav', up: '@home-channel-tabs' }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
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
          scroll={CONTENT_FIRST_ROW_SCROLL}
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
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <SectionHeader title="热门视频" description="首版继续复用可稳定直播的热门内容。" actionLabel={`${popular.data.length} 条`} />
          {popular.error && popular.data.length === 0 ? (
            <InlineChannelNotice title="热门内容暂时不可用" description={popular.error} />
          ) : (
            <div className="media-grid">
              {popular.data.slice(0, 6).map((item, index) => (
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
          )}
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
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <SectionHeader title="排行" description="先接全站排行，后续再分区。" actionLabel={`${ranking.data.length} 条`} />
          {ranking.error && ranking.data.length === 0 ? (
            <>
              <InlineChannelNotice title="排行暂时不可用" description={ranking.error} />
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId="home-channel-content"
                  focusId="home-ranking-hot"
                  defaultFocus
                  onClick={onOpenHot}
                >
                  先看热门视频
                </FocusButton>
              </div>
            </>
          ) : (
            <div className="media-grid">
              {ranking.data.map((item, index) => (
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
          )}
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
          scroll={CONTENT_FIRST_ROW_SCROLL}
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

async function loadOptional<T>(
  loader: () => Promise<T>,
  fallback: T,
  label: string,
  requestId: string,
): Promise<AsyncOptional<T>> {
  const startedAt = Date.now();
  appendRuntimeDiagnostic('home-request', 'request-start', {
    requestId,
    label,
    required: false,
  });

  try {
    const data = await loader();
    appendRuntimeDiagnostic('home-request', 'request-success', {
      requestId,
      label,
      required: false,
      durationMs: Date.now() - startedAt,
    });

    return {
      data,
      error: null,
    };
  } catch (error) {
    appendRuntimeDiagnostic('home-request', 'request-error', {
      requestId,
      label,
      required: false,
      durationMs: Date.now() - startedAt,
      ...extractErrorDiagnostic(error),
    }, 'warn');

    return {
      data: fallback,
      error: error instanceof Error ? error.message : '请求失败',
    };
  }
}

function createCachedOptional<T>(data: T): AsyncOptional<T> {
  return {
    data,
    error: null,
  };
}

function mergePublicFeedSection(
  label: string,
  live: AsyncOptional<VideoCardItem[]>,
  cached: VideoCardItem[] | undefined,
  requestId: string,
): AsyncOptional<VideoCardItem[]> {
  if (live.data.length > 0 || !live.error) {
    return live;
  }

  if (!cached || cached.length === 0) {
    return live;
  }

  appendRuntimeDiagnostic('home-cache', 'public-feed-fallback', {
    requestId,
    label,
    cachedCount: cached.length,
    error: live.error,
  }, 'warn');

  return {
    data: cached,
    error: null,
  };
}

function mergeUniqueVideoCards(current: VideoCardItem[], incoming: VideoCardItem[]) {
  const seen = new Set(current.map((item) => `${item.bvid}:${item.cid}`));
  const merged = [...current];

  for (const item of incoming) {
    const key = `${item.bvid}:${item.cid}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function buildHomePublicFeedError(errors: Array<string | null>) {
  const message = errors.find((item) => item && item.trim()) ?? '公开推荐流暂时不可用';
  return `首页公共内容失败：${message}`;
}

function extractErrorDiagnostic(error: unknown) {
  if (error instanceof BiliApiError) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorName: 'UnknownError',
    errorMessage: '请求失败',
  };
}

function createRequestId() {
  return `home-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
