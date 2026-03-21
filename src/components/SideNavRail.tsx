type NavKey = 'home' | 'categories' | 'search' | 'history' | 'profile' | null;

type SideNavRailProps = {
  activeNav: NavKey;
};

const navItems = [
  { key: 'home', shortLabel: 'HM', label: '首页' },
  { key: 'categories', shortLabel: 'CT', label: '分区' },
  { key: 'search', shortLabel: 'SR', label: '搜索' },
  { key: 'history', shortLabel: 'HS', label: '历史' },
  { key: 'profile', shortLabel: 'ME', label: '我的' },
] as const;

export function SideNavRail({ activeNav }: SideNavRailProps) {
  return (
    <aside className="side-nav-rail" aria-label="全局导航">
      <div className="side-nav-rail__brand">
        <span className="side-nav-rail__logo">bi</span>
        <div>
          <strong>Bilibili</strong>
          <p>TV Edition</p>
        </div>
      </div>

      <nav className="side-nav-rail__list" aria-hidden="true">
        {navItems.map((item) => {
          const isActive = item.key === activeNav;
          return (
            <div
              key={item.key}
              className={['side-nav-item', isActive ? 'side-nav-item--active' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <span className="side-nav-item__icon">{item.shortLabel}</span>
              <span className="side-nav-item__label">{item.label}</span>
            </div>
          );
        })}
      </nav>

      <div className="side-nav-rail__footer" aria-hidden="true">
        <div className="side-nav-rail__avatar">UP</div>
        <div>
          <strong>大会员</strong>
          <p>客厅模式</p>
        </div>
      </div>
    </aside>
  );
}
