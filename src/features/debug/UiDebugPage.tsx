import type { ReactNode } from 'react';
import { TV_ICONS } from '../../app/iconRegistry';
import { BilibiliBrandMark } from '../../components/BilibiliBrandMark';
import { FollowingSummaryChips } from '../../components/FollowingSummaryChips';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { PlayerControlBar } from '../../components/PlayerControlBar';
import { SearchComposer } from '../../components/SearchComposer';
import { SectionHeader } from '../../components/SectionHeader';
import { TopbarProfilePill } from '../../components/TopbarProfilePill';
import { TvProgressBar } from '../../components/TvProgressBar';
import { TvIcon } from '../../components/TvIcon';
import { TvIconButton } from '../../components/TvIconButton';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import type { VideoCardItem } from '../../services/api/types';
import { PlayerSettingsDrawer } from '../player/PlayerSettingsDrawer';
import {
  UI_DEBUG_DIRECT_FLAG,
  UI_DEBUG_DIRECT_ROUTE,
  UI_DEBUG_SHORTCUT_LABEL,
} from './uiDebug';

type UiDebugPageProps = {
  onExit: () => void;
};

const SAMPLE_COVER = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fb7299"/>
        <stop offset="55%" stop-color="#6f4bff"/>
        <stop offset="100%" stop-color="#00a1d6"/>
      </linearGradient>
      <radialGradient id="glow" cx="30%" cy="25%" r="45%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <rect width="1280" height="720" fill="url(#glow)"/>
    <circle cx="1030" cy="200" r="220" fill="rgba(255,255,255,0.12)"/>
    <circle cx="230" cy="540" r="170" fill="rgba(0,0,0,0.16)"/>
    <text x="96" y="564" fill="white" font-size="110" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif" font-weight="700">
      UI DEBUG
    </text>
    <text x="104" y="636" fill="rgba(255,255,255,0.82)" font-size="38" font-family="Segoe UI, PingFang SC, Microsoft YaHei, sans-serif">
      bilibili webOS control showcase
    </text>
  </svg>
`)}`;

const CARD_ITEMS: VideoCardItem[] = [
  {
    aid: 1,
    bvid: 'BV1debug001',
    cid: 1001,
    title: '视频卡片样式样本',
    cover: SAMPLE_COVER,
    duration: 356,
    ownerName: '首页 / 热门 / 搜索',
    playCount: 888000,
    danmakuCount: 960,
    reason: '推荐卡片',
    typeName: 'MediaCard',
    metaText: '用于首页、热门、搜索、收藏等列表',
  },
  {
    aid: 2,
    bvid: 'BV1debug002',
    cid: 1002,
    title: '卡片内文案与徽标布局',
    cover: SAMPLE_COVER,
    duration: 542,
    ownerName: '视频详情 / 相关推荐',
    playCount: 645000,
    danmakuCount: 1230,
    badge: '热播',
    reason: '相关推荐',
    typeName: 'Video Card',
    metaText: '用于网格内容入口',
  },
  {
    aid: 3,
    bvid: 'BV1debug003',
    cid: 1003,
    title: '用于观察 16:9 封面、角标、标题截断',
    cover: SAMPLE_COVER,
    duration: 1280,
    ownerName: '长标题样本',
    playCount: 1204000,
    danmakuCount: 2830,
    typeName: 'Grid Item',
    metaText: '用于检查遥控聚焦与文案溢出',
  },
];

const PLAYER_INFO_ROWS = [
  ['当前画质', '1080P 高码率'],
  ['编码偏好', 'Auto / AVC / HEVC / AV1'],
  ['线路来源', 'DASH + 兼容源回退'],
  ['最近用途', '播放器右侧设置抽屉'],
] as const;

const COMPONENT_STATUS = {
  unified: [
    'FocusButton / TvIconButton：主按钮、图标按钮、导航项、播放器控制按钮',
    'MediaCard：首页、热门、搜索、收藏等视频卡片',
    'SectionHeader：内容分区标题',
    'PlayerControlBar：播放器底部主控制条',
    'SearchComposer：搜索页与搜索结果页输入面板',
    'TvProgressBar：播放器进度展示与 UI Debug 进度样本',
    'PlayerSettingsDrawer / PlayerSubtitlePanel：播放器设置类抽屉',
    'TopbarProfilePill：应用壳右上角账号状态胶囊',
    'FollowingSummaryChips：关注页顶部账号摘要标签',
  ],
  rules: [
    'UI Debug 只保留真实在用组件，不陈列已经废弃或已被统一规则淘汰的历史样式。',
    '设置类面板统一使用显式焦点网格规则，不再依赖几何猜测焦点移动。',
    '关键 flex / column / wrap 布局补 margin fallback，不能只依赖 Simulator 里的 gap。',
  ],
};

type TopSwitcherSample = {
  focusId: string;
  label: string;
  variant: 'primary' | 'glass';
  defaultFocus?: boolean;
  hint?: string;
};

const TOP_SWITCHER_SAMPLES: TopSwitcherSample[] = [
  {
    focusId: 'ui-debug-switch-home',
    label: '个性推荐',
    variant: 'primary',
    defaultFocus: true,
  },
  {
    focusId: 'ui-debug-switch-following',
    label: '正在关注',
    variant: 'glass',
  },
  {
    focusId: 'ui-debug-switch-folder',
    label: '默认收藏夹',
    hint: '24 个视频',
    variant: 'glass',
  },
] as const;

function buildClassName(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

type StaticButtonSampleProps = {
  label: string;
  variant: 'primary' | 'secondary' | 'glass';
  size?: 'md' | 'hero';
  forcedState?: 'focused' | 'pressed';
  disabled?: boolean;
  extraClassName?: string;
};

function StaticButtonSample({
  label,
  variant,
  size = 'md',
  forcedState,
  disabled = false,
  extraClassName,
}: StaticButtonSampleProps) {
  return (
    <button
      type="button"
      className={buildClassName(
        'focus-button',
        `focus-button--${variant}`,
        `focus-button--${size}`,
        extraClassName,
        disabled && 'focus-button--disabled',
      )}
      data-focus-active={forcedState === 'focused' ? 'true' : undefined}
      data-focus-pressed={forcedState === 'pressed' ? 'true' : undefined}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden="true"
    >
      {label}
    </button>
  );
}

type StaticIconButtonSampleProps = {
  label: string;
  symbol: (typeof TV_ICONS)[keyof typeof TV_ICONS];
  forcedState?: 'focused' | 'pressed';
  disabled?: boolean;
  className?: string;
};

function StaticIconButtonSample({
  label,
  symbol,
  forcedState,
  disabled = false,
  className,
}: StaticIconButtonSampleProps) {
  return (
    <button
      type="button"
      className={buildClassName(
        'focus-button',
        'focus-button--glass',
        'focus-button--md',
        'player-control-bar__action',
        className,
        disabled && 'focus-button--disabled',
      )}
      data-focus-active={forcedState === 'focused' ? 'true' : undefined}
      data-focus-pressed={forcedState === 'pressed' ? 'true' : undefined}
      disabled={disabled}
      tabIndex={-1}
      aria-hidden="true"
    >
      <span className="tv-icon-button__content">
        <span className="tv-icon-button__icon">
          <TvIcon symbol={symbol} size="md" />
        </span>
        <span className="tv-icon-button__label">{label}</span>
      </span>
    </button>
  );
}

type ShowcaseCardProps = {
  title: string;
  usedIn: string;
  source: string;
  children: ReactNode;
};

function ShowcaseCard({ title, usedIn, source, children }: ShowcaseCardProps) {
  return (
    <article className="ui-debug-showcase-card">
      <div className="ui-debug-showcase-card__meta">
        <div>
          <h3>{title}</h3>
          <p>{usedIn}</p>
          <p className="page-helper-text">来源：{source}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function StatusList({ items }: { items: readonly string[] }) {
  return (
    <ul className="ui-debug-status-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function UiDebugPage({ onExit }: UiDebugPageProps) {
  return (
    <main className="page-shell ui-debug-page">
      <FocusSection
        as="section"
        id="ui-debug-overview"
        group="content"
        className="content-section ui-debug-hero"
        leaveFor={{ left: '@side-nav', down: '@ui-debug-buttons' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <div className="ui-debug-hero__content">
          <span className="detail-hero__tag">开发专用</span>
          <h1>UI Debug 对照台</h1>
          <p className="ui-debug-hero__lead">
            这个页面把当前项目真实在用的 TV 控件和复合模块集中摆在一起，并标明它们分别用于哪里，
            后续我们讨论“改哪个按钮 / 哪个进度条 / 哪个抽屉”时，可以直接按这里的名字对齐。
          </p>
          <div className="ui-debug-hero__notes" aria-label="调试入口说明">
            <p className="page-helper-text">快捷键：{UI_DEBUG_SHORTCUT_LABEL}</p>
            <p className="page-helper-text">直达参数：{UI_DEBUG_DIRECT_ROUTE}</p>
            <p className="page-helper-text">兼容别名：{UI_DEBUG_DIRECT_FLAG}</p>
          </div>
          <div className="ui-debug-hero__actions">
            <FocusButton
              variant="primary"
              size="hero"
              sectionId="ui-debug-overview"
              focusId="ui-debug-exit"
              defaultFocus
              onClick={onExit}
            >
              关闭 UI Debug
            </FocusButton>
            <FocusButton
              variant="secondary"
              size="hero"
              sectionId="ui-debug-overview"
              focusId="ui-debug-shortcut-hint"
            >
              焦点切到控件上可直接观察真实聚焦态
            </FocusButton>
          </div>
        </div>
        <div className="ui-debug-hero__summary">
          <div className="ui-debug-summary-card">
            <span className="ui-debug-summary-card__eyebrow">已统一来源</span>
            <StatusList items={COMPONENT_STATUS.unified} />
          </div>
          <div className="ui-debug-summary-card">
            <span className="ui-debug-summary-card__eyebrow">当前规则</span>
            <StatusList items={COMPONENT_STATUS.rules} />
          </div>
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="ui-debug-buttons"
        group="content"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@ui-debug-overview', down: '@ui-debug-nav-preview' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="基础控件"
          description="优先放最常改、最容易说不清的基础按钮与状态样本。"
          actionLabel="用于首页 Hero / 搜索 / 详情 / 个人中心 / 播放器"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="主按钮 / 次按钮 / 玻璃按钮"
            usedIn="用于：首页 Hero 主 CTA、个人中心入口、热词 chip、播放器设置抽屉按钮。"
            source="FocusButton"
          >
            <div className="ui-debug-state-grid">
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">默认态</span>
                <StaticButtonSample label="主按钮" variant="primary" />
                <StaticButtonSample label="次按钮" variant="secondary" />
                <StaticButtonSample label="玻璃按钮" variant="glass" />
              </div>
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">聚焦态</span>
                <StaticButtonSample label="主按钮" variant="primary" forcedState="focused" />
                <StaticButtonSample label="次按钮" variant="secondary" forcedState="focused" />
                <StaticButtonSample label="玻璃按钮" variant="glass" forcedState="focused" />
              </div>
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">按下态</span>
                <StaticButtonSample label="主按钮" variant="primary" forcedState="pressed" />
                <StaticButtonSample label="次按钮" variant="secondary" forcedState="pressed" />
                <StaticButtonSample label="玻璃按钮" variant="glass" forcedState="pressed" />
              </div>
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">禁用态</span>
                <StaticButtonSample label="主按钮" variant="primary" disabled />
                <StaticButtonSample label="次按钮" variant="secondary" disabled />
                <StaticButtonSample label="玻璃按钮" variant="glass" disabled />
              </div>
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="图标按钮状态"
            usedIn="用于：播放器底部控制条、后续可扩展到更多带图标的一键操作。"
            source="TvIconButton + FocusButton"
          >
            <div className="ui-debug-state-grid">
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">默认态</span>
                <StaticIconButtonSample label="返回" symbol={TV_ICONS.playerBack} />
                <StaticIconButtonSample label="设置" symbol={TV_ICONS.playerSettings} />
                <StaticIconButtonSample label="推荐" symbol={TV_ICONS.playerRecommendations} />
              </div>
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">聚焦态</span>
                <StaticIconButtonSample label="返回" symbol={TV_ICONS.playerBack} forcedState="focused" />
                <StaticIconButtonSample label="设置" symbol={TV_ICONS.playerSettings} forcedState="focused" />
                <StaticIconButtonSample label="推荐" symbol={TV_ICONS.playerRecommendations} forcedState="focused" />
              </div>
              <div className="ui-debug-state-row">
                <span className="ui-debug-state-label">禁用态</span>
                <StaticIconButtonSample label="CC 字幕" symbol={TV_ICONS.playerSubtitle} disabled className="player-control-bar__action--inactive" />
              </div>
            </div>
          </ShowcaseCard>
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="ui-debug-nav-preview"
        group="content"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@ui-debug-buttons', down: '@ui-debug-shell-preview' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="导航与入口模块"
          description="这里不是正式侧边栏，而是用同一套样式搭出来的导航预览，方便单独点名“侧边导航项”的样子。"
          actionLabel="用于左侧全局导航"
        />

        <ShowcaseCard
          title="导航项与导航容器"
          usedIn="用于：左侧 SideNavRail 的品牌区与导航项。"
          source="TvIconButton + side-nav-rail 样式"
        >
          <div className="ui-debug-nav-stage">
            <aside className="side-nav-rail ui-debug-nav-rail" aria-label="导航预览">
              <div className="side-nav-rail__brand">
                <span className="side-nav-rail__logo" aria-hidden="true">
                  <BilibiliBrandMark />
                </span>
                <div className="side-nav-rail__brand-copy">
                  <strong>Bilibili</strong>
                  <p>webOS 客厅版</p>
                </div>
              </div>
              <div className="side-nav-rail__list">
                <TvIconButton
                  sectionId="ui-debug-nav-preview"
                  focusId="ui-debug-nav-home"
                  symbol={TV_ICONS.navHome}
                  label="首页"
                  iconSize="lg"
                  variant="nav"
                  size="md"
                  className="side-nav-item side-nav-item--active"
                  defaultFocus
                />
                <TvIconButton
                  sectionId="ui-debug-nav-preview"
                  focusId="ui-debug-nav-hot"
                  symbol={TV_ICONS.navHot}
                  label="热门"
                  iconSize="lg"
                  variant="nav"
                  size="md"
                  className="side-nav-item"
                />
                <TvIconButton
                  sectionId="ui-debug-nav-preview"
                  focusId="ui-debug-nav-profile"
                  symbol={TV_ICONS.navProfile}
                  label="我的"
                  iconSize="lg"
                  variant="nav"
                  size="md"
                  className="side-nav-item"
                />
              </div>
            </aside>
          </div>
        </ShowcaseCard>
      </FocusSection>

      <FocusSection
        as="section"
        id="ui-debug-shell-preview"
        group="content"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@ui-debug-nav-preview', down: '@ui-debug-card-preview' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="壳层与摘要标签"
          description="这里补上之前漏掉的应用壳层胶囊和关注页摘要标签，它们也属于真实在用的 UI。"
          actionLabel="用于全局顶栏 / 关注页摘要"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="顶栏账号胶囊"
            usedIn="用于：AppShell 右上角账号摘要展示，统一收纳昵称与登录态说明。"
            source="TopbarProfilePill"
          >
            <div className="ui-debug-shell-row">
              <TopbarProfilePill title="liuyangart" badge="UP" />
              <TopbarProfilePill title="游客模式" badge="TV" />
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="关注摘要标签组"
            usedIn="用于：关注页顶部账号摘要，区分有更新和普通账号。"
            source="FollowingSummaryChips"
          >
            <FollowingSummaryChips
              items={[
                { key: '1', label: '小黛晨读', active: true },
                { key: '2', label: '蝙蝠天地Meanders' },
                { key: '3', label: '影视飓风', active: true },
                { key: '4', label: '戈登边埂子Gordon' },
              ]}
            />
          </ShowcaseCard>
        </div>
      </FocusSection>

      <section className="content-section">
        <SectionHeader
          title="卡片与内容模块"
          description="这里保留真实还在使用的内容入口样式，重点看顶部切换器和视频卡片。"
          actionLabel="用于首页 / 收藏夹 / 推荐流 / 详情页"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="顶部切换器"
            usedIn="用于：首页频道切换、收藏夹切换。这两处现在统一使用收藏夹的圆角矩形样式。"
            source="FocusButton + detail-chip + library-folder-chip"
          >
            <div className="library-folder-strip">
              {TOP_SWITCHER_SAMPLES.map((item) => (
                <FocusButton
                  key={item.focusId}
                  variant={item.variant}
                  size="md"
                  className="detail-chip library-folder-chip"
                  sectionId="ui-debug-card-preview"
                  focusId={item.focusId}
                  defaultFocus={item.defaultFocus}
                >
                  <span>{item.label}</span>
                  {item.hint ? <small>{item.hint}</small> : null}
                </FocusButton>
              ))}
            </div>
          </ShowcaseCard>
        </div>

        <FocusSection
          as="div"
          id="ui-debug-card-preview"
          group="content"
          className="ui-debug-showcase-grid"
          leaveFor={{ left: '@side-nav', up: '@ui-debug-shell-preview', down: '@ui-debug-inputs' }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <ShowcaseCard
            title="视频卡片"
            usedIn="用于：首页视频网格、热门页、搜索结果、收藏与历史。"
            source="MediaCard"
          >
            <div className="media-grid ui-debug-media-grid">
              {CARD_ITEMS.map((item, index) => (
                <MediaCard
                  key={item.bvid}
                  item={item}
                  sectionId="ui-debug-card-preview"
                  focusId={`ui-debug-card-${index}`}
                  onClick={() => {}}
                />
              ))}
            </div>
          </ShowcaseCard>
        </FocusSection>
      </section>

      <FocusSection
        as="section"
        id="ui-debug-inputs"
        group="content"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@ui-debug-card-preview', down: '@ui-debug-player-controls' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader
          title="输入与轻量说明"
          description="保留搜索输入面板、辅助文字和统一后的轻量标签入口，不再陈列已经淘汰的旧变体。"
          actionLabel="用于搜索页 / 空态提示 / 标签入口"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="搜索输入面板"
            usedIn="用于：搜索页和搜索结果页的输入面板，现在已经统一收口。"
            source="SearchComposer"
          >
            <SearchComposer
              value="遥控器焦点样式"
              submitLabel="立即搜索"
              readOnly
              onChange={() => {}}
              onSubmit={() => {}}
              onClose={() => {}}
            />
          </ShowcaseCard>

          <ShowcaseCard
            title="辅助文案 / 统一标签"
            usedIn="用于：空态提示、搜索页轻量说明，以及热搜 / 搜索历史这类统一后的标签入口。"
            source="page-helper-text / detail-chip"
          >
            <div className="ui-debug-copy-block">
              <p className="page-helper-text">还没有历史搜索，先试试热搜或默认词。</p>
              <div className="chip-grid ui-debug-chip-grid">
                <FocusButton
                  variant="glass"
                  className="detail-chip"
                  sectionId="ui-debug-inputs"
                  focusId="ui-debug-chip-hot"
                >
                  热搜
                  <small>统一标签样式</small>
                </FocusButton>
                <FocusButton
                  variant="glass"
                  className="detail-chip"
                  sectionId="ui-debug-inputs"
                  focusId="ui-debug-chip-history"
                >
                  搜索历史
                  <small>与热搜使用同一套样式</small>
                </FocusButton>
              </div>
            </div>
          </ShowcaseCard>
        </div>
      </FocusSection>

      <section className="content-section">
        <SectionHeader
          title="播放器复合模块"
          description="这里把播放器里最容易反复调整的控件集中摆出来，重点看 OSD 和设置抽屉基线。"
          actionLabel="用于播放器页"
        />

        <div className="ui-debug-showcase-grid ui-debug-showcase-grid--single">
          <ShowcaseCard
            title="播放进度条"
            usedIn="用于：播放器顶部 OSD 区域的当前进度与本地记录提示，现在已经统一收口。"
            source="TvProgressBar"
          >
            <div className="ui-debug-progress-stage">
              <TvProgressBar
                leadingLabel="01:34 / 24:18"
                trailingLabel="已同步本地播放记录"
                valuePercent={37}
              />
            </div>
          </ShowcaseCard>
        </div>

        <FocusSection
          as="div"
          id="ui-debug-player-controls"
          group="content"
          className="ui-debug-showcase-grid"
          leaveFor={{ left: '@side-nav', up: '@ui-debug-inputs', down: '@ui-debug-player-panels' }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <ShowcaseCard
            title="播放器底部控制条"
            usedIn="用于：播放器主操作区，包含返回、快退快进、播放暂停、分P、字幕、设置、推荐。"
            source="PlayerControlBar"
          >
            <div className="ui-debug-player-bar-stage">
              <PlayerControlBar
                sectionId="ui-debug-player-bar"
                isPlaying
                onBack={() => {}}
                onReplay={() => {}}
                onTogglePlay={() => {}}
                onForward={() => {}}
                onRestartFromBeginning={() => {}}
                onRefresh={() => {}}
                onOpenEpisodes={() => {}}
                onOpenSubtitles={() => {}}
                onOpenSettings={() => {}}
                onOpenRecommendations={() => {}}
              />
            </div>
          </ShowcaseCard>
        </FocusSection>

        <FocusSection
          as="div"
          id="ui-debug-player-panels"
          group="content"
          className="ui-debug-showcase-grid"
          leaveFor={{ left: '@side-nav', up: '@ui-debug-player-controls' }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <ShowcaseCard
            title="设置抽屉基线"
            usedIn="用于：播放器右侧设置类面板的统一样式来源。真实字幕设置页复用这一套抽屉标题、section 节奏、chip 按钮和信息块基线。"
            source="PlayerSettingsDrawer"
          >
            <div className="ui-debug-drawer-stage">
              <div className="player-settings-drawer ui-debug-player-drawer">
                <PlayerSettingsDrawer
                  sectionId="ui-debug-player-panels"
                  badge="播放设置"
                  qualityOptions={[
                    {
                      key: 'ui-debug-quality-1080',
                      label: (
                        <>
                          1080P
                          <small>当前默认画质</small>
                        </>
                      ),
                      variant: 'primary',
                      defaultFocus: true,
                    },
                    {
                      key: 'ui-debug-quality-720',
                      label: (
                        <>
                          720P
                          <small>回退画质</small>
                        </>
                      ),
                      variant: 'glass',
                    },
                  ]}
                  infoRows={PLAYER_INFO_ROWS.map(([label, value]) => ({ key: label, label, value }))}
                  actionOptions={[
                    {
                      key: 'ui-debug-refresh-source',
                      label: '重载播放源',
                      variant: 'secondary',
                    },
                    {
                      key: 'ui-debug-open-report',
                      label: '查看当前候选顺序',
                      variant: 'glass',
                    },
                  ]}
                  planText="1080P AVC -> 1080P HEVC -> 720P AVC"
                />
              </div>
            </div>
          </ShowcaseCard>
        </FocusSection>
      </section>
    </main>
  );
}
