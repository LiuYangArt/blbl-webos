import { useEffect, useRef, useState } from 'react';

type PagedCollectionState<T> =
  | {
      status: 'idle' | 'loading';
      items: T[];
      error: null;
      currentPage: 0;
      hasMore: false;
      isLoadingMore: false;
      loadMoreError: null;
    }
  | {
      status: 'success';
      items: T[];
      error: null;
      currentPage: number;
      hasMore: boolean;
      isLoadingMore: boolean;
      loadMoreError: string | null;
    }
  | {
      status: 'error';
      items: T[];
      error: string;
      currentPage: 0;
      hasMore: false;
      isLoadingMore: false;
      loadMoreError: null;
    };

type UsePagedCollectionOptions<T> = {
  deps: unknown[];
  enabled?: boolean;
  loadPage: (page: number, cursor: string | null) => Promise<T[] | PagedCollectionPageResult<T>>;
  getItemKey: (item: T) => string;
};

type PagedCollectionPageResult<T> = {
  items: T[];
  hasMore?: boolean;
  cursor?: string | null;
};

type UsePagedCollectionResult<T> = PagedCollectionState<T> & {
  reload: () => Promise<T[]>;
  loadMore: () => Promise<void>;
  cursor: string | null;
};

export function usePagedCollection<T>({
  deps,
  enabled = true,
  loadPage,
  getItemKey,
}: UsePagedCollectionOptions<T>): UsePagedCollectionResult<T> {
  const [state, setState] = useState<PagedCollectionState<T>>(createInitialState(enabled));
  const [cursor, setCursor] = useState<string | null>(null);
  const loadPageRef = useRef(loadPage);
  const getItemKeyRef = useRef(getItemKey);
  const requestVersionRef = useRef(0);

  loadPageRef.current = loadPage;
  getItemKeyRef.current = getItemKey;

  const reload = async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    setState(createInitialState(true));
    setCursor(null);

    try {
      const pageResult = normalizePageResult(await loadPageRef.current(1, null));
      if (requestVersionRef.current !== requestVersion) {
        return pageResult.items;
      }

      setState(createSuccessState(pageResult.items, 1, pageResult.hasMore));
      setCursor(pageResult.cursor);
      return pageResult.items;
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) {
        throw error;
      }

      const message = error instanceof Error ? error.message : '请求失败';
      setState(createErrorState(message));
      setCursor(null);
      throw error;
    }
  };

  const loadMore = async () => {
    if (state.status !== 'success' || state.isLoadingMore || !state.hasMore) {
      return;
    }

    const requestVersion = requestVersionRef.current;
    const nextPage = state.currentPage + 1;
    const snapshotItems = state.items;
    const snapshotCursor = cursor;

    setState((current) => current.status !== 'success'
      ? current
      : {
          ...current,
          isLoadingMore: true,
          loadMoreError: null,
        });

    try {
      const pageResult = normalizePageResult(await loadPageRef.current(nextPage, snapshotCursor));
      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setState((current) => {
        if (current.status !== 'success') {
          return current;
        }

        const mergedItems = mergeUniqueItems(snapshotItems, pageResult.items, getItemKeyRef.current);
        const addedCount = mergedItems.length - snapshotItems.length;
        const cursorAdvanced = pageResult.cursor !== snapshotCursor;
        const collectionAdvanced = addedCount > 0 || cursorAdvanced;

        return createSuccessState(
          mergedItems,
          collectionAdvanced ? nextPage : current.currentPage,
          pageResult.hasMore && collectionAdvanced,
        );
      });
      setCursor(pageResult.cursor);
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载更多失败';
      setState((current) => current.status !== 'success'
        ? current
        : {
            ...current,
            isLoadingMore: false,
            loadMoreError: message,
          });
    }
  };

  useEffect(() => {
    if (!enabled) {
      setState(createInitialState(false));
      setCursor(null);
      return;
    }

    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return {
    ...state,
    reload,
    loadMore,
    cursor,
  };
}

function createInitialState<T>(enabled: boolean): PagedCollectionState<T> {
  return {
    status: enabled ? 'loading' : 'idle',
    items: [],
    error: null,
    currentPage: 0,
    hasMore: false,
    isLoadingMore: false,
    loadMoreError: null,
  };
}

function createSuccessState<T>(items: T[], currentPage: number, hasMore: boolean): PagedCollectionState<T> {
  return {
    status: 'success',
    items,
    error: null,
    currentPage,
    hasMore,
    isLoadingMore: false,
    loadMoreError: null,
  };
}

function createErrorState<T>(message: string): PagedCollectionState<T> {
  return {
    status: 'error',
    items: [],
    error: message,
    currentPage: 0,
    hasMore: false,
    isLoadingMore: false,
    loadMoreError: null,
  };
}

function normalizePageResult<T>(result: T[] | PagedCollectionPageResult<T>): Required<PagedCollectionPageResult<T>> {
  if (Array.isArray(result)) {
    return {
      items: result,
      hasMore: result.length > 0,
      cursor: null,
    };
  }

  return {
    items: result.items,
    hasMore: result.hasMore ?? result.items.length > 0,
    cursor: result.cursor ?? null,
  };
}

function mergeUniqueItems<T>(current: T[], incoming: T[], getItemKey: (item: T) => string): T[] {
  const seen = new Set(current.map((item) => getItemKey(item)));
  const merged = [...current];

  for (const item of incoming) {
    const key = getItemKey(item);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(item);
  }

  return merged;
}
