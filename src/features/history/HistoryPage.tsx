import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { fetchHistoryList } from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type HistoryPageProps = {
  onLogin: () => void;
  onOpenDetail: (item: { bvid: string; title: string }) => void;
  onOpenPlayer: (item: { bvid: string; cid: number; title: string; part?: string }) => void;
};

export function HistoryPage({ onLogin, onOpenDetail, onOpenPlayer }: HistoryPageProps) {
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

  return (
    <main className="page-shell">
      <section className="content-section">
        <SectionHeader
          title="观看历史"
          description="首版优先支持继续播放和回到详情页，删除动作会在后续补成完整服务化能力。"
          actionLabel={`${items.length} 条`}
        />
        <div className="list-panel">
          {items.map((item, index) => (
            <div key={item.kid} className="list-panel__row">
              <FocusButton
                row={index}
                col={10}
                variant="card"
                className="history-card"
                defaultFocus={index === 0}
                onClick={() => onOpenPlayer({
                  bvid: item.bvid,
                  cid: item.cid,
                  title: item.title,
                  part: item.part,
                })}
              >
                <img src={item.cover} alt="" className="history-card__cover" />
                <div className="history-card__body">
                  <strong>{item.title}</strong>
                  <span>{item.author}</span>
                  <small>看到 {formatProgress(item.progress)} / {formatProgress(item.duration)}</small>
                </div>
              </FocusButton>

              <FocusButton
                row={index}
                col={11}
                variant="glass"
                onClick={() => onOpenDetail({ bvid: item.bvid, title: item.title })}
              >
                查看详情
              </FocusButton>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatProgress(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(value / 60);
  const remain = value % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}
