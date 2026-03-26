import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerRoutePayload } from '../app/routes';
import type { UnifiedVideoListItem } from '../features/shared/videoListItems';
import { VideoGridSection } from './VideoGridSection';

vi.mock('../platform/focus', () => ({
  CONTENT_FIRST_ROW_SCROLL: {
    mode: 'none',
    anchor: 'focused-element',
    topOffset: 0,
    preserveHeaderWhenFirstRowFocused: false,
  },
  FocusSection: ({
    children,
    id,
    group: _group,
    enterTo: _enterTo,
    scroll: _scroll,
    ...props
  }: {
    children: ReactNode;
    id: string;
    group?: string;
    enterTo?: string;
    scroll?: unknown;
    [key: string]: unknown;
  }) => {
    void _group;
    void _enterTo;
    void _scroll;
    return (
      <section data-focus-section={id} {...props}>
        {children}
      </section>
    );
  },
}));

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <div data-section-title={title}>{title}</div>,
}));

vi.mock('./FocusButton', () => ({
  FocusButton: ({
    children,
    focusId,
    onClick,
  }: {
    children: ReactNode;
    focusId?: string;
    onClick?: () => void;
  }) => (
    <button type="button" data-focus-id={focusId} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('./MediaCard', () => ({
  MediaCard: ({
    focusId,
    onFocus,
    onClick,
    item,
  }: {
    focusId?: string;
    onFocus?: () => void;
    onClick?: () => void;
    item: { title: string };
  }) => (
    <button
      type="button"
      data-focus-id={focusId}
      onFocus={onFocus}
      onClick={onClick}
    >
      {item.title}
    </button>
  ),
}));

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
};

function createItem(index: number): UnifiedVideoListItem {
  const payload: PlayerRoutePayload = {
    bvid: `BV${index}`,
    cid: index + 1,
    title: `视频 ${index}`,
  };

  return {
    id: `video-${index}`,
    card: {
      aid: index + 1,
      bvid: `BV${index}`,
      cid: index + 1,
      title: `视频 ${index}`,
      cover: `https://example.com/${index}.jpg`,
      duration: 120,
      ownerName: `UP${index}`,
      playCount: 1,
      danmakuCount: 1,
    },
    resolvePlayer: async () => payload,
  };
}

function createItems(count: number, offset = 0): UnifiedVideoListItem[] {
  return Array.from({ length: count }, (_, index) => createItem(index + offset));
}

function renderSection(items: UnifiedVideoListItem[]): RenderHandle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <VideoGridSection
        sectionId="test-grid"
        title="测试列表"
        items={items}
        onOpenPlayer={() => {}}
        visibilityMode="progressive"
        initialVisibleCount={12}
        revealStep={12}
      />,
    );
  });

  return { container, root };
}

function rerenderSection(root: Root, items: UnifiedVideoListItem[]): void {
  act(() => {
    root.render(
      <VideoGridSection
        sectionId="test-grid"
        title="测试列表"
        items={items}
        onOpenPlayer={() => {}}
        visibilityMode="progressive"
        initialVisibleCount={12}
        revealStep={12}
      />,
    );
  });
}

function flushRevealFrames(): void {
  act(() => {
    vi.advanceTimersByTime(16);
  });
}

describe('VideoGridSection', () => {
  let renderHandle: RenderHandle | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => (
      window.setTimeout(() => callback(performance.now()), 16)
    ));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    if (!renderHandle) {
      vi.restoreAllMocks();
      vi.useRealTimers();
      return;
    }

    act(() => {
      renderHandle?.root.unmount();
    });
    renderHandle.container.remove();
    renderHandle = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('progressive 模式下新增数据不会回退可见窗口', () => {
    renderHandle = renderSection(createItems(14));

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-11"]')).not.toBeNull();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-13"]')).toBeNull();

    const edgeCard = renderHandle.container.querySelector<HTMLButtonElement>('[data-focus-id="test-grid-item-11"]');
    expect(edgeCard).not.toBeNull();

    act(() => {
      edgeCard?.focus();
    });
    flushRevealFrames();

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-13"]')).not.toBeNull();

    rerenderSection(renderHandle.root, createItems(15));

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-13"]')).not.toBeNull();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-14"]')).toBeNull();
  });

  it('首项切换时会重置 progressive 可见窗口', () => {
    renderHandle = renderSection(createItems(14));

    const edgeCard = renderHandle.container.querySelector<HTMLButtonElement>('[data-focus-id="test-grid-item-11"]');
    expect(edgeCard).not.toBeNull();

    act(() => {
      edgeCard?.focus();
    });
    flushRevealFrames();

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-13"]')).not.toBeNull();

    rerenderSection(renderHandle.root, createItems(14, 100));

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-11"]')).not.toBeNull();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-13"]')).toBeNull();
  });

  it('会把一次 revealStep 分成多帧插入，避免同帧挂载过多卡片', () => {
    renderHandle = renderSection(createItems(24));

    const edgeCard = renderHandle.container.querySelector<HTMLButtonElement>('[data-focus-id="test-grid-item-11"]');
    expect(edgeCard).not.toBeNull();

    act(() => {
      edgeCard?.focus();
    });

    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-17"]')).toBeNull();

    flushRevealFrames();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-17"]')).not.toBeNull();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-23"]')).toBeNull();

    flushRevealFrames();
    expect(renderHandle.container.querySelector('[data-focus-id="test-grid-item-23"]')).not.toBeNull();
  });
});
