import type { ReactNode } from 'react';
import { useAsyncData } from '../../app/useAsyncData';
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
import { fetchRecommendedVideos } from '../../services/api/bilibili';
import type { VideoCardItem } from '../../services/api/types';
import { readHomePublicFeedCache } from '../home/homeFeedCache';
import { PlayerSettingsDrawer } from '../player/PlayerSettingsDrawer';
import {
  UI_DEBUG_DIRECT_FLAG,
  UI_DEBUG_DIRECT_ROUTE,
  UI_DEBUG_SHORTCUT_LABEL,
} from './uiDebug';

type UiDebugPageProps = {
  onExit: () => void;
};

const EMPTY_HANDLER = () => {};

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

const DEFAULT_CARD_ITEMS: VideoCardItem[] = [
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

const GUIDE_RULES = [
  '阅读顺序固定为“先看基础单体元素，再看组合元素”，讨论改动时优先引用上半区名称。',
  '下半区只展示真实业务里的高价值组合块，不把业务消费者误当成新的基础来源。',
  '如果组合块需要新语义，必须先补到上半区基础单体元素，再允许进入下半区。',
] as const;

type TopSwitcherSample = {
  key: string;
  label: string;
  variant: 'primary' | 'glass';
  defaultFocus?: boolean;
  hint?: string;
};

const TOP_SWITCHER_SAMPLES: TopSwitcherSample[] = [
  {
    key: 'home',
    label: '个性推荐',
    variant: 'primary',
    defaultFocus: true,
  },
  {
    key: 'following',
    label: '正在关注',
    variant: 'glass',
  },
  {
    key: 'folder',
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
}: StaticButtonSampleProps): React.JSX.Element {
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
}: StaticIconButtonSampleProps): React.JSX.Element {
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
  noteLabel: string;
  noteText: string;
  children: ReactNode;
  className?: string;
};

function ShowcaseCard({
  title,
  usedIn,
  noteLabel,
  noteText,
  children,
  className,
}: ShowcaseCardProps): React.JSX.Element {
  return (
    <article className={buildClassName('ui-debug-showcase-card', className)}>
      <div className="ui-debug-showcase-card__meta">
        <div>
          <h3>{title}</h3>
          <p>{usedIn}</p>
          <p className="page-helper-text ui-debug-showcase-card__note">
            {noteLabel}：{noteText}
          </p>
        </div>
      </div>
      {children}
    </article>
  );
}

function TextStyleShowcase(): React.JSX.Element {
  return (
    <div className="ui-debug-text-stage">
      <div className="ui-debug-text-stage__hero">
        <span className="detail-hero__tag">页面主标题</span>
        <h4 className="ui-debug-text-stage__page-title">TV 页面主标题层级</h4>
        <p className="page-helper-text">
          用于首页、详情或需要单独建立阅读层级的主标题，不从组合块里反推标题基线。
        </p>
      </div>
      <div className="ui-debug-text-stage__divider" aria-hidden="true" />
      <SectionHeader
        title="SectionHeader / 分区标题"
        description="用于首页、搜索、详情、播放器等内容分区标题。"
        actionLabel="统一标题样式"
      />
      <p className="page-helper-text">
        辅助说明文案使用 `page-helper-text`，承担空态提示、输入引导和配置说明。
      </p>
    </div>
  );
}

function TabChipShowcase({
  sectionId,
  focusIdPrefix,
  leaveFor,
}: {
  sectionId: string;
  focusIdPrefix: string;
  leaveFor: { up?: string; down?: string; left?: string };
}): React.JSX.Element {
  return (
    <FocusSection
      as="div"
      id={sectionId}
      group="content"
      className="library-folder-strip"
      leaveFor={leaveFor}
      scroll={CONTENT_FIRST_ROW_SCROLL}
    >
      {TOP_SWITCHER_SAMPLES.map((item) => (
        <FocusButton
          key={`${focusIdPrefix}-${item.key}`}
          variant={item.variant}
          size="md"
          className="detail-chip library-folder-chip"
          sectionId={sectionId}
          focusId={`${focusIdPrefix}-${item.key}`}
          defaultFocus={item.defaultFocus}
        >
          <span>{item.label}</span>
          {item.hint ? <small>{item.hint}</small> : null}
        </FocusButton>
      ))}
    </FocusSection>
  );
}

function SearchComposerFields({
  sectionId,
  focusPrefix,
  defaultFocus = false,
}: {
  sectionId: string;
  focusPrefix: string;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <div className="ui-debug-search-composer">
      <SearchComposer
        fields={[
          {
            key: `${focusPrefix}-keyword`,
            label: '关键词',
            value: '遥控器焦点样式',
            placeholder: '输入搜索关键词',
            readOnly: true,
            sectionId,
            focusId: `${focusPrefix}-keyword`,
            defaultFocus,
            onChange: EMPTY_HANDLER,
          },
        ]}
        submitLabel="立即搜索"
        readOnly
        onSubmit={EMPTY_HANDLER}
        onClose={EMPTY_HANDLER}
      />
      <SearchComposer
        fields={[
          {
            key: `${focusPrefix}-relay-host`,
            label: '服务器 IP',
            value: '192.168.50.10',
            placeholder: '例如 192.168.50.10',
            readOnly: true,
            sectionId,
            focusId: `${focusPrefix}-relay-host`,
            valueFilter: 'ip-address',
            onChange: EMPTY_HANDLER,
          },
          {
            key: `${focusPrefix}-relay-port`,
            label: '端口',
            value: '19091',
            placeholder: '19091',
            readOnly: true,
            sectionId,
            focusId: `${focusPrefix}-relay-port`,
            valueFilter: 'digits',
            onChange: EMPTY_HANDLER,
          },
        ]}
      />
    </div>
  );
}

function SearchEntryComposition(): React.JSX.Element {
  return (
    <FocusSection
      as="div"
      id="ui-debug-composition-search"
      group="content"
      className="ui-debug-stage ui-debug-search-stage"
      leaveFor={{
        left: '@side-nav',
        up: '@ui-debug-composition-tabs',
        down: '@ui-debug-composition-controls',
      }}
      scroll={CONTENT_FIRST_ROW_SCROLL}
    >
      <SectionHeader
        title="搜索入口头部"
        description="真实搜索场景里的“标题 + 主操作 + 输入面板”组合。"
        actionLabel="搜索页顶部结构"
      />
      <div className="ui-debug-search-stage__actions">
        <FocusButton
          variant="primary"
          size="md"
          sectionId="ui-debug-composition-search"
          focusId="ui-debug-search-action-primary"
          defaultFocus
        >
          立即搜索
        </FocusButton>
        <FocusButton
          variant="secondary"
          size="md"
          sectionId="ui-debug-composition-search"
          focusId="ui-debug-search-action-history"
        >
          历史搜索
        </FocusButton>
      </div>
      <p className="page-helper-text">
        辅助说明文案与输入面板一起工作，用于搜索页、搜索结果页以及 relay 配置场景。
      </p>
      <SearchComposerFields sectionId="ui-debug-composition-search" focusPrefix="ui-debug-search-stage" />
    </FocusSection>
  );
}

function PlayerHeroInfoShowcase(): React.JSX.Element {
  return (
    <div className="ui-debug-player-info-stage">
      <span className="player-hero__badge">正在播放</span>
      <h4 className="ui-debug-player-info-stage__title">AI 辅助拆图 vs 传统拆图</h4>
      <p className="ui-debug-player-info-stage__meta">720P 准高清（已请求 1080P 高清） · AVC · 兼容流</p>
      <small className="player-hero__notice">CC：中文（AI）</small>
      <small className="player-hero__notice">
        若 DASH 在当前电视设备上无法稳定起播，播放器会继续尝试兼容流直连。
      </small>
    </div>
  );
}

async function loadUiDebugCardItems(): Promise<VideoCardItem[]> {
  const cachedFeed = readHomePublicFeedCache({ allowStale: true });
  if (cachedFeed && cachedFeed.data.recommended.length >= 3) {
    return cachedFeed.data.recommended.slice(0, 3);
  }

  return fetchRecommendedVideos(3, 1);
}

function resolveUiDebugCardItems(
  debugCardFeed: ReturnType<typeof useAsyncData<VideoCardItem[]>>,
): VideoCardItem[] {
  if (debugCardFeed.status !== 'success' || debugCardFeed.data.length === 0) {
    return DEFAULT_CARD_ITEMS;
  }

  return debugCardFeed.data.slice(0, 3);
}

export function UiDebugPage({ onExit }: UiDebugPageProps): React.JSX.Element {
  const debugCardFeed = useAsyncData<VideoCardItem[]>(loadUiDebugCardItems, []);
  const cardItems = resolveUiDebugCardItems(debugCardFeed);

  return (
    <main className="page-shell ui-debug-page">
      <FocusSection
        as="section"
        id="ui-debug-overview"
        group="content"
        className="content-section ui-debug-hero"
        leaveFor={{ left: '@side-nav', down: '@ui-debug-foundation-tabs' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <div className="ui-debug-hero__content">
          <span className="detail-hero__tag">真实 UI 资产目录</span>
          <h1>UI Debug 对照台</h1>
          <p className="ui-debug-hero__lead">
            这里不再按历史展示块堆页面，而是按“基础单体元素”和“组合元素”组织真实在用组件。
            以后讨论按钮、标题、Tab、卡片、搜索入口区或播放器设置抽屉，都可以先来这里对齐来源。
          </p>
          <ul className="ui-debug-rule-list" aria-label="UI Debug 使用规则">
            {GUIDE_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
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
              焦点切到下方真实组件上，可直接观察 TV 聚焦态
            </FocusButton>
          </div>
        </div>
      </FocusSection>

      <section className="content-section ui-debug-section">
        <SectionHeader
          title="基础单体元素"
          description="上半区只摆当前项目里稳定、可单独点名修改、可被组合块复用的真实 UI 元素。"
          actionLabel="先认控件，再看拼装关系"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="基础按钮"
            usedIn="用于：首页 Hero 主 CTA、详情主操作、搜索入口按钮和播放器设置抽屉操作。"
            noteLabel="来源"
            noteText="FocusButton"
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
            title="TvIconButton / 图标按钮"
            usedIn="用于：播放器底部控制条、左侧菜单栏，以及后续带图标的一键操作入口。"
            noteLabel="来源"
            noteText="TvIconButton + FocusButton"
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
                <StaticIconButtonSample
                  label="CC 字幕"
                  symbol={TV_ICONS.playerSubtitle}
                  disabled
                  className="player-control-bar__action--inactive"
                />
              </div>
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="SectionHeader / 标题样式"
            usedIn="用于：首页、搜索、详情和播放器里的分区标题，以及页面主标题层级对照。"
            noteLabel="来源"
            noteText="SectionHeader + page-helper-text"
          >
            <TextStyleShowcase />
          </ShowcaseCard>

          <ShowcaseCard
            title="播放器顶部轻量信息"
            usedIn="用于：播放器顶部的状态徽标、标题元信息、字幕状态与播放提示文案。"
            noteLabel="来源"
            noteText="player-hero__badge + player-hero__notice + 播放器标题信息样式"
          >
            <PlayerHeroInfoShowcase />
          </ShowcaseCard>

          <ShowcaseCard
            title="Tab / Chip"
            usedIn="用于：首页频道切换、收藏夹切换，以及搜索热词这类轻量标签入口。"
            noteLabel="来源"
            noteText="detail-chip + library-folder-chip"
          >
            <TabChipShowcase
              sectionId="ui-debug-foundation-tabs"
              focusIdPrefix="ui-debug-foundation-tab"
              leaveFor={{ left: '@side-nav', up: '@ui-debug-overview', down: '@ui-debug-foundation-cards' }}
            />
          </ShowcaseCard>

          <ShowcaseCard
            title="MediaCard / 视频卡片"
            usedIn="用于：首页视频网格、热门页、搜索结果、收藏与历史列表。"
            noteLabel="来源"
            noteText="MediaCard"
            className="ui-debug-showcase-card--full"
          >
            <FocusSection
              as="div"
              id="ui-debug-foundation-cards"
              group="content"
              className="media-grid ui-debug-media-grid"
              leaveFor={{
                left: '@side-nav',
                up: '@ui-debug-foundation-tabs',
                down: '@ui-debug-foundation-inputs',
              }}
              scroll={CONTENT_FIRST_ROW_SCROLL}
            >
              {cardItems.map((item, index) => (
                <MediaCard
                  key={item.bvid}
                  item={item}
                  sectionId="ui-debug-foundation-cards"
                  focusId={`ui-debug-card-${index}`}
                  onClick={EMPTY_HANDLER}
                  defaultFocus={index === 0}
                />
              ))}
            </FocusSection>
            {debugCardFeed.status === 'error' ? (
              <p className="page-helper-text">
                当前没拿到首页真实封面样本，暂时回退到本地样例卡片。
              </p>
            ) : null}
          </ShowcaseCard>

          <ShowcaseCard
            title="SearchComposer / 搜索输入面板"
            usedIn="用于：搜索页、搜索结果页，以及 relay 设置里的 IP / 端口输入面板。"
            noteLabel="来源"
            noteText="SearchComposer"
          >
            <FocusSection
              as="div"
              id="ui-debug-foundation-inputs"
              group="content"
              leaveFor={{
                left: '@side-nav',
                up: '@ui-debug-foundation-cards',
                down: '@ui-debug-composition-nav',
              }}
              scroll={CONTENT_FIRST_ROW_SCROLL}
            >
              <SearchComposerFields
                sectionId="ui-debug-foundation-inputs"
                focusPrefix="ui-debug-foundation-search"
                defaultFocus
              />
            </FocusSection>
          </ShowcaseCard>

          <ShowcaseCard
            title="TopbarProfilePill / 顶栏账号胶囊"
            usedIn="用于：AppShell 右上角账号摘要展示，统一承载昵称与登录态。"
            noteLabel="来源"
            noteText="TopbarProfilePill"
          >
            <div className="ui-debug-shell-row">
              <TopbarProfilePill title="liuyangart" badge="UP" />
              <TopbarProfilePill title="游客模式" badge="TV" />
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="FollowingSummaryChips / 关注摘要标签组"
            usedIn="用于：关注页顶部账号摘要，区分有更新和普通账号。"
            noteLabel="来源"
            noteText="FollowingSummaryChips"
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

          <ShowcaseCard
            title="TvProgressBar / 进度条"
            usedIn="用于：播放器顶部 OSD 区域的当前进度、本地记录提示和后续统一进度反馈。"
            noteLabel="来源"
            noteText="TvProgressBar"
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
      </section>

      <section className="content-section ui-debug-section">
        <SectionHeader
          title="组合元素"
          description="下半区只保留真实业务里值得对照的组合块，并明确说明它们由哪些基础元素拼出来。"
          actionLabel="每个组合块都要回指上半区来源"
        />

        <div className="ui-debug-showcase-grid">
          <ShowcaseCard
            title="左侧菜单栏"
            usedIn="用于：对照全局导航整体样子、品牌区节奏和遥控器进入内容区前的起始焦点。"
            noteLabel="由"
            noteText="TvIconButton、品牌标识、导航容器组成"
          >
            <FocusSection
              as="div"
              id="ui-debug-composition-nav"
              group="content"
              className="ui-debug-nav-stage"
              leaveFor={{
                left: '@side-nav',
                up: '@ui-debug-foundation-inputs',
                down: '@ui-debug-composition-tabs',
              }}
              scroll={CONTENT_FIRST_ROW_SCROLL}
            >
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
                    sectionId="ui-debug-composition-nav"
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
                    sectionId="ui-debug-composition-nav"
                    focusId="ui-debug-nav-hot"
                    symbol={TV_ICONS.navHot}
                    label="热门"
                    iconSize="lg"
                    variant="nav"
                    size="md"
                    className="side-nav-item"
                  />
                  <TvIconButton
                    sectionId="ui-debug-composition-nav"
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
            </FocusSection>
          </ShowcaseCard>

          <ShowcaseCard
            title="首页频道切换条"
            usedIn="用于：对照首页频道切换和收藏夹切换类条带结构，不再把它误当成新的基础来源。"
            noteLabel="由"
            noteText="SectionHeader、Tab / Chip 组成"
          >
            <div className="ui-debug-stage ui-debug-library-stage">
              <SectionHeader
                title="频道切换条"
                description="首页和收藏夹都复用同一套切换语义。"
                actionLabel="顶部切换结构"
              />
              <TabChipShowcase
                sectionId="ui-debug-composition-tabs"
                focusIdPrefix="ui-debug-composition-tab"
                leaveFor={{
                  left: '@side-nav',
                  up: '@ui-debug-composition-nav',
                  down: '@ui-debug-composition-search',
                }}
              />
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="搜索入口区"
            usedIn="用于：对照搜索页顶部“标题 + 主操作按钮 + 输入面板 + 说明文案”的组合关系。"
            noteLabel="由"
            noteText="SectionHeader、基础按钮、SearchComposer、辅助文案组成"
            className="ui-debug-showcase-card--full"
          >
            <SearchEntryComposition />
          </ShowcaseCard>

          <ShowcaseCard
            title="播放器底部控制条"
            usedIn="用于：播放器主操作区，包含返回、快退快进、播放暂停、分P、UP主页、字幕、设置、推荐。"
            noteLabel="由"
            noteText="TvIconButton、FocusButton 的播放器控制条编排组成"
            className="ui-debug-showcase-card--full"
          >
            <div className="ui-debug-player-bar-stage">
              <PlayerControlBar
                sectionId="ui-debug-composition-controls"
                isPlaying
                onBack={EMPTY_HANDLER}
                onReplay={EMPTY_HANDLER}
                onTogglePlay={EMPTY_HANDLER}
                onForward={EMPTY_HANDLER}
                onRestartFromBeginning={EMPTY_HANDLER}
                onRefresh={EMPTY_HANDLER}
                onOpenEpisodes={EMPTY_HANDLER}
                onOpenAuthor={EMPTY_HANDLER}
                onOpenSubtitles={EMPTY_HANDLER}
                onOpenSettings={EMPTY_HANDLER}
                onOpenRecommendations={EMPTY_HANDLER}
              />
            </div>
          </ShowcaseCard>

          <ShowcaseCard
            title="播放器设置抽屉"
            usedIn="用于：对照播放器右侧设置类面板的标题、section 节奏、按钮组和信息行关系。"
            noteLabel="由"
            noteText="基础按钮、标题 / section label、辅助文案、信息行组成"
            className="ui-debug-showcase-card--full"
          >
            <FocusSection
              as="div"
              id="ui-debug-composition-drawer"
              group="content"
              className="ui-debug-drawer-stage"
              leaveFor={{
                left: '@side-nav',
                up: '@ui-debug-composition-controls',
              }}
              scroll={CONTENT_FIRST_ROW_SCROLL}
            >
              <div className="player-settings-drawer ui-debug-player-drawer">
                <PlayerSettingsDrawer
                  sectionId="ui-debug-composition-drawer"
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
                  summaryText="当前播放：1080P / AVC / 1920x1080"
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
                />
              </div>
            </FocusSection>
          </ShowcaseCard>
        </div>
      </section>
    </main>
  );
}
