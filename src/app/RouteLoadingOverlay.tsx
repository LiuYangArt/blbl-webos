/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

type RouteLoadingOverlayContextValue = {
  setOverlayVisible: (id: string, visible: boolean) => void;
};

const RouteLoadingOverlayContext = createContext<RouteLoadingOverlayContextValue | null>(null);

type RouteLoadingOverlayProviderProps = {
  children: ReactNode;
  onVisibilityChange: (visible: boolean) => void;
};

export function RouteLoadingOverlayProvider({
  children,
  onVisibilityChange,
}: RouteLoadingOverlayProviderProps) {
  const visibleIdsRef = useRef(new Set<string>());

  const setOverlayVisible = useCallback((id: string, visible: boolean) => {
    const visibleIds = visibleIdsRef.current;
    const hadVisible = visibleIds.size > 0;

    if (visible) {
      visibleIds.add(id);
    } else {
      visibleIds.delete(id);
    }

    const hasVisible = visibleIds.size > 0;
    if (hadVisible !== hasVisible) {
      onVisibilityChange(hasVisible);
    }
  }, [onVisibilityChange]);

  const value = useMemo<RouteLoadingOverlayContextValue>(() => ({
    setOverlayVisible,
  }), [setOverlayVisible]);

  return (
    <RouteLoadingOverlayContext.Provider value={value}>
      {children}
    </RouteLoadingOverlayContext.Provider>
  );
}

export function useRouteLoadingOverlay(visible: boolean) {
  const context = useContext(RouteLoadingOverlayContext);
  const id = useId();

  useLayoutEffect(() => {
    if (!context) {
      return undefined;
    }

    context.setOverlayVisible(id, visible);
    return () => {
      context.setOverlayVisible(id, false);
    };
  }, [context, id, visible]);
}
