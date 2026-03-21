import { useEffect, useRef, useState } from 'react';

type AsyncState<T> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

type AsyncResult<T> =
  | { status: 'idle' | 'loading'; data: null; error: null; reload: () => Promise<T> }
  | { status: 'success'; data: T; error: null; reload: () => Promise<T> }
  | { status: 'error'; data: null; error: string; reload: () => Promise<T> };

export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options?: {
    immediate?: boolean;
  },
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle', data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = async () => {
    setState({ status: 'loading', data: null, error: null });
    try {
      const data = await loaderRef.current();
      setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      setState({ status: 'error', data: null, error: message });
      throw error;
    }
  };

  useEffect(() => {
    if (options?.immediate === false) {
      return;
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (state.status === 'success') {
    return {
      status: 'success',
      data: state.data,
      error: null,
      reload: run,
    };
  }

  if (state.status === 'error') {
    return {
      status: 'error',
      data: null,
      error: state.error,
      reload: run,
    };
  }

  return {
    status: state.status,
    data: null,
    error: null,
    reload: run,
  };
}
