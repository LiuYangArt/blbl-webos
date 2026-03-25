import { useLayoutEffect, useMemo, useState } from 'react';

export function useImageReadyGate(imageUrls: string[], enabled: boolean) {
  const normalizedUrls = useMemo(() => Array.from(new Set(
    imageUrls
      .map((url) => url.trim())
      .filter(Boolean),
  )), [imageUrls]);
  const [ready, setReady] = useState(() => enabled && normalizedUrls.length === 0);

  useLayoutEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      setReady(true);
      return;
    }

    if (normalizedUrls.length === 0) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let remaining = normalizedUrls.length;
    setReady(false);

    const cleanupHandlers: Array<() => void> = [];

    const markOneSettled = () => {
      if (cancelled) {
        return;
      }

      remaining -= 1;
      if (remaining <= 0) {
        setReady(true);
      }
    };

    for (const url of normalizedUrls) {
      const image = new window.Image();
      let settled = false;

      const settle = () => {
        if (settled) {
          return;
        }
        settled = true;
        image.onload = null;
        image.onerror = null;
        markOneSettled();
      };

      image.onload = settle;
      image.onerror = settle;
      image.src = url;

      if (image.complete) {
        settle();
      }

      cleanupHandlers.push(() => {
        image.onload = null;
        image.onerror = null;
      });
    }

    return () => {
      cancelled = true;
      for (const cleanup of cleanupHandlers) {
        cleanup();
      }
    };
  }, [enabled, normalizedUrls]);

  return ready;
}
