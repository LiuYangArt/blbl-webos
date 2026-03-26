import { useState } from 'react';
import type { AppRoute, RootNavKey } from '../app/routes';
import { ROOT_NAV_ITEMS } from '../app/routes';
import { FocusSection } from '../platform/focus';
import { BilibiliBrandMark } from './BilibiliBrandMark';
import { FocusButton } from './FocusButton';
import { TvIconButton } from './TvIconButton';

type SideNavRailProps = {
  activeNav: RootNavKey | null;
  isLoggedIn: boolean;
  profileName?: string;
  profileAvatar?: string;
  onNavigate: (route: AppRoute, navFocusId: string) => void;
};

function isRailItemVisible(key: RootNavKey, isLoggedIn: boolean): boolean {
  if (key === 'following' || key === 'subscriptions') {
    return isLoggedIn;
  }

  return key !== 'profile' && key !== 'login';
}

function getAccountRoute(isLoggedIn: boolean): AppRoute {
  return isLoggedIn ? { name: 'profile' } : { name: 'login' };
}

function getAccountLabel(isLoggedIn: boolean, profileName?: string): string {
  if (!isLoggedIn) {
    return '游客模式';
  }

  return profileName ?? '游客模式';
}

function getAvatarFallback(isLoggedIn: boolean, accountLabel: string): string {
  if (!isLoggedIn) {
    return '客';
  }

  return accountLabel.trim().charAt(0) || '我';
}

export function SideNavRail({
  activeNav,
  isLoggedIn,
  profileName,
  profileAvatar,
  onNavigate,
}: SideNavRailProps) {
  const [isPinnedOpen, setPinnedOpen] = useState(false);
  const items = ROOT_NAV_ITEMS.filter((item) => isRailItemVisible(item.key, isLoggedIn));
  const accountRoute = getAccountRoute(isLoggedIn);
  const accountLabel = getAccountLabel(isLoggedIn, profileName);
  const accountFocusId = 'side-nav-account';
  const isAccountActive = activeNav === 'profile' || activeNav === 'login';
  const avatarFallback = getAvatarFallback(isLoggedIn, accountLabel);

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

        <FocusButton
          sectionId="side-nav"
          focusId={accountFocusId}
          focusGroup="nav"
          variant="nav"
          size="md"
          className={[
            'side-nav-item',
            'side-nav-item--account',
            isAccountActive ? 'side-nav-item--active' : '',
          ].filter(Boolean).join(' ')}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true });
            onNavigate(accountRoute, accountFocusId);
          }}
          aria-current={isAccountActive ? 'page' : undefined}
          title={accountLabel}
        >
          <span className="side-nav-account__content">
            <span className="side-nav-account__avatar" aria-hidden="true">
              {profileAvatar ? (
                <img src={profileAvatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="side-nav-account__avatar-fallback">{avatarFallback}</span>
              )}
            </span>
            <span className="side-nav-account__label">{accountLabel}</span>
          </span>
        </FocusButton>
      </FocusSection>
    </aside>
  );
}
