import { FocusButton } from '../../components/FocusButton';

type PlayerPageProps = {
  title: string;
  onBack: () => void;
};

export function PlayerPage({ title, onBack }: PlayerPageProps) {
  return (
    <main className="page-shell">
      <section className="player-stage">
        <div className="player-surface">
          <div className="player-surface__badge">播放器占位</div>
          <h1>{title}</h1>
          <p>
            下一步将在这里接入真实播放地址解析、清晰度切换、弹幕开关与播放器控制层。
          </p>
        </div>

        <div className="player-controls">
          <FocusButton row={0} col={0} onClick={onBack}>
            返回首页
          </FocusButton>
          <FocusButton row={0} col={1} onClick={() => window.alert('后续接入暂停/继续')}>
            暂停/继续
          </FocusButton>
          <FocusButton row={0} col={2} onClick={() => window.alert('后续接入选集')}>
            选集占位
          </FocusButton>
        </div>
      </section>
    </main>
  );
}
