import { useAsyncData } from '../../app/useAsyncData';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import { fetchFavoriteFolderDetail } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type FavoriteDetailPageProps = {
  mediaId: number;
  title: string;
  onOpenDetail: (item: { bvid: string; title: string }) => void;
};

export function FavoriteDetailPage({ mediaId, title, onOpenDetail }: FavoriteDetailPageProps) {
  const detail = useAsyncData(() => fetchFavoriteFolderDetail(mediaId), [mediaId]);

  if (detail.status !== 'success') {
    if (detail.status === 'error') {
      return (
        <PageStatus
          title="收藏夹详情加载失败"
          description={detail.error}
          actionLabel="重新加载"
          onAction={() => void detail.reload()}
        />
      );
    }
    return <PageStatus title="正在加载收藏夹详情" description={title} />;
  }

  const items = detail.data;

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="favorite-detail-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav' }}
      >
        <SectionHeader title={title} description="先支持查看和播放，复杂管理动作后置。" actionLabel={`${items.length} 个视频`} />
        <div className="media-grid">
          {items.map((item, index) => (
            <MediaCard
              key={`${item.bvid}:${item.cid}`}
              sectionId="favorite-detail-grid"
              focusId={`favorite-detail-${index}`}
              item={{
                aid: item.aid,
                bvid: item.bvid,
                cid: item.cid,
                title: item.title,
                cover: item.cover,
                duration: item.duration,
                ownerName: item.author,
                playCount: 0,
                danmakuCount: 0,
                description: item.description,
              }}
              onClick={() => onOpenDetail({ bvid: item.bvid, title: item.title })}
            />
          ))}
        </div>
      </FocusSection>
    </main>
  );
}
