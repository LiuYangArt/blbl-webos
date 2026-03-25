import { afterEach, beforeEach, vi } from 'vitest';

type MemoryStorage = Storage & {
  reset: () => void;
};

function createMemoryStorage(): MemoryStorage {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(String(key)) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    reset() {
      store = new Map<string, string>();
    },
  };
}

const memoryStorage = createMemoryStorage();
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  memoryStorage.reset();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  });
});

afterEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  delete window.launchParams;
  delete window.PalmSystem;
  vi.useRealTimers();
  vi.restoreAllMocks();
});
