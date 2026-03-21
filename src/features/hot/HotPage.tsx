import type { DetailRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { fetchPopularVideos } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type HotPageProps = {
  onOpenDetail: (item: DetailRoutePayload) => void;
};

export function HotPage({ onOpenDetail }: HotPageProps) {
  const hot = useAsyncData(() => fetchPopularVideos(1, 18), []);

  if (hot.status !== 'success') {
    if (hot.status === 'error') {
      return (
        <PageStatus
          title="热门页加载失败"
          description={hot.error}
          actionLabel="重试热门页"
          onAction={() => void hot.reload()}
        />
      );
    }
    return <PageStatus title="正在加载热门内容" description="准备热门榜单，请稍等。" />;
  }

  const items = hot.data;

  return (
    <main className="page-shell">
      <section className="content-section">
        <SectionHeader
          title="热门精选"
          description="首版优先接入稳定公开接口，为 TV 端补上首页之外的主动浏览入口。"
          actionLabel="18 条内容"
        />
        <div className="media-grid">
          {items.map((item, index) => (
            <MediaCard key={item.bvid} row={Math.floor(index / 3)} col={10 + (index % 3)} item={item} onClick={() => onOpenDetail(item)} />
          ))}
        </div>
      </section>
    </main>
  );
}
