import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { SectionHeader } from '../../components/SectionHeader';

type PlayerPageProps = {
  title: string;
  onBack: () => void;
};

export function PlayerPage({ title, onBack }: PlayerPageProps) {
  return (
    <main className="page-shell page-shell--player">
      <section className="player-hero">
        <div className="player-hero__visual" aria-hidden="true">
          <div className="player-hero__glow player-hero__glow--pink" />
          <div className="player-hero__glow player-hero__glow--blue" />
        </div>

        <div className="player-hero__top">
          <div className="player-hero__title-group">
            <span className="player-hero__badge">正在播放</span>
            <h1>{title}</h1>
            <p>UP 主：客厅实验室 · 124 万播放 · 2 小时前更新</p>
          </div>
        </div>

        <div className="player-hero__bottom">
          <div className="player-progress">
            <div className="player-progress__meta">
              <span>12:45 / 24:30</span>
              <span>下一条：大屏播放器控制层拆解</span>
            </div>
            <div className="player-progress__track">
              <div className="player-progress__buffer" />
              <div className="player-progress__value" />
            </div>
          </div>

          <PlayerControlBar
            onBack={onBack}
            onReplay={() => window.alert('后续接入后退 10 秒')}
            onTogglePlay={() => window.alert('后续接入暂停 / 继续')}
            onForward={() => window.alert('后续接入前进 10 秒')}
            onDanmaku={() => window.alert('后续接入弹幕开关')}
            onQuality={() => window.alert('后续接入清晰度切换')}
            onSettings={() => window.alert('后续接入播放器设置')}
          />
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          title="相关推荐"
          description="继续沿用首页的卡片体系，验证播放器页向下浏览时的焦点衔接。"
          actionLabel="更多推荐"
        />
        <div className="media-grid">
          <MediaCard
            row={1}
            col={0}
            title="赛博夜景城市巡游"
            subtitle="视觉混剪 · 89 万播放"
            duration="15:34"
            tone="cyan"
            onClick={() => window.alert('后续接入相关推荐跳转')}
          />
          <MediaCard
            row={1}
            col={1}
            title="播放器控件交互评审"
            subtitle="产品设计 · 焦点与返回链路"
            duration="09:48"
            tone="violet"
            onClick={() => window.alert('后续接入相关推荐跳转')}
          />
          <MediaCard
            row={1}
            col={2}
            title="TV 端 UI 视觉规范拆解"
            subtitle="工程实现 · 组件抽象"
            duration="11:26"
            tone="rose"
            onClick={() => window.alert('后续接入相关推荐跳转')}
          />
        </div>
      </section>
    </main>
  );
}
