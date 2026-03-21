import type { ReactNode } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { SideNavRail } from './SideNavRail';

type AppShellProps = {
  children: ReactNode;
  activeNav: RootNavKey | null;
  statusText: string;
  profileName?: string;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute) => void;
};

export function AppShell({
  children,
  activeNav,
  statusText,
  profileName,
  isLoggedIn,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="tv-app-shell">
      <SideNavRail activeNav={activeNav} onNavigate={onNavigate} isLoggedIn={isLoggedIn} />
      <div className="tv-app-main">
        <header className="tv-topbar" aria-hidden="true">
          <div>
            <p className="tv-topbar__eyebrow">Bilibili WebOS TV</p>
            <strong className="tv-topbar__title">PiliPlus TV Migration</strong>
            <p className="tv-topbar__subtitle">
              首页、详情、播放、搜索、历史、登录资产正在统一到一套路由与服务层。
            </p>
          </div>
          <div className="tv-topbar__status-group">
            <span className="tv-topbar__profile">{profileName ?? '游客模式'}</span>
            <span className="tv-topbar__status">{statusText}</span>
          </div>
        </header>
        <div className="tv-page-content">{children}</div>
      </div>
    </div>
  );
}
