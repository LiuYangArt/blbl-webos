import type { ReactNode } from 'react';
import { SideNavRail } from './SideNavRail';

type NavKey = 'home' | 'categories' | 'search' | 'history' | 'profile' | null;

type AppShellProps = {
  children: ReactNode;
  activeNav: NavKey;
  statusText: string;
};

export function AppShell({ children, activeNav, statusText }: AppShellProps) {
  return (
    <div className="tv-app-shell">
      <SideNavRail activeNav={activeNav} />
      <div className="tv-app-main">
        <header className="tv-topbar" aria-hidden="true">
          <div>
            <p className="tv-topbar__eyebrow">Bilibili WebOS TV</p>
            <strong className="tv-topbar__title">The Neon Curator</strong>
          </div>
          <div className="tv-topbar__status">{statusText}</div>
        </header>
        <div className="tv-page-content">{children}</div>
      </div>
    </div>
  );
}
