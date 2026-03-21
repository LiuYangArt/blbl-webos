import type { ReactNode } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { SideNavRail } from './SideNavRail';

type AppShellProps = {
  children: ReactNode;
  activeNav: RootNavKey | null;
  profileName?: string;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute) => void;
};

export function AppShell({
  children,
  activeNav,
  profileName,
  isLoggedIn,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="tv-app-shell">
      <SideNavRail activeNav={activeNav} onNavigate={onNavigate} isLoggedIn={isLoggedIn} />
      <div className="tv-app-main">
        <header className="tv-topbar" aria-hidden="true">
          <div className="tv-topbar__status-group">
            <span className="tv-topbar__profile">{profileName ?? '游客模式'}</span>
          </div>
        </header>
        <div className="tv-page-content">{children}</div>
      </div>
    </div>
  );
}
