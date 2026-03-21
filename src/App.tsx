import { useEffect, useMemo, useRef } from 'react';
import { AppShell } from './components/AppShell';
import { AppStoreProvider, useAppStore } from './app/AppStore';
import { PageBackHandlerProvider } from './app/PageBackHandler';
import { type AppRoute, getActiveNav } from './app/routes';
import { usePageStack } from './app/usePageStack';
import { LoginPage } from './features/auth/LoginPage';
import { HistoryPage } from './features/history/HistoryPage';
import { HomePage } from './features/home/HomePage';
import { HotPage } from './features/hot/HotPage';
import { LibraryPage } from './features/library/LibraryPage';
import { FavoriteDetailPage } from './features/library/FavoriteDetailPage';
import { PlayerPage } from './features/player/PlayerPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SearchPage } from './features/search/SearchPage';
import { SearchResultsPage } from './features/search/SearchResultsPage';
import { VideoDetailPage } from './features/video-detail/VideoDetailPage';
import { focusFirst } from './platform/focus';
import { attachRemoteControl } from './platform/remote';
import { platformBack } from './platform/webos';

function markBootMounted() {
  const diagnostics = (window as typeof window & {
    __biliBootDiag?: {
      update?: (stage: string, detail?: string) => void;
      mounted?: () => void;
    };
  }).__biliBootDiag;

  diagnostics?.update?.('app-mounted', 'React 应用已经完成首屏挂载');
  diagnostics?.mounted?.();
}

function AppContent() {
  const { auth, refreshAuth } = useAppStore();
  const pageStack = usePageStack<AppRoute>({ name: 'home' });
  const { current: currentPage, pop, push, replace } = pageStack;
  const backHandlerRef = useRef<(() => boolean) | null>(null);

  const focusKey = useMemo(() => {
    switch (currentPage.name) {
      case 'search-results':
        return `${currentPage.name}:${currentPage.keyword}`;
      case 'video-detail':
        return `${currentPage.name}:${currentPage.bvid}`;
      case 'player':
        return `${currentPage.name}:${currentPage.bvid}:${currentPage.cid}`;
      case 'favorite-detail':
        return `${currentPage.name}:${currentPage.mediaId}`;
      default:
        return currentPage.name;
    }
  }, [currentPage]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      focusFirst();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [focusKey]);

  useEffect(() => attachRemoteControl({
    onBack: () => {
      if (backHandlerRef.current?.()) {
        return;
      }
      if (!pop()) {
        platformBack();
      }
    },
  }), [pop]);

  useEffect(() => {
    markBootMounted();
  }, []);

  const activeNav = getActiveNav(currentPage, auth.status === 'authenticated');

  return (
    <PageBackHandlerProvider
      onRegister={(handler) => {
        backHandlerRef.current = handler;
      }}
    >
      <AppShell
        activeNav={activeNav}
        profileName={auth.profile?.name}
        isLoggedIn={auth.status === 'authenticated'}
        onNavigate={(route) => replace(route)}
      >
        <div className="app-page">
          {renderRoute(currentPage, {
            push,
            replace,
            pop,
            isLoggedIn: auth.status === 'authenticated',
          })}
        </div>
      </AppShell>
    </PageBackHandlerProvider>
  );
}

type RouteActions = {
  push: (route: AppRoute) => void;
  replace: (route: AppRoute) => void;
  pop: () => boolean;
  isLoggedIn: boolean;
};

function renderRoute(route: AppRoute, actions: RouteActions) {
  switch (route.name) {
    case 'home':
      return (
        <HomePage
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
          onOpenSearch={() => actions.replace({ name: 'search' })}
          onOpenHot={() => actions.replace({ name: 'hot' })}
        />
      );
    case 'hot':
      return <HotPage onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })} />;
    case 'search':
      return (
        <SearchPage
          onSubmit={(keyword) => actions.push({ name: 'search-results', keyword })}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
        />
      );
    case 'search-results':
      return (
        <SearchResultsPage
          keyword={route.keyword}
          onSubmit={(keyword) => actions.replace({ name: 'search-results', keyword })}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
        />
      );
    case 'video-detail':
      return (
        <VideoDetailPage
          bvid={route.bvid}
          fallbackTitle={route.title}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
          onPlay={(entry) => actions.push({
            name: 'player',
            bvid: route.bvid,
            cid: entry.cid,
            title: entry.title,
            part: entry.part,
          })}
        />
      );
    case 'player':
      return (
        <PlayerPage
          bvid={route.bvid}
          cid={route.cid}
          title={route.title}
          part={route.part}
          onBack={() => actions.pop()}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
        />
      );
    case 'history':
      return (
        <HistoryPage
          onLogin={() => actions.push({ name: 'login' })}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
          onOpenPlayer={(item) => actions.push({
            name: 'player',
            bvid: item.bvid,
            cid: item.cid,
            title: item.title,
            part: item.part,
          })}
        />
      );
    case 'login':
      return <LoginPage onCompleted={() => actions.replace({ name: 'profile' })} />;
    case 'profile':
      return (
        <ProfilePage
          isLoggedIn={actions.isLoggedIn}
          onLogin={() => actions.push({ name: 'login' })}
          onOpenHistory={() => actions.push({ name: 'history' })}
          onOpenLater={() => actions.push({ name: 'later' })}
          onOpenFavorites={() => actions.push({ name: 'favorites' })}
        />
      );
    case 'later':
      return (
        <LibraryPage
          mode="later"
          onLogin={() => actions.push({ name: 'login' })}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
        />
      );
    case 'favorites':
      return (
        <LibraryPage
          mode="favorites"
          onLogin={() => actions.push({ name: 'login' })}
          onOpenFavorite={(folder) => actions.push({ name: 'favorite-detail', mediaId: folder.id, title: folder.title })}
        />
      );
    case 'favorite-detail':
      return (
        <FavoriteDetailPage
          mediaId={route.mediaId}
          title={route.title}
          onOpenDetail={(item) => actions.push({ name: 'video-detail', bvid: item.bvid, title: item.title })}
        />
      );
  }
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppContent />
    </AppStoreProvider>
  );
}
