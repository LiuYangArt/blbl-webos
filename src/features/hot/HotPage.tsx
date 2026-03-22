import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import { fetchPopularVideos } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type HotPageProps = {
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function HotPage({ onOpenPlayer }: HotPageProps) {
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
      <FocusSection
        as="section"
        id="hot-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav' }}
      >
        <SectionHeader
          title="热门精选"
          description="首版优先接入稳定公开接口，为 TV 端补上首页之外的主动浏览入口。"
          actionLabel="18 条内容"
        />
        <div className="media-grid">
          {items.map((item, index) => (
            <MediaCard
              key={item.bvid}
              sectionId="hot-grid"
              focusId={`hot-item-${index}`}
              item={item}
              onClick={() => onOpenPlayer(item)}
            />
          ))}
        </div>
      </FocusSection>
    </main>
  );
}
