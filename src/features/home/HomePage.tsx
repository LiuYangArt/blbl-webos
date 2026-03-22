import { HeroBanner } from '../../components/HeroBanner';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { FocusSection } from '../../platform/focus';
import { fetchPopularVideos, fetchRecommendedVideos } from '../../services/api/bilibili';
import type { PlayerRoutePayload } from '../../app/routes';
import { PageStatus } from '../shared/PageStatus';

type HomePageProps = {
  onOpenPlayer: (item: PlayerRoutePayload) => void;
  onOpenSearch: () => void;
  onOpenHot: () => void;
};

export function HomePage({ onOpenPlayer, onOpenSearch, onOpenHot }: HomePageProps) {
  const feed = useAsyncData(async () => {
    const [recommended, popular] = await Promise.all([
      fetchRecommendedVideos(9, 1),
      fetchPopularVideos(1, 6),
    ]);
    return { recommended, popular };
  }, []);

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
    return <PageStatus title="正在加载首页" description="准备推荐流和热门内容，稍等片刻。" />;
  }

  const { recommended, popular } = feed.data;
  const hero = recommended[0] ?? popular[0];
  const recommendItems = recommended.slice(1, 7);

  return (
    <main className="page-shell">
      {hero ? (
        <FocusSection
          as="section"
          id="home-hero-actions"
          group="content"
          leaveFor={{ left: '@side-nav', down: '@home-recommend-grid' }}
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

      <FocusSection
        as="section"
        id="home-recommend-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{
          left: '@side-nav',
          up: hero ? '@home-hero-actions' : undefined,
          down: '@home-hot-grid',
        }}
      >
        <SectionHeader title="首页推荐" />
        <div className="media-grid">
          {recommendItems.map((item, index) => (
            <MediaCard
              key={item.bvid}
              sectionId="home-recommend-grid"
              focusId={`home-recommend-${index}`}
              defaultFocus={!hero && index === 0}
              item={item}
              onClick={() => onOpenPlayer(item)}
            />
          ))}
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="home-hot-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@home-recommend-grid' }}
      >
        <SectionHeader title="热门速看" />
        <div className="media-grid">
          {popular.slice(0, 6).map((item, index) => (
            <MediaCard
              key={item.bvid}
              sectionId="home-hot-grid"
              focusId={`home-hot-${index}`}
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
            sectionId="home-hot-grid"
            focusId="home-hot-more"
            onClick={onOpenHot}
          >
            查看完整热门页
          </FocusButton>
        </div>
      </FocusSection>
    </main>
  );
}
