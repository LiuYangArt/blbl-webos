import { useEffect, useMemo } from 'react';
import { AppShell } from './components/AppShell';
import { HomePage } from './features/home/HomePage';
import { PlayerPage } from './features/player/PlayerPage';
import { focusFirst } from './platform/focus';
import { attachRemoteControl } from './platform/remote';
import { isWebOSAvailable, platformBack } from './platform/webos';
import { usePageStack } from './app/usePageStack';

type AppPage =
  | { name: 'home' }
  | { name: 'player'; title: string };

export default function App() {
  const pageStack = usePageStack<AppPage>({ name: 'home' });
  const { current: currentPage, depth, pop, push } = pageStack;
  const focusKey = currentPage.name === 'player' ? currentPage.title : currentPage.name;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      focusFirst();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [focusKey]);

  useEffect(() => {
    return attachRemoteControl({
      onBack: () => {
        if (!pop()) {
          platformBack();
        }
      },
    });
  }, [pop]);

  const statusText = useMemo(
    () => (isWebOSAvailable() ? '当前运行环境：webOS TV' : '当前运行环境：浏览器开发模式'),
    [],
  );

  return (
    <AppShell activeNav={currentPage.name === 'home' ? 'home' : null} statusText={`${statusText} · 页面深度 ${depth}`}>
      <div className="app-page">
        {currentPage.name === 'home' ? (
          <HomePage onOpenPlayer={(title) => push({ name: 'player', title })} />
        ) : (
          <PlayerPage title={currentPage.title} onBack={() => pop()} />
        )}
      </div>
    </AppShell>
  );
}
