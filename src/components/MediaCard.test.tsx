import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaCard } from './MediaCard';

vi.mock('./FocusButton', () => ({
  FocusButton: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

type RenderHandle = {
  container: HTMLDivElement;
  root: Root;
};

function renderCard(imageLoading: 'eager' | 'lazy' = 'lazy'): RenderHandle {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MediaCard
        item={{
          aid: 1,
          bvid: 'BV1',
          cid: 2,
          title: '测试视频',
          cover: 'https://example.com/poster.jpg',
          duration: 125,
          ownerName: 'UP主',
          playCount: 1,
          danmakuCount: 1,
        }}
        imageLoading={imageLoading}
        onClick={() => {}}
      />,
    );
  });

  return {
    container,
    root,
  };
}

describe('MediaCard', () => {
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

  it('会为封面图设置异步解码和可配置的加载优先级', () => {
    renderHandle = renderCard('eager');

    const image = renderHandle.container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('decoding')).toBe('async');
    expect(image?.getAttribute('loading')).toBe('eager');
  });
});
