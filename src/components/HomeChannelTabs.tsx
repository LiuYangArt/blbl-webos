import { FocusButton } from './FocusButton';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../platform/focus';
import type { HomeChannelKey } from '../services/api/types';

type HomeChannelTab = {
  key: HomeChannelKey;
  label: string;
  hint: string;
};

type HomeChannelTabsProps = {
  tabs: HomeChannelTab[];
  activeKey: HomeChannelKey;
  onChange: (key: HomeChannelKey) => void;
  leaveDown?: string;
  defaultFocus?: boolean;
};

export function HomeChannelTabs({
  tabs,
  activeKey,
  onChange,
  leaveDown,
  defaultFocus = false,
}: HomeChannelTabsProps) {
  return (
    <FocusSection
      as="section"
      id="home-channel-tabs"
      group="content"
      enterTo="last-focused"
      className="content-section home-channel-tabs"
      leaveFor={{ left: '@side-nav', down: leaveDown }}
      scroll={CONTENT_FIRST_ROW_SCROLL}
    >
      <div className="section-header">
        <div>
          <h2>首页频道</h2>
          <p>登录后会自动补出关注与订阅内容，方向键左右即可切换。</p>
        </div>
        <span className="section-header__action">{tabs.find((tab) => tab.key === activeKey)?.hint ?? ''}</span>
      </div>
      <div className="home-channel-tabs__list">
        {tabs.map((tab, index) => (
          <FocusButton
            key={tab.key}
            variant={tab.key === activeKey ? 'primary' : 'ghost'}
            size="sm"
            className="home-channel-tabs__button"
            sectionId="home-channel-tabs"
            focusId={`home-channel-tab-${tab.key}`}
            defaultFocus={defaultFocus && index === 0}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </FocusButton>
        ))}
      </div>
    </FocusSection>
  );
}
