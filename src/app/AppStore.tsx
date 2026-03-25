import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { fetchCurrentUserProfile } from '../services/api/bilibili';
import { readJsonStorage, writeJsonStorage } from '../services/storage/local';
import type { UserProfile } from '../services/api/types';

type AuthState = {
  status: 'idle' | 'loading' | 'authenticated' | 'guest';
  profile: UserProfile | null;
  error: string | null;
};

type AppState = {
  auth: AuthState;
  searchHistory: string[];
};

type AppStoreValue = AppState & {
  hasAuthCookies: boolean;
  rememberSearch: (keyword: string) => void;
  removeSearchHistory: (keyword: string) => void;
  refreshAuth: () => Promise<void>;
  setAuthGuest: () => void;
};

type Action =
  | { type: 'remember-search'; keyword: string }
  | { type: 'remove-search'; keyword: string }
  | { type: 'auth-loading' }
  | { type: 'auth-success'; profile: UserProfile }
  | { type: 'auth-guest'; error?: string | null };

const STORAGE_KEYS = {
  searchHistory: 'bilibili_webos.search_history',
} as const;

const initialState: AppState = {
  auth: {
    status: 'idle',
    profile: null,
    error: null,
  },
  searchHistory: readJsonStorage<string[]>(STORAGE_KEYS.searchHistory, []),
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'remember-search': {
      const keyword = action.keyword.trim();
      if (!keyword) {
        return state;
      }
      const next = [keyword, ...state.searchHistory.filter((item) => item !== keyword)].slice(0, 10);
      return { ...state, searchHistory: next };
    }
    case 'remove-search':
      return {
        ...state,
        searchHistory: state.searchHistory.filter((item) => item !== action.keyword),
      };
    case 'auth-loading':
      return {
        ...state,
        auth: {
          ...state.auth,
          status: 'loading',
          error: null,
        },
      };
    case 'auth-success':
      return {
        ...state,
        auth: {
          status: 'authenticated',
          profile: action.profile,
          error: null,
        },
      };
    case 'auth-guest':
      return {
        ...state,
        auth: {
          status: 'guest',
          profile: null,
          error: action.error ?? null,
        },
      };
  }
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

function hasBilibiliCookies() {
  return typeof navigator !== 'undefined' && navigator.cookieEnabled;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const authInFlight = useRef<Promise<void> | null>(null);

  const rememberSearch = useCallback((keyword: string) => {
    const normalized = keyword.trim();
    dispatch({ type: 'remember-search', keyword });
    if (!normalized) {
      return;
    }

    const next = [normalized, ...state.searchHistory.filter((item) => item !== normalized)].slice(0, 10);
    writeJsonStorage(STORAGE_KEYS.searchHistory, next);
  }, [state.searchHistory]);

  const removeSearchHistory = useCallback((keyword: string) => {
    dispatch({ type: 'remove-search', keyword });
    writeJsonStorage(
      STORAGE_KEYS.searchHistory,
      state.searchHistory.filter((item) => item !== keyword),
    );
  }, [state.searchHistory]);

  const setAuthGuest = useCallback(() => {
    dispatch({ type: 'auth-guest' });
  }, []);

  const refreshAuth = useCallback(async () => {
    if (authInFlight.current) {
      return authInFlight.current;
    }
    const task = (async () => {
      dispatch({ type: 'auth-loading' });
      try {
        const profile = await fetchCurrentUserProfile();
        dispatch({ type: 'auth-success', profile });
      } catch (error) {
        const message = error instanceof Error ? error.message : '无法恢复登录态';
        dispatch({ type: 'auth-guest', error: message });
      } finally {
        authInFlight.current = null;
      }
    })();
    authInFlight.current = task;
    return task;
  }, []);

  const value = useMemo<AppStoreValue>(() => ({
    ...state,
    hasAuthCookies: hasBilibiliCookies(),
    rememberSearch,
    removeSearchHistory,
    setAuthGuest,
    refreshAuth,
  }), [refreshAuth, rememberSearch, removeSearchHistory, setAuthGuest, state]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error('useAppStore must be used inside AppStoreProvider');
  }
  return context;
}
