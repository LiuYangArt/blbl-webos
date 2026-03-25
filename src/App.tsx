import { useEffect, useMemo, useRef } from 'react';
import { AppShell } from './components/AppShell';
import { FocusOverlay } from './components/FocusOverlay';
import { AppStoreProvider, useAppStore } from './app/AppStore';
import { shouldAutofocusContentAfterMutation } from './app/focusPolicy';
import { readDebugFocusEnabled, resolveInitialRoute } from './app/launchParams';
import { PageBackHandlerProvider } from './app/PageBackHandler';
import { type AppRoute, type PlayerRoutePayload, getActiveNav } from './app/routes';
import { usePageStack } from './app/usePageStack';
import { AuthorSpacePage } from './features/author-space/AuthorSpacePage';
import { LoginPage } from './features/auth/LoginPage';
import { UiDebugPage } from './features/debug/UiDebugPage';
import { isEditableElement, matchesUiDebugShortcut } from './features/debug/uiDebug';
import { FollowingPage } from './features/following/FollowingPage';
import { HistoryPage } from './features/history/HistoryPage';
import { HomePage } from './features/home/HomePage';
import { HotPage } from './features/hot/HotPage';
import { LibraryPage } from './features/library/LibraryPage';
import { PlayerPage } from './features/player/PlayerPage';
import { PgcDetailPage } from './features/pgc/PgcDetailPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SearchPage } from './features/search/SearchPage';
import { SearchResultsPage } from './features/search/SearchResultsPage';
import { SubscriptionsPage } from './features/subscriptions/SubscriptionsPage';
import { VideoDetailPage } from './features/video-detail/VideoDetailPage';
import { focusById, focusFirst, focusSection, isFocusableElement, readFocusGroup } from './platform/focus';
import { attachRemoteControl } from './platform/remote';
import { appendRuntimeDiagnostic } from './services/debug/runtimeDiagnostics';
import { platformBack } from './platform/webos';
import { ensureRelaySession } from './services/relay/client';
import { readRelayAuthMaterial, readRelaySettings } from './services/relay/settings';

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
  const initialRoute = useMemo<AppRoute>(() => resolveInitialRoute(), []);
  const isFocusDebugEnabled = useMemo(() => readDebugFocusEnabled(), []);
  const pageStack = usePageStack<AppRoute>(initialRoute);
  const { current: currentPage, pop, push, replace } = pageStack;
  const backHandlerRef = useRef<(() => boolean) | null>(null);
  const lastRouteKeyRef = useRef<string>('');
  const nextRouteKeepsNavFocusRef = useRef(false);
  const nextNavFocusIdRef = useRef<string | null>(null);
  const lastRelaySyncKeyRef = useRef<string>('');

  const focusKey = useMemo(() => summarizeRoute(currentPage), [currentPage]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.status !== 'authenticated' || !auth.profile) {
      lastRelaySyncKeyRef.current = '';
      return;
    }

    const settings = readRelaySettings();
    if (!settings.enabled || !settings.host) {
      lastRelaySyncKeyRef.current = '';
      return;
    }

    const syncKey = `${auth.profile.mid}:${settings.host}:${settings.port}`;
    if (lastRelaySyncKeyRef.current === syncKey) {
      return;
    }
    lastRelaySyncKeyRef.current = syncKey;

    void ensureRelaySession(settings, auth.profile, readRelayAuthMaterial(), 'app-start');
  }, [auth.profile, auth.status]);

  useEffect(() => {
    const currentRouteKey = summarizeRoute(currentPage);
    appendRuntimeDiagnostic('route', 'route-visible', {
      current: currentRouteKey,
      previous: lastRouteKeyRef.current || null,
      stackDepth: pageStack.depth,
    });
    lastRouteKeyRef.current = currentRouteKey;
  }, [currentPage, pageStack.depth]);

  useEffect(() => {
    if (nextRouteKeepsNavFocusRef.current) {
      nextRouteKeepsNavFocusRef.current = false;
      const nextNavFocusId = nextNavFocusIdRef.current;
      nextNavFocusIdRef.current = null;

      if ((nextNavFocusId && focusById(nextNavFocusId)) || focusSection('side-nav')) {
        return undefined;
      }
    }

    const active = document.activeElement;
    if (
      active instanceof HTMLElement
      && isFocusableElement(active)
      && readFocusGroup(active) !== 'content'
    ) {
      active.blur();
    }

    const tryFocusContent = () => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLElement
        && isFocusableElement(activeElement)
        && readFocusGroup(activeElement) === 'content'
      ) {
        return true;
      }

      return Boolean(focusFirst({ preferredGroup: 'content', allowFallbackGroup: false }));
    };

    if (tryFocusContent()) {
      return undefined;
    }

    if (!shouldAutofocusContentAfterMutation(currentPage)) {
      return undefined;
    }

    const pageContent = document.querySelector('.tv-page-content');
    const observer = new MutationObserver(() => {
      if (tryFocusContent()) {
        observer.disconnect();
      }
    });

    if (pageContent) {
      observer.observe(pageContent, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [currentPage, focusKey]);

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
    const handleUiDebugShortcut = (event: KeyboardEvent) => {
      if (!matchesUiDebugShortcut(event) || isEditableElement(document.activeElement)) {
        return;
      }

      event.preventDefault();

      if (currentPage.name === 'ui-debug') {
        if (!pop()) {
          replace({ name: 'home' });
        }
        return;
      }

      push({ name: 'ui-debug' });
    };

    window.addEventListener('keydown', handleUiDebugShortcut);
    return () => {
      window.removeEventListener('keydown', handleUiDebugShortcut);
    };
  }, [currentPage.name, pop, push, replace]);

  useEffect(() => {
    markBootMounted();
  }, []);

  const activeNav = getActiveNav(currentPage, auth.status === 'authenticated');
  const isImmersiveRoute = currentPage.name === 'player';

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
        immersive={isImmersiveRoute}
        onNavigate={(route, navFocusId) => {
          nextRouteKeepsNavFocusRef.current = true;
          nextNavFocusIdRef.current = navFocusId;
          replace(route);
        }}
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
      <FocusOverlay debugEnabled={isFocusDebugEnabled} />
    </PageBackHandlerProvider>
  );
}

function summarizeRoute(route: AppRoute) {
  switch (route.name) {
    case 'player':
      return `player:${route.bvid}:${route.cid}`;
    case 'ui-debug':
      return 'ui-debug';
    case 'video-detail':
      return `video-detail:${route.bvid}`;
    case 'pgc-detail':
      return `pgc-detail:${route.seasonId}`;
    case 'author-space':
      return `author-space:${route.mid}`;
    case 'search-results':
      return `search-results:${route.keyword}`;
    default:
      return route.name;
  }
}

type RouteActions = {
  push: (route: AppRoute) => void;
  replace: (route: AppRoute) => void;
  pop: () => boolean;
  isLoggedIn: boolean;
};

function pushPlayer(actions: RouteActions, item: PlayerRoutePayload): void {
  actions.push({
    name: 'player',
    aid: item.aid,
    bvid: item.bvid,
    cid: item.cid,
    title: item.title,
    part: item.part,
  });
}

function pushAuthorSpace(
  actions: RouteActions,
  item: {
    mid: number;
    authorName?: string;
    sourceBvid?: string;
  },
): void {
  actions.push({
    name: 'author-space',
    mid: item.mid,
    authorName: item.authorName,
    sourceBvid: item.sourceBvid,
  });
}

function renderRoute(route: AppRoute, actions: RouteActions) {
  switch (route.name) {
    case 'ui-debug':
      return (
        <UiDebugPage
          onExit={() => {
            if (!actions.pop()) {
              actions.replace({ name: 'home' });
            }
          }}
        />
      );
    case 'home':
      return (
        <HomePage
          isLoggedIn={actions.isLoggedIn}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
          onOpenSearch={() => actions.replace({ name: 'search' })}
          onOpenHot={() => actions.replace({ name: 'hot' })}
        />
      );
    case 'following':
      return (
        <FollowingPage
          onLogin={() => actions.push({ name: 'login' })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'subscriptions':
      return (
        <SubscriptionsPage
          onLogin={() => actions.push({ name: 'login' })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'hot':
      return <HotPage onOpenPlayer={(item) => pushPlayer(actions, item)} />;
    case 'search':
      return (
        <SearchPage
          onSubmit={(keyword) => actions.push({ name: 'search-results', keyword })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'search-results':
      return (
        <SearchResultsPage
          keyword={route.keyword}
          onSubmit={(keyword) => actions.replace({ name: 'search-results', keyword })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'video-detail':
      return (
        <VideoDetailPage
          bvid={route.bvid}
          fallbackTitle={route.title}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
          onPlay={(entry) => actions.push({
            name: 'player',
            aid: entry.aid,
            bvid: route.bvid,
            cid: entry.cid,
            title: entry.title,
            part: entry.part,
          })}
        />
      );
    case 'pgc-detail':
      return (
        <PgcDetailPage
          seasonId={route.seasonId}
          fallbackTitle={route.title}
          onPlay={(item) => pushPlayer(actions, item)}
        />
      );
    case 'player':
      return (
        <PlayerPage
          aid={route.aid}
          bvid={route.bvid}
          cid={route.cid}
          title={route.title}
          part={route.part}
          onBack={() => actions.pop()}
          onOpenPlayer={(item) => actions.replace({
            name: 'player',
            aid: item.aid,
            bvid: item.bvid,
            cid: item.cid,
            title: item.title,
            part: item.part,
          })}
          onOpenAuthorSpace={(item) => pushAuthorSpace(actions, item)}
        />
      );
    case 'author-space':
      return (
        <AuthorSpacePage
          mid={route.mid}
          authorName={route.authorName}
          sourceBvid={route.sourceBvid}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'history':
      return (
        <HistoryPage
          onLogin={() => actions.push({ name: 'login' })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
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
          onOpenPlayer={(item) => pushPlayer(actions, item)}
        />
      );
    case 'favorites':
      return (
        <LibraryPage
          mode="favorites"
          onLogin={() => actions.push({ name: 'login' })}
          onOpenPlayer={(item) => pushPlayer(actions, item)}
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
