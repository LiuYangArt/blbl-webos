import { FocusButton } from './FocusButton';
import { SectionHeader } from './SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../platform/focus';
import type { HomeChannelKey } from '../services/api/types';

type HomeChannelTab = {
  key: HomeChannelKey;
  label: string;
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
      <SectionHeader title="首页频道" />
      <div className="home-channel-tabs__list">
        {tabs.map((tab, index) => (
          <FocusButton
            key={tab.key}
            variant={tab.key === activeKey ? 'primary' : 'glass'}
            size="md"
            className="detail-chip library-folder-chip home-channel-tabs__button"
            sectionId="home-channel-tabs"
            focusId={`home-channel-tab-${tab.key}`}
            defaultFocus={defaultFocus && index === 0}
            onClick={() => onChange(tab.key)}
          >
            <span>{tab.label}</span>
          </FocusButton>
        ))}
      </div>
    </FocusSection>
  );
}
