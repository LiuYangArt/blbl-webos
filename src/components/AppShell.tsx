import type { ReactNode } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { isWebOSAvailable } from '../platform/webos';
import { SideNavRail } from './SideNavRail';

type AppShellProps = {
  children: ReactNode;
  contentOverlay?: ReactNode;
  activeNav: RootNavKey | null;
  profileName?: string;
  profileAvatar?: string;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute, navFocusId: string) => void;
  immersive?: boolean;
};

export function AppShell({
  children,
  contentOverlay,
  activeNav,
  profileName,
  profileAvatar,
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
          {contentOverlay ? <div className="tv-app-main__overlay">{contentOverlay}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <SideNavRail
        activeNav={activeNav}
        onNavigate={onNavigate}
        isLoggedIn={isLoggedIn}
        profileName={profileName}
        profileAvatar={profileAvatar}
      />
      <div className="tv-app-main">
        <div className="tv-page-content" data-focus-scroll-root="true">{children}</div>
        {contentOverlay ? <div className="tv-app-main__overlay">{contentOverlay}</div> : null}
      </div>
    </div>
  );
}
