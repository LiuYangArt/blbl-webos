import { useState } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { ROOT_NAV_ITEMS } from '../app/routes';
import { FocusSection } from '../platform/focus';
import { BilibiliBrandMark } from './BilibiliBrandMark';
import { TvIconButton } from './TvIconButton';

type SideNavRailProps = {
  activeNav: RootNavKey | null;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute, navFocusId: string) => void;
};

export function SideNavRail({ activeNav, isLoggedIn, onNavigate }: SideNavRailProps) {
  const [isPinnedOpen, setPinnedOpen] = useState(false);
  const items = ROOT_NAV_ITEMS.filter((item) => {
    if (item.key === 'login') {
      return !isLoggedIn;
    }
    if (item.key === 'following' || item.key === 'subscriptions') {
      return isLoggedIn;
    }
    return true;
  });

  return (
    <aside
      className={['side-nav-rail', isPinnedOpen ? 'side-nav-rail--expanded' : ''].filter(Boolean).join(' ')}
      aria-label="全局导航"
      onFocusCapture={() => setPinnedOpen(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }

        setPinnedOpen(false);
      }}
    >
      <div className="side-nav-rail__brand">
        <span className="side-nav-rail__logo" aria-hidden="true">
          <BilibiliBrandMark />
        </span>
        <div className="side-nav-rail__brand-copy">
          <strong>Bilibili</strong>
          <p>webOS 客厅版</p>
        </div>
      </div>

      <FocusSection
        as="nav"
        id="side-nav"
        group="nav"
        enterTo="last-focused"
        className="side-nav-rail__list"
      >
        {items.map((item, index) => {
          const isActive = item.key === activeNav;
          const navFocusId = `side-nav-${item.key}`;
          return (
            <TvIconButton
              key={item.key}
              sectionId="side-nav"
              focusId={navFocusId}
              focusGroup="nav"
              symbol={item.icon}
              label={item.label}
              iconSize="lg"
              variant="nav"
              size="md"
              defaultFocus={index === 0}
              className={['side-nav-item', isActive ? 'side-nav-item--active' : ''].filter(Boolean).join(' ')}
              onClick={(event) => {
                event.currentTarget.focus({ preventScroll: true });
                onNavigate(item.route, navFocusId);
              }}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            />
          );
        })}
      </FocusSection>
    </aside>
  );
}
