import { useEffect, useRef, useState } from 'react';
import { expandBorderRadius } from './focusOverlayRadius';

type FocusOverlaySnapshot = {
  focusId: string | null;
  focusSection: string | null;
  focusGroup: string | null;
  focusPressed: boolean;
  tagName: string;
  className: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: string;
};

type FocusOverlayProps = {
  debugEnabled?: boolean;
};

const FOLLOW_FRAMES_AFTER_CHANGE = 10;
const SNAPSHOT_MOVE_EPSILON = 1;
const DEBUG_MUTATION_ATTRIBUTE_FILTER = ['data-focus-active', 'data-focus-pressed', 'class', 'style'] as const;
const CAPTURE_SYNC_EVENT_TYPES = [
  'focusin',
  'focusout',
  'keydown',
  'keyup',
  'transitionrun',
  'transitionend',
  'animationstart',
  'animationend',
] as const;

function isFocusableElement(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element && element.matches('[data-focusable="true"]'));
}

function hasSnapshotMoved(previous: FocusOverlaySnapshot, next: FocusOverlaySnapshot): boolean {
  return Math.abs(previous.left - next.left) > SNAPSHOT_MOVE_EPSILON
    || Math.abs(previous.top - next.top) > SNAPSHOT_MOVE_EPSILON
    || Math.abs(previous.width - next.width) > SNAPSHOT_MOVE_EPSILON
    || Math.abs(previous.height - next.height) > SNAPSHOT_MOVE_EPSILON;
}

function readActiveFocusElement(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isFocusableElement(active)) {
    return active;
  }

  const marked = document.querySelector<HTMLElement>('[data-focus-active="true"]');
  if (
    marked
    && marked.isConnected
    && isFocusableElement(marked)
    && marked.dataset.focusActive === 'true'
  ) {
    return marked;
  }

  return null;
}

function readMutationRoot(element: HTMLElement | null): HTMLElement {
  return element?.closest<HTMLElement>('[data-focus-scroll-root="true"]')
    ?? element?.closest<HTMLElement>('[data-focus-section-root]')
    ?? document.body;
}

function buildSnapshot(element: HTMLElement | null, debugEnabled: boolean): FocusOverlaySnapshot | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(element);
  return {
    focusId: element.dataset.focusId ?? null,
    focusSection: debugEnabled ? element.dataset.focusSection ?? null : null,
    focusGroup: debugEnabled ? element.dataset.focusGroup ?? null : null,
    focusPressed: element.dataset.focusPressed === 'true',
    tagName: debugEnabled ? element.tagName.toLowerCase() : '',
    className: debugEnabled ? element.className : '',
    text: debugEnabled ? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '' : '',
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    borderRadius: style.borderRadius,
  };
}

function areSnapshotsEqual(previous: FocusOverlaySnapshot | null, next: FocusOverlaySnapshot | null): boolean {
  if (previous === next) {
    return true;
  }

  if (!previous || !next) {
    return false;
  }

  return previous.focusId === next.focusId
    && previous.focusSection === next.focusSection
    && previous.focusGroup === next.focusGroup
    && previous.focusPressed === next.focusPressed
    && previous.tagName === next.tagName
    && previous.className === next.className
    && previous.text === next.text
    && previous.left === next.left
    && previous.top === next.top
    && previous.width === next.width
    && previous.height === next.height
    && previous.borderRadius === next.borderRadius;
}

function buildMutationObserverOptions(debugEnabled: boolean): MutationObserverInit {
  return {
    subtree: true,
    childList: true,
    attributes: debugEnabled,
    ...(debugEnabled ? { attributeFilter: [...DEBUG_MUTATION_ATTRIBUTE_FILTER] } : {}),
  };
}

function bindCaptureSyncEvents(listener: () => void): () => void {
  CAPTURE_SYNC_EVENT_TYPES.forEach((type) => {
    window.addEventListener(type, listener, true);
  });

  return () => {
    CAPTURE_SYNC_EVENT_TYPES.forEach((type) => {
      window.removeEventListener(type, listener, true);
    });
  };
}

export function FocusOverlay({ debugEnabled = false }: FocusOverlayProps): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<FocusOverlaySnapshot | null>(null);
  const previousSnapshotRef = useRef<FocusOverlaySnapshot | null>(null);
  const followFramesRef = useRef(0);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  const observedRootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const observeMutationRoot = (element: HTMLElement | null) => {
      const observer = mutationObserverRef.current;
      if (!observer) {
        return;
      }

      const nextRoot = readMutationRoot(element);
      if (observedRootRef.current === nextRoot) {
        return;
      }

      observer.disconnect();
      observer.observe(nextRoot, buildMutationObserverOptions(debugEnabled));
      observedRootRef.current = nextRoot;
    };

    const update = () => {
      rafId = 0;
      const activeElement = readActiveFocusElement();
      observeMutationRoot(activeElement);
      const nextSnapshot = buildSnapshot(activeElement, debugEnabled);
      const previousSnapshot = previousSnapshotRef.current;

      if (!nextSnapshot) {
        followFramesRef.current = 0;
      } else if (!previousSnapshot || previousSnapshot.focusId !== nextSnapshot.focusId) {
        // 焦点切换后的几帧里，继续追踪布局变动，避免首屏抖动时白框“掉队”。
        followFramesRef.current = FOLLOW_FRAMES_AFTER_CHANGE;
      } else if (hasSnapshotMoved(previousSnapshot, nextSnapshot)) {
        followFramesRef.current = FOLLOW_FRAMES_AFTER_CHANGE;
      }

      previousSnapshotRef.current = nextSnapshot;
      setSnapshot((currentSnapshot) => (
        areSnapshotsEqual(currentSnapshot, nextSnapshot) ? currentSnapshot : nextSnapshot
      ));

      if (followFramesRef.current > 0) {
        followFramesRef.current -= 1;
        rafId = window.requestAnimationFrame(update);
      }
    };

    const scheduleUpdate = () => {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(update);
    };

    mutationObserverRef.current = new MutationObserver(scheduleUpdate);
    observeMutationRoot(readActiveFocusElement());

    const unbindCaptureSyncEvents = bindCaptureSyncEvents(scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    scheduleUpdate();

    return () => {
      mutationObserverRef.current?.disconnect();
      mutationObserverRef.current = null;
      observedRootRef.current = null;
      unbindCaptureSyncEvents();
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);

      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
      followFramesRef.current = 0;
    };
  }, [debugEnabled]);

  if (!snapshot) {
    return debugEnabled ? (
      <div className="focus-debug-hud" aria-hidden="true">
        <strong>Focus Debug</strong>
        <span>当前没有检测到可聚焦元素</span>
      </div>
    ) : null;
  }

  const ringInset = 4;
  const ringStyle = {
    left: `${snapshot.left - ringInset}px`,
    top: `${snapshot.top - ringInset}px`,
    width: `${snapshot.width + (ringInset * 2)}px`,
    height: `${snapshot.height + (ringInset * 2)}px`,
    borderRadius: expandBorderRadius(snapshot.borderRadius, ringInset),
  };

  return (
    <>
      <div
        className={[
          'focus-debug-ring',
          snapshot.focusPressed ? 'focus-debug-ring--pressed' : '',
        ].filter(Boolean).join(' ')}
        style={ringStyle}
        aria-hidden="true"
      />
      {debugEnabled ? (
        <div className="focus-debug-hud" aria-hidden="true">
          <strong>Focus Debug</strong>
          <span>{snapshot.focusId ?? '(无 focusId)'}</span>
          <span>{snapshot.tagName} · {snapshot.focusSection ?? '(无 section)'}</span>
          <span>{snapshot.width}x{snapshot.height} @ {snapshot.left},{snapshot.top}</span>
          <span>{snapshot.focusPressed ? 'pressed' : 'idle'} · {snapshot.focusGroup ?? 'content'}</span>
          <span>{snapshot.text || snapshot.className || '(无可读文本)'}</span>
        </div>
      ) : null}
    </>
  );
}
