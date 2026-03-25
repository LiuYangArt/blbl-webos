import { useEffect, useState } from 'react';
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

function readActiveFocusElement(): HTMLElement | null {
  const marked = document.querySelector<HTMLElement>('[data-focus-active="true"]');
  if (marked) {
    return marked;
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches('[data-focusable="true"]')) {
    return active;
  }

  return null;
}

function buildSnapshot(element: HTMLElement | null): FocusOverlaySnapshot | null {
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
    focusSection: element.dataset.focusSection ?? null,
    focusGroup: element.dataset.focusGroup ?? null,
    focusPressed: element.dataset.focusPressed === 'true',
    tagName: element.tagName.toLowerCase(),
    className: element.className,
    text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? '',
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    borderRadius: style.borderRadius,
  };
}

export function FocusOverlay({ debugEnabled = false }: FocusOverlayProps) {
  const [snapshot, setSnapshot] = useState<FocusOverlaySnapshot | null>(null);

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      rafId = 0;
      setSnapshot(buildSnapshot(readActiveFocusElement()));
    };

    const scheduleUpdate = () => {
      if (rafId !== 0) {
        return;
      }

      rafId = window.requestAnimationFrame(update);
    };

    const observer = debugEnabled
      ? new MutationObserver(scheduleUpdate)
      : null;
    observer?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-focus-active', 'data-focus-pressed', 'class', 'style'],
    });

    window.addEventListener('focusin', scheduleUpdate, true);
    window.addEventListener('focusout', scheduleUpdate, true);
    window.addEventListener('keydown', scheduleUpdate, true);
    window.addEventListener('keyup', scheduleUpdate, true);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);

    scheduleUpdate();

    return () => {
      observer?.disconnect();
      window.removeEventListener('focusin', scheduleUpdate, true);
      window.removeEventListener('focusout', scheduleUpdate, true);
      window.removeEventListener('keydown', scheduleUpdate, true);
      window.removeEventListener('keyup', scheduleUpdate, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);

      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
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
