import type { ReactNode } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { isWebOSAvailable } from '../platform/webos';
import { SideNavRail } from './SideNavRail';
import { TopbarProfilePill } from './TopbarProfilePill';

type AppShellProps = {
  children: ReactNode;
  activeNav: RootNavKey | null;
  profileName?: string;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute) => void;
  immersive?: boolean;
};

export function AppShell({
  children,
  activeNav,
  profileName,
  isLoggedIn,
  onNavigate,
  immersive = false,
}: AppShellProps) {
  const shellClassName = [
    'tv-app-shell',
    isWebOSAvailable() ? 'tv-app-shell--webos' : '',
    immersive ? 'tv-app-shell--immersive' : '',
  ].filter(Boolean).join(' ');

  if (immersive) {
    return (
      <div className={shellClassName}>
        <div className="tv-app-main tv-app-main--immersive">
          <div className="tv-page-content tv-page-content--immersive">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <SideNavRail activeNav={activeNav} onNavigate={onNavigate} isLoggedIn={isLoggedIn} />
      <div className="tv-app-main">
        <header className="tv-topbar" aria-hidden="true">
          <div className="tv-topbar__status-group">
            <TopbarProfilePill label={profileName ?? '游客模式'} />
          </div>
        </header>
        <div className="tv-page-content" data-focus-scroll-root="true">{children}</div>
      </div>
    </div>
  );
}
