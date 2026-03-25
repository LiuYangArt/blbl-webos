import { useLayoutEffect, useRef, useState } from 'react';

type UseVideoListLoadingGateOptions = {
  minDurationMs?: number;
};

const DEFAULT_MIN_DURATION_MS = 240;

export function useVideoListLoadingGate(ready: boolean, options?: UseVideoListLoadingGateOptions) {
  const minDurationMs = options?.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
  const [showLoading, setShowLoading] = useState(!ready);
  const loadingStartedAtRef = useRef<number | null>(ready ? null : performance.now());

  useLayoutEffect(() => {
    if (!ready) {
      loadingStartedAtRef.current = performance.now();
      setShowLoading(true);
      return;
    }

    if (!showLoading) {
      return;
    }

    const startedAt = loadingStartedAtRef.current;
    if (startedAt === null) {
      setShowLoading(false);
      return;
    }

    const elapsed = performance.now() - startedAt;
    const waitMs = Math.max(0, minDurationMs - elapsed);
    let timeoutId: number | null = null;
    let rafIdOne = 0;
    let rafIdTwo = 0;

    const closeGate = () => {
      rafIdOne = window.requestAnimationFrame(() => {
        rafIdTwo = window.requestAnimationFrame(() => {
          loadingStartedAtRef.current = null;
          setShowLoading(false);
        });
      });
    };

    if (waitMs > 0) {
      timeoutId = window.setTimeout(closeGate, waitMs);
    } else {
      closeGate();
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (rafIdOne) {
        window.cancelAnimationFrame(rafIdOne);
      }
      if (rafIdTwo) {
        window.cancelAnimationFrame(rafIdTwo);
      }
    };
  }, [ready, showLoading, minDurationMs]);

  return showLoading;
}
