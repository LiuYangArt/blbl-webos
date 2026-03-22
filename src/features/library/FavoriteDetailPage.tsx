import { useState } from 'react';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import { fetchFavoriteFolderDetail, fetchVideoDetail } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type FavoriteDetailPageProps = {
  mediaId: number;
  title: string;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function FavoriteDetailPage({ mediaId, title, onOpenPlayer }: FavoriteDetailPageProps) {
  const detail = useAsyncData(() => fetchFavoriteFolderDetail(mediaId), [mediaId]);
  const [pendingBvid, setPendingBvid] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const openFavoritePlayer = async (item: {
    bvid: string;
    cid: number;
    title: string;
  }) => {
    setResolveError(null);
    setPendingBvid(item.bvid);

    try {
      const detail = await fetchVideoDetail(item.bvid);
      const matchedPart = detail.parts.find((part) => part.cid === item.cid);
      const targetPart = matchedPart ?? detail.parts[0];
      const targetCid = targetPart?.cid ?? detail.cid;

      if (!targetCid) {
        throw new Error('收藏视频缺少有效 CID，暂时无法播放');
      }

      onOpenPlayer({
        bvid: item.bvid,
        cid: targetCid,
        title: detail.title || item.title,
        part: targetPart?.part,
      });
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : '补全收藏视频播放信息失败');
    } finally {
      setPendingBvid(null);
    }
  };

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
        <SectionHeader title={title} description="先支持直接播放，复杂管理动作后置。" actionLabel={`${items.length} 个视频`} />
        {resolveError ? <p className="page-helper-text">{resolveError}</p> : null}
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
              onClick={() => void openFavoritePlayer({ bvid: item.bvid, cid: item.cid, title: item.title })}
            />
          ))}
        </div>
        {pendingBvid ? <p className="page-helper-text">正在补全收藏视频播放信息：{pendingBvid}</p> : null}
      </FocusSection>
    </main>
  );
}
