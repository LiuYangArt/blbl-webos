import { useEffect, useMemo } from 'react';
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
    <div className="app-shell">
      <aside className="app-sidebar">
        <p className="app-sidebar__label">Project Bootstrap</p>
        <strong>Bilibili WebOS</strong>
        <span>{statusText}</span>
        <span>页面深度：{depth}</span>
      </aside>

      <div className="app-content">
        {currentPage.name === 'home' ? (
          <HomePage onOpenPlayer={(title) => push({ name: 'player', title })} />
        ) : (
          <PlayerPage title={currentPage.title} onBack={() => pop()} />
        )}
      </div>
    </div>
  );
}
