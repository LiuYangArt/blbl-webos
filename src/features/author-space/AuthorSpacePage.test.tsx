import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VideoCardItem } from '../../services/api/types';
import { AuthorSpacePage } from './AuthorSpacePage';

const {
  useAsyncDataMock,
  usePagedCollectionMock,
  createResolvedVideoListItemMock,
} = vi.hoisted(() => ({
  useAsyncDataMock: vi.fn(),
  usePagedCollectionMock: vi.fn(),
  createResolvedVideoListItemMock: vi.fn(),
}));

vi.mock('../../app/useAsyncData', () => ({
  useAsyncData: useAsyncDataMock,
}));

vi.mock('../shared/usePagedCollection', () => ({
  usePagedCollection: usePagedCollectionMock,
}));

vi.mock('../shared/useImageReadyGate', () => ({
  useImageReadyGate: () => true,
}));

vi.mock('../shared/useVideoListLoadingGate', () => ({
  useVideoListLoadingGate: (ready: boolean) => !ready,
}));

vi.mock('../shared/videoListItems', () => ({
  createResolvedVideoListItem: createResolvedVideoListItemMock,
  resolveVideoPlayerPayload: vi.fn(),
}));

vi.mock('../../platform/focus', () => ({
  CONTENT_FIRST_ROW_SCROLL: {},
  FocusSection: ({
    as: Component = 'section',
    children,
    id,
    group: _group,
    leaveFor: _leaveFor,
    scroll: _scroll,
    enterTo: _enterTo,
    ...props
  }: {
    as?: 'div' | 'section' | 'main' | 'aside';
    children: ReactNode;
    id: string;
    group?: string;
    leaveFor?: unknown;
    scroll?: unknown;
    enterTo?: unknown;
    [key: string]: unknown;
  }) => {
    void _group;
    void _leaveFor;
    void _scroll;
    void _enterTo;

    return (
      <Component data-focus-section-root={id} {...props}>
        {children}
      </Component>
    );
  },
}));

vi.mock('../../components/FocusButton', () => ({
  FocusButton: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
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

vi.mock('../../components/VideoGridSection', () => ({
  VideoGridSection: ({
    title,
    items,
    beforeGrid,
  }: {
    title: string;
    items: Array<{ id: string; card: VideoCardItem }>;
    beforeGrid?: ReactNode;
  }) => (
    <div data-testid="video-grid-section">
      <h2>{title}</h2>
      {beforeGrid}
      <div>
        {items.map((item) => (
          <span key={item.id}>{item.card.title}</span>
        ))}
      </div>
    </div>
  ),
}));

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
};

const profileReloadMock = vi.fn();
const archiveReloadMock = vi.fn();
const archiveLoadMoreMock = vi.fn();
const onOpenPlayerMock = vi.fn();

const latestVideoCard: VideoCardItem = {
  aid: 1001,
  bvid: 'BV1latest',
  cid: 2001,
  title: '作者最新视频',
  cover: 'https://example.com/latest.jpg',
  duration: 120,
  ownerName: '测试作者',
  playCount: 100,
  danmakuCount: 10,
};

const popularVideoCard: VideoCardItem = {
  aid: 1002,
  bvid: 'BV1popular',
  cid: 2002,
  title: '作者热门视频',
  cover: 'https://example.com/popular.jpg',
  duration: 180,
  ownerName: '测试作者',
  playCount: 200,
  danmakuCount: 20,
};

function createSuccessProfileState() {
  return {
    status: 'success' as const,
    data: {
      user: {
        mid: 9527,
        name: '测试作者',
        face: '',
        sign: '作者签名',
        level: 6,
        vipLabel: null,
      },
      relation: {
        following: 123,
        follower: 45678,
      },
    },
    error: null,
    reload: profileReloadMock,
  };
}

function createArchiveState(order: 'pubdate' | 'click') {
  const card = order === 'click' ? popularVideoCard : latestVideoCard;
  return {
    status: 'success' as const,
    items: [card],
    error: null,
    currentPage: 1,
    hasMore: false,
    isLoadingMore: false,
    loadMoreError: null,
    reload: archiveReloadMock,
    loadMore: archiveLoadMoreMock,
    cursor: null,
  };
}

function renderPage(): RenderHandle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <AuthorSpacePage
        mid={9527}
        authorName="回退作者名"
        sourceBvid="BV1source"
        onOpenPlayer={onOpenPlayerMock}
      />,
    );
  });

  return { container, root };
}

describe('AuthorSpacePage', () => {
  let renderHandle: RenderHandle | null = null;

  beforeEach(() => {
    profileReloadMock.mockReset();
    archiveReloadMock.mockReset();
    archiveLoadMoreMock.mockReset();
    onOpenPlayerMock.mockReset();
    useAsyncDataMock.mockReset();
    usePagedCollectionMock.mockReset();
    createResolvedVideoListItemMock.mockReset();
    createResolvedVideoListItemMock.mockImplementation((id: string, card: VideoCardItem) => ({
      id,
      card,
      resolvePlayer: async () => ({
        aid: card.aid,
        bvid: card.bvid,
        cid: card.cid,
        title: card.title,
      }),
    }));
  });

  afterEach(() => {
    if (renderHandle) {
      act(() => {
        renderHandle?.root.unmount();
      });
      renderHandle.container.remove();
      renderHandle = null;
    }
  });

  it('资料加载中时不会提前渲染作者页内容', () => {
    useAsyncDataMock.mockReturnValue({
      status: 'loading',
      data: null,
      error: null,
      reload: profileReloadMock,
    });
    usePagedCollectionMock.mockReturnValue({
      status: 'loading',
      items: [],
      error: null,
      currentPage: 0,
      hasMore: false,
      isLoadingMore: false,
      loadMoreError: null,
      reload: archiveReloadMock,
      loadMore: archiveLoadMoreMock,
      cursor: null,
    });

    renderHandle = renderPage();

    expect(renderHandle.container.textContent).toBe('');
  });

  it('资料加载失败时会显示重试按钮并触发 reload', () => {
    useAsyncDataMock.mockReturnValue({
      status: 'error',
      data: null,
      error: '作者资料请求失败',
      reload: profileReloadMock,
    });
    usePagedCollectionMock.mockReturnValue({
      status: 'loading',
      items: [],
      error: null,
      currentPage: 0,
      hasMore: false,
      isLoadingMore: false,
      loadMoreError: null,
      reload: archiveReloadMock,
      loadMore: archiveLoadMoreMock,
      cursor: null,
    });

    renderHandle = renderPage();

    expect(renderHandle.container.textContent).toContain('作者主页加载失败');
    expect(renderHandle.container.textContent).toContain('作者资料请求失败');

    const retryButton = renderHandle.container.querySelector('button');
    expect(retryButton?.textContent).toContain('重新加载');

    act(() => {
      retryButton?.click();
    });

    expect(profileReloadMock).toHaveBeenCalledTimes(1);
  });

  it('成功态会展示作者信息，并在切换排序后更新列表内容', () => {
    useAsyncDataMock.mockReturnValue(createSuccessProfileState());
    usePagedCollectionMock.mockImplementation(({ deps }: { deps: [number, 'pubdate' | 'click'] }) => {
      const [, order] = deps;
      return createArchiveState(order);
    });

    renderHandle = renderPage();

    expect(renderHandle.container.textContent).toContain('测试作者');
    expect(renderHandle.container.textContent).toContain('作者签名');
    expect(renderHandle.container.textContent).toContain('普通创作者');
    expect(renderHandle.container.textContent).toContain('从当前播放继续浏览这个作者的其他视频。');
    expect(renderHandle.container.textContent).toContain('当前排序：最新发布');
    expect(renderHandle.container.textContent).toContain('作者最新视频');

    const orderButtons = Array.from(renderHandle.container.querySelectorAll('button'));
    const popularButton = orderButtons.find((button) => button.textContent?.includes('最多播放'));
    expect(popularButton).toBeTruthy();

    act(() => {
      popularButton?.click();
    });

    expect(renderHandle.container.textContent).toContain('当前排序：最多播放');
    expect(renderHandle.container.textContent).toContain('作者热门视频');
  });
});
