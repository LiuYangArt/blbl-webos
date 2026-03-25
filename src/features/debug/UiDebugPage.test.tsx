import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiDebugPage } from './UiDebugPage';

vi.mock('../../app/useAsyncData', () => ({
  useAsyncData: () => ({
    status: 'success',
    data: [
      {
        aid: 1,
        bvid: 'BV1mock001',
        cid: 1,
        title: '真实推荐卡片 A',
        cover: 'https://example.com/a.jpg',
        duration: 188,
        ownerName: '作者 A',
        playCount: 0,
        danmakuCount: 0,
      },
      {
        aid: 2,
        bvid: 'BV1mock002',
        cid: 2,
        title: '真实推荐卡片 B',
        cover: 'https://example.com/b.jpg',
        duration: 266,
        ownerName: '作者 B',
        playCount: 0,
        danmakuCount: 0,
      },
      {
        aid: 3,
        bvid: 'BV1mock003',
        cid: 3,
        title: '真实推荐卡片 C',
        cover: 'https://example.com/c.jpg',
        duration: 320,
        ownerName: '作者 C',
        playCount: 0,
        danmakuCount: 0,
      },
    ],
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../../platform/focus', () => ({
  CONTENT_FIRST_ROW_SCROLL: {},
  FocusSection: ({
    children,
    id,
    ...props
  }: {
    children: ReactNode;
    id: string;
    [key: string]: unknown;
  }) => (
    <div data-focus-section={id} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('../../components/BilibiliBrandMark', () => ({
  BilibiliBrandMark: () => <span>BrandMark</span>,
}));

vi.mock('../../components/FollowingSummaryChips', () => ({
  FollowingSummaryChips: ({ items }: { items: Array<{ label: string }> }) => (
    <div>{items.map((item) => item.label).join(' / ')}</div>
  ),
}));

vi.mock('../../components/FocusButton', () => ({
  FocusButton: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../components/MediaCard', () => ({
  MediaCard: ({ item }: { item: { title: string } }) => <div>{item.title}</div>,
}));

vi.mock('../../components/PlayerControlBar', () => ({
  PlayerControlBar: () => <div>PlayerControlBar</div>,
}));

vi.mock('../../components/SearchComposer', () => ({
  SearchComposer: ({
    fields,
    value,
  }: {
    fields?: Array<{ label?: string; value: string }>;
    value?: string;
  }) => (
    <div>
      {(fields ?? [{ label: '关键词', value: value ?? '' }]).map((field) => (
        <span key={`${field.label}-${field.value}`}>{`${field.label}:${field.value}`}</span>
      ))}
    </div>
  ),
}));

vi.mock('../../components/SectionHeader', () => ({
  SectionHeader: ({
    title,
    description,
    actionLabel,
  }: {
    title: string;
    description?: string;
    actionLabel?: string;
  }) => (
    <div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actionLabel ? <span>{actionLabel}</span> : null}
    </div>
  ),
}));

vi.mock('../../components/TopbarProfilePill', () => ({
  TopbarProfilePill: ({ title, badge }: { title: string; badge: string }) => <div>{`${badge}:${title}`}</div>,
}));

vi.mock('../../components/TvProgressBar', () => ({
  TvProgressBar: ({
    leadingLabel,
    trailingLabel,
  }: {
    leadingLabel: string;
    trailingLabel: string;
  }) => <div>{`${leadingLabel} ${trailingLabel}`}</div>,
}));

vi.mock('../../components/TvIcon', () => ({
  TvIcon: ({ symbol }: { symbol: string }) => <span>{symbol}</span>,
}));

vi.mock('../../components/TvIconButton', () => ({
  TvIconButton: ({ label, ...props }: { label: string; [key: string]: unknown }) => (
    <button type="button" {...props}>
      {label}
    </button>
  ),
}));

vi.mock('../player/PlayerSettingsDrawer', () => ({
  PlayerSettingsDrawer: ({ badge, planText }: { badge: string; planText?: string }) => (
    <div>{`${badge}${planText ? ` ${planText}` : ''}`}</div>
  ),
}));

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
};

function renderPage(): RenderHandle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<UiDebugPage onExit={() => {}} />);
  });

  return { container, root };
}

describe('UiDebugPage', () => {
  let renderHandle: RenderHandle | null = null;

  afterEach(() => {
    if (!renderHandle) {
      return;
    }

    act(() => {
      renderHandle?.root.unmount();
    });
    renderHandle.container.remove();
    renderHandle = null;
  });

  it('按“基础单体元素 + 组合元素”展示新的信息架构', () => {
    renderHandle = renderPage();

    const text = renderHandle.container.textContent ?? '';

    expect(text).toContain('基础单体元素');
    expect(text).toContain('组合元素');
    expect(text).toContain('SectionHeader / 标题样式');
    expect(text).toContain('播放器顶部轻量信息');
    expect(text).toContain('SearchComposer / 搜索输入面板');
    expect(text).toContain('TopbarProfilePill / 顶栏账号胶囊');
    expect(text).toContain('FollowingSummaryChips / 关注摘要标签组');
    expect(text).toContain('TvProgressBar / 进度条');
    expect(text).toContain('正在播放');
    expect(text).toContain('首页频道切换条');
    expect(text).toContain('搜索入口区');
    expect(text).toContain('由：SectionHeader、基础按钮、SearchComposer、辅助文案组成');
    expect(text).toContain('由：基础按钮、标题 / section label、辅助文案、信息行组成');
  });

  it('移除了旧的分散顶层区块命名', () => {
    renderHandle = renderPage();

    const text = renderHandle.container.textContent ?? '';

    expect(text).not.toContain('基础控件');
    expect(text).not.toContain('导航与入口模块');
    expect(text).not.toContain('壳层与摘要标签');
    expect(text).not.toContain('卡片与内容模块');
    expect(text).not.toContain('输入与轻量说明');
    expect(text).not.toContain('播放器复合模块');
  });
});
