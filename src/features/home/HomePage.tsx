import { FocusButton } from '../../components/FocusButton';

type HomePageProps = {
  onOpenPlayer: (videoTitle: string) => void;
};

const mockVideos = [
  '年度热门动画合集',
  'WebOS 客户端原型演示',
  '电视端焦点导航测试',
  '播放器交互演示片段',
  '扫码登录流程占位',
  '搜索结果样式草稿',
];

export function HomePage({ onOpenPlayer }: HomePageProps) {
  return (
    <main className="page-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">LG webOS TV</p>
          <h1>哔哩哔哩电视端启动骨架</h1>
          <p className="hero-copy">
            当前版本先验证遥控器、焦点、页面栈和播放器入口。后续再接入真实接口与登录播放链路。
          </p>
        </div>
        <div className="hero-actions">
          <FocusButton row={0} col={0} onClick={() => onOpenPlayer('启动演示视频')}>
            进入播放器页
          </FocusButton>
          <FocusButton row={0} col={1} onClick={() => window.alert('后续接入搜索页')}>
            搜索占位
          </FocusButton>
        </div>
      </header>

      <section className="section-block">
        <div className="section-header">
          <h2>推荐内容占位</h2>
          <span>验证网格焦点导航</span>
        </div>

        <div className="video-grid">
          {mockVideos.map((title, index) => {
            const row = Math.floor(index / 3) + 1;
            const col = index % 3;

            return (
              <FocusButton
                key={title}
                row={row}
                col={col}
                className="video-card"
                onClick={() => onOpenPlayer(title)}
              >
                <span className="video-card__tag">演示</span>
                <strong>{title}</strong>
                <small>按确认键进入播放器占位页</small>
              </FocusButton>
            );
          })}
        </div>
      </section>
    </main>
  );
}
