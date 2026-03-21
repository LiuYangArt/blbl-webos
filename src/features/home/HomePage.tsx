import { HeroBanner } from '../../components/HeroBanner';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { useAsyncData } from '../../app/useAsyncData';
import { fetchPopularVideos, fetchRecommendedVideos } from '../../services/api/bilibili';
import type { DetailRoutePayload } from '../../app/routes';
import { PageStatus } from '../shared/PageStatus';

type HomePageProps = {
  onOpenDetail: (item: DetailRoutePayload) => void;
  onOpenSearch: () => void;
  onOpenHot: () => void;
};

export function HomePage({ onOpenDetail, onOpenSearch, onOpenHot }: HomePageProps) {
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
        <HeroBanner
          item={hero}
          description={hero.description || '把 PiliPlus 的主路径先落在 TV 上，从首页直接进入详情与真实播放。'}
          primaryLabel="查看详情"
          secondaryLabel="去搜索"
          onPrimaryAction={() => onOpenDetail(hero)}
          onSecondaryAction={onOpenSearch}
        />
      ) : null}

      <section className="content-section">
        <SectionHeader
          title="首页推荐"
          description="这组数据已经接到真实推荐接口，卡片点击统一先进入详情页。"
          actionLabel="真实数据"
        />
        <div className="media-grid">
          {recommendItems.map((item, index) => (
            <MediaCard key={item.bvid} row={1 + Math.floor(index / 3)} col={10 + (index % 3)} item={item} onClick={() => onOpenDetail(item)} />
          ))}
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          title="热门速看"
          description="推荐流之外，再补一组稳定可用的热门内容入口。"
          actionLabel="打开热门页"
        />
        <div className="media-grid">
          {popular.slice(0, 6).map((item, index) => (
            <MediaCard key={item.bvid} row={3 + Math.floor(index / 3)} col={10 + (index % 3)} item={item} onClick={() => onOpenDetail(item)} />
          ))}
        </div>
        <div className="page-inline-actions">
          <button className="page-inline-link" type="button" onClick={onOpenHot}>
            查看完整热门页
          </button>
        </div>
      </section>
    </main>
  );
}
