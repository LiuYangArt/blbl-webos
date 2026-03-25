import { act, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerControlBar } from './PlayerControlBar';

vi.mock('../platform/focus', () => ({
  FocusSection: ({
    children,
    id,
    group: _group,
    enterTo: _enterTo,
    disabled: _disabled,
    ...props
  }: {
    children: ReactNode;
    id: string;
    group?: string;
    enterTo?: string;
    disabled?: boolean;
    [key: string]: unknown;
  }) => {
    void _group;
    void _enterTo;
    void _disabled;

    return (
      <div data-focus-section={id} {...props}>
        {children}
      </div>
    );
  },
}));

vi.mock('./TvIconButton', () => ({
  TvIconButton: ({
    label,
    symbol,
    focusId,
    className,
    labelClassName,
    onClick,
    onFocus,
    onBlur,
    ...props
  }: {
    label: string;
    symbol: string;
    focusId?: string;
    className?: string;
    labelClassName?: string;
    onClick?: () => void;
    onFocus?: ButtonHTMLAttributes<HTMLButtonElement>['onFocus'];
    onBlur?: ButtonHTMLAttributes<HTMLButtonElement>['onBlur'];
    [key: string]: unknown;
  }) => (
    <button
      type="button"
      className={className}
      data-focus-id={focusId}
      data-label-class={labelClassName}
      data-symbol={symbol}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
      {...props}
    >
      <span>{label}</span>
    </button>
  ),
}));

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
};

const onBackMock = vi.fn();
const onReplayMock = vi.fn();
const onTogglePlayMock = vi.fn();
const onForwardMock = vi.fn();
const onRestartFromBeginningMock = vi.fn();
const onRefreshMock = vi.fn();
const onOpenEpisodesMock = vi.fn();
const onOpenAuthorMock = vi.fn();
const onOpenSubtitlesMock = vi.fn();
const onOpenSettingsMock = vi.fn();
const onOpenRecommendationsMock = vi.fn();

function renderBar(props?: Partial<Parameters<typeof PlayerControlBar>[0]>): RenderHandle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <PlayerControlBar
        sectionId="player-controls"
        isPlaying
        onBack={onBackMock}
        onReplay={onReplayMock}
        onTogglePlay={onTogglePlayMock}
        onForward={onForwardMock}
        onRestartFromBeginning={onRestartFromBeginningMock}
        onRefresh={onRefreshMock}
        onOpenEpisodes={onOpenEpisodesMock}
        onOpenAuthor={onOpenAuthorMock}
        onOpenSubtitles={onOpenSubtitlesMock}
        onOpenSettings={onOpenSettingsMock}
        onOpenRecommendations={onOpenRecommendationsMock}
        {...props}
      />,
    );
  });

  return { container, root };
}

describe('PlayerControlBar', () => {
  let renderHandle: RenderHandle | null = null;

  beforeEach(() => {
    onBackMock.mockReset();
    onReplayMock.mockReset();
    onTogglePlayMock.mockReset();
    onForwardMock.mockReset();
    onRestartFromBeginningMock.mockReset();
    onRefreshMock.mockReset();
    onOpenEpisodesMock.mockReset();
    onOpenAuthorMock.mockReset();
    onOpenSubtitlesMock.mockReset();
    onOpenSettingsMock.mockReset();
    onOpenRecommendationsMock.mockReset();
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

  it('会渲染 UP主页 按钮并在点击时触发打开作者主页', () => {
    renderHandle = renderBar();

    const authorButton = renderHandle.container.querySelector('[data-focus-id="player-open-author"]');

    expect(authorButton?.textContent).toContain('UP主页');

    act(() => {
      (authorButton as HTMLButtonElement | null)?.click();
    });

    expect(onOpenAuthorMock).toHaveBeenCalledTimes(1);
  });

  it('作者入口不可用时会带禁用样式', () => {
    renderHandle = renderBar({ authorAvailable: false });

    const authorButton = renderHandle.container.querySelector('[data-focus-id="player-open-author"]');

    expect(authorButton?.className).toContain('focus-button--disabled');
    expect(authorButton?.className).toContain('player-control-bar__action--inactive');
  });
});
