import { HeroBanner } from '../../components/HeroBanner';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';

type HomePageProps = {
  onOpenPlayer: (videoTitle: string) => void;
};

const featuredTitle = '青春跃动：夏日祭典';

const recommendedVideos = [
  { title: '总决赛舞台全回顾', subtitle: '二创热榜 · 856 万播放', duration: '24:15', tone: 'sunset' },
  { title: '盛夏烟火名场面', subtitle: '动画混剪 · 402 万播放', duration: '12:04', tone: 'peach' },
  { title: '乐队现场幕后纪录', subtitle: '音乐现场 · 218 万播放', duration: '18:42', tone: 'cyan' },
] as const;

const trendingVideos = [
  { title: '客厅模式焦点演示', subtitle: '产品设计 · 遥控器交互', duration: '08:36', tone: 'violet' },
  { title: '播放器控制层草图', subtitle: '前端实现 · 控制层结构', duration: '14:20', tone: 'rose' },
  { title: '登录与搜索页预告', subtitle: '规划拆解 · 下一阶段', duration: '10:08', tone: 'ember' },
] as const;

export function HomePage({ onOpenPlayer }: HomePageProps) {
  return (
    <main className="page-shell page-shell--home">
      <HeroBanner
        title={featuredTitle}
        description="以电影感的大屏编排重构首页体验，先验证 Hero、CTA、泳道卡片与遥控器焦点态，再继续铺开搜索、登录与历史页面。"
        meta={['9.8 高分', '240 万播放', '动画 · 夏日企划']}
        onPlay={() => onOpenPlayer(featuredTitle)}
        onSecondaryAction={() => window.alert('后续接入稍后再看能力')}
      />

      <section className="content-section">
        <SectionHeader
          title="为你推荐"
          description="先验证首页卡片视觉、时长角标和 D-pad 焦点流。"
          actionLabel="探索全部"
        />
        <div className="media-grid">
          {recommendedVideos.map((video, index) => (
            <MediaCard
              key={video.title}
              row={1}
              col={index}
              title={video.title}
              subtitle={video.subtitle}
              duration={video.duration}
              tone={video.tone}
              onClick={() => onOpenPlayer(video.title)}
            />
          ))}
        </div>
      </section>

      <section className="content-section">
        <SectionHeader
          title="继续推进"
          description="这里先承载下一阶段要替换的页面主题，保持和首页同一套视觉语言。"
          actionLabel="阶段二"
        />
        <div className="media-grid">
          {trendingVideos.map((video, index) => (
            <MediaCard
              key={video.title}
              row={2}
              col={index}
              title={video.title}
              subtitle={video.subtitle}
              duration={video.duration}
              tone={video.tone}
              onClick={() => onOpenPlayer(video.title)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
