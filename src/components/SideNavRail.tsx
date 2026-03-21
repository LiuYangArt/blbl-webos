import type { AppRoute, RootNavKey } from '../app/routes';
import { ROOT_NAV_ITEMS } from '../app/routes';
import { FocusButton } from './FocusButton';

type SideNavRailProps = {
  activeNav: RootNavKey | null;
  isLoggedIn: boolean;
  onNavigate: (route: AppRoute) => void;
};

export function SideNavRail({ activeNav, isLoggedIn, onNavigate }: SideNavRailProps) {
  const items = ROOT_NAV_ITEMS.filter((item) => (item.key === 'login' ? !isLoggedIn : true));

  return (
    <aside className="side-nav-rail" aria-label="全局导航">
      <div className="side-nav-rail__brand">
        <span className="side-nav-rail__logo">bi</span>
        <div>
          <strong>Bilibili</strong>
          <p>webOS 客厅版</p>
        </div>
      </div>

      <nav className="side-nav-rail__list">
        {items.map((item, index) => {
          const isActive = item.key === activeNav;
          return (
            <FocusButton
              key={item.key}
              row={index}
              col={0}
              variant="nav"
              size="md"
              className={['side-nav-item', isActive ? 'side-nav-item--active' : ''].filter(Boolean).join(' ')}
              onClick={() => onNavigate(item.route)}
            >
              <span className="side-nav-item__icon">{item.shortLabel}</span>
              <span className="side-nav-item__label">{item.label}</span>
            </FocusButton>
          );
        })}
      </nav>

      <div className="side-nav-rail__footer" aria-hidden="true">
        <div className="side-nav-rail__avatar">{isLoggedIn ? 'UP' : 'TV'}</div>
        <div>
          <strong>{isLoggedIn ? '账号内容已接入' : '游客模式'}</strong>
          <p>{isLoggedIn ? '历史 / 收藏 / 稍后再看' : '扫码后同步你的内容'}</p>
        </div>
      </div>
    </aside>
  );
}
