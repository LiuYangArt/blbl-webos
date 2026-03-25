import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useVideoListLoadingGate } from './useVideoListLoadingGate';

function GateProbe({ ready }: { ready: boolean }) {
  const showLoading = useVideoListLoadingGate(ready, { minDurationMs: 0 });
  return <div data-testid="gate">{showLoading ? 'on' : 'off'}</div>;
}

describe('useVideoListLoadingGate', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    const mountedRoot = root;
    const mountedContainer = container;

    if (mountedRoot && mountedContainer) {
      flushSync(() => {
        mountedRoot.unmount();
      });
      mountedContainer.remove();
    }
    container = null;
    root = null;
  });

  it('ready 从 true 切到 false 时会在同一帧打开 loading gate', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const mountedRoot = createRoot(container);
    root = mountedRoot;

    flushSync(() => {
      mountedRoot.render(<GateProbe ready />);
    });
    expect(container.textContent).toContain('off');

    flushSync(() => {
      mountedRoot.render(<GateProbe ready={false} />);
    });
    expect(container.textContent).toContain('on');
  });
});
