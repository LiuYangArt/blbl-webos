import { useCallback, useMemo, useState } from 'react';

export function usePageStack<T>(initialPage: T) {
  const [stack, setStack] = useState<T[]>([initialPage]);

  const current = stack[stack.length - 1];

  const push = useCallback((page: T) => {
    setStack((currentStack) => [...currentStack, page]);
  }, []);

  const replace = useCallback((page: T) => {
    setStack((currentStack) => [...currentStack.slice(0, -1), page]);
  }, []);

  const reset = useCallback((page: T) => {
    setStack([page]);
  }, []);

  const pop = useCallback(() => {
    let didPop = false;
    setStack((currentStack) => {
      if (currentStack.length <= 1) {
        return currentStack;
      }
      didPop = true;
      return currentStack.slice(0, -1);
    });
    return didPop;
  }, []);

  return useMemo(
    () => ({ current, stack, push, replace, reset, pop, depth: stack.length }),
    [current, pop, push, replace, reset, stack],
  );
}
