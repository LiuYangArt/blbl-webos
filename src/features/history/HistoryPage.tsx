import { useAsyncData } from '../../app/useAsyncData';
import { VideoGridSection } from '../../components/VideoGridSection';
import { fetchHistoryList } from '../../services/api/bilibili';
import { createDirectVideoListItem, mapHistoryItemToVideoCard } from '../shared/videoListItems';
import { PageStatus } from '../shared/PageStatus';

type HistoryPageProps = {
  onLogin: () => void;
  onOpenPlayer: (item: { bvid: string; cid: number; title: string; part?: string }) => void;
};

export function HistoryPage({ onLogin, onOpenPlayer }: HistoryPageProps) {
  const history = useAsyncData(() => fetchHistoryList(), []);

  if (history.status !== 'success') {
    if (history.status === 'error') {
      return (
        <PageStatus
          title="历史记录暂不可用"
          description="通常是当前还没有登录态，或者浏览器环境尚未拿到哔哩哔哩 Cookie。"
          actionLabel="去登录"
          onAction={onLogin}
        />
      );
    }
    return <PageStatus title="正在同步观看历史" description="如果你已登录，会自动读取云端历史记录。" />;
  }

  const items = history.data;
  const videoItems = items.map((item) => createDirectVideoListItem(
    item.kid,
    mapHistoryItemToVideoCard(item),
    {
      bvid: item.bvid,
      cid: item.cid,
      title: item.title,
      part: item.part,
    },
  ));

  return (
    <main className="page-shell">
      <VideoGridSection
        sectionId="history-list"
        title="观看历史"
        description="统一为可直接继续播放的视频列表，向下浏览时会继续补出更多卡片。"
        actionLabel={`${items.length} 条`}
        items={videoItems}
        onOpenPlayer={onOpenPlayer}
      />
    </main>
  );
}
